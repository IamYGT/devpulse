use std::collections::HashMap;
use rusqlite::Connection;
use serde::Serialize;

use crate::db::queries;
use crate::models::TrackerState;

/// Warning escalation levels - each level is more aggressive than the last
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub enum WarningLevel {
    None,
    Gentle,     // 80% of budget
    Firm,       // 100% of budget
    Aggressive, // 150% of budget
    Critical,   // 200% of budget - full screen overlay
}

impl WarningLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            WarningLevel::None => "none",
            WarningLevel::Gentle => "gentle",
            WarningLevel::Firm => "firm",
            WarningLevel::Aggressive => "aggressive",
            WarningLevel::Critical => "critical",
        }
    }

    /// Determine warning level from budget usage percentage
    pub fn from_percentage(pct: f64) -> Self {
        if pct >= 200.0 {
            WarningLevel::Critical
        } else if pct >= 150.0 {
            WarningLevel::Aggressive
        } else if pct >= 100.0 {
            WarningLevel::Firm
        } else if pct >= 80.0 {
            WarningLevel::Gentle
        } else {
            WarningLevel::None
        }
    }

    pub fn severity(&self) -> u8 {
        match self {
            WarningLevel::None => 0,
            WarningLevel::Gentle => 1,
            WarningLevel::Firm => 2,
            WarningLevel::Aggressive => 3,
            WarningLevel::Critical => 4,
        }
    }
}

/// An alert that needs to be shown to the user
pub struct EnforcementAlert {
    pub project_name: String,
    pub project_id: i64,
    pub level: WarningLevel,
    pub message: String,
    pub budget_minutes: i64,
    pub used_minutes: i64,
    pub percentage: f64,
    pub suggested_action: String,
}

/// Record of an emergency override
#[derive(Clone, Debug, Serialize)]
pub struct EmergencyOverride {
    pub project_id: i64,
    pub reason: String,
    pub timestamp: String,
    pub extra_minutes: i64,
}

/// Overtime information per project
#[derive(Clone, Debug, Serialize)]
pub struct OvertimeInfo {
    pub project_name: String,
    pub budget_minutes: i64,
    pub actual_minutes: i64,
    pub overtime_minutes: i64,
    pub percentage: f64,
}

/// The main enforcement engine
pub struct EnforcementManager {
    db_path: String,
    /// Current warning level per project (only escalate, never go back down)
    warning_levels: HashMap<i64, WarningLevel>,
    /// Timestamp of the last break taken
    last_break_time: Option<chrono::DateTime<chrono::Local>>,
    /// Tracking start time (for break calculations)
    session_start: chrono::DateTime<chrono::Local>,
    /// Active emergency overrides
    emergency_overrides: Vec<EmergencyOverride>,
    /// Dismissed warnings: project_id -> level that was dismissed
    dismissed_warnings: HashMap<i64, WarningLevel>,
    /// Enforcement strictness: "gentle", "strict", "extreme"
    enforcement_level: String,
    /// Break interval in minutes (default 90)
    break_interval_minutes: i64,
    /// Daily max hours (default 10)
    daily_max_hours: i64,
}

impl EnforcementManager {
    pub fn new(db_path: String) -> Self {
        Self {
            db_path,
            warning_levels: HashMap::new(),
            last_break_time: None,
            session_start: chrono::Local::now(),
            emergency_overrides: Vec::new(),
            dismissed_warnings: HashMap::new(),
            enforcement_level: "strict".to_string(),
            break_interval_minutes: 90,
            daily_max_hours: 10,
        }
    }

    /// Check enforcement rules. Returns alerts that need to be shown.
    pub fn check(&mut self, state: &TrackerState) -> Vec<EnforcementAlert> {
        let mut alerts = Vec::new();

        let conn = match Connection::open(&self.db_path) {
            Ok(c) => c,
            Err(_) => return alerts,
        };

        let projects = match queries::get_all_projects(&conn) {
            Ok(p) => p,
            Err(_) => return alerts,
        };

        // Find alternative project suggestions (projects with remaining budget)
        let mut available_projects: Vec<(String, i64)> = Vec::new();
        for p in &projects {
            if p.daily_budget_minutes <= 0 {
                continue;
            }
            let used = queries::get_project_today_minutes(&conn, p.id).unwrap_or(0);
            let remaining = p.daily_budget_minutes - used;
            if remaining > 10 {
                available_projects.push((p.name.clone(), remaining));
            }
        }

        // 1. Check project budget enforcement
        for project in &projects {
            if project.daily_budget_minutes <= 0 {
                continue; // No budget set, skip
            }

            let used = match queries::get_project_today_minutes(&conn, project.id) {
                Ok(m) => m,
                Err(_) => continue,
            };

            // Check for active emergency override
            let override_extra: i64 = self
                .emergency_overrides
                .iter()
                .filter(|o| o.project_id == project.id)
                .filter(|o| self.is_override_active(o))
                .map(|o| o.extra_minutes)
                .sum();

            let effective_budget = project.daily_budget_minutes + override_extra;
            let percentage = (used as f64 / project.daily_budget_minutes as f64) * 100.0;
            let effective_pct = (used as f64 / effective_budget as f64) * 100.0;

            // Determine the raw warning level from original budget percentage
            let new_level = WarningLevel::from_percentage(percentage);

            if new_level == WarningLevel::None {
                continue;
            }

            // If override is active and effective usage is under threshold, skip alert
            if override_extra > 0 && effective_pct < 80.0 {
                continue;
            }

            // Only escalate - don't repeat same or lower level
            let current_level = self
                .warning_levels
                .get(&project.id)
                .unwrap_or(&WarningLevel::None);
            if new_level.severity() <= current_level.severity() {
                // Already at this level or higher, check if dismissed
                if let Some(dismissed) = self.dismissed_warnings.get(&project.id) {
                    if dismissed.severity() >= new_level.severity() {
                        continue; // User dismissed this level
                    }
                } else {
                    continue; // Already shown this level
                }
            }

            // Build the suggested action
            let suggested_action = if let Some((name, _)) = available_projects
                .iter()
                .find(|(name, _)| *name != project.name)
            {
                format!("{} projesine gec", name)
            } else {
                "Mola ver".to_string()
            };

            // Build the message based on level and enforcement strictness
            let message = self.build_message(&new_level, &project.name, used, project.daily_budget_minutes, percentage);

            alerts.push(EnforcementAlert {
                project_name: project.name.clone(),
                project_id: project.id,
                level: new_level.clone(),
                message,
                budget_minutes: project.daily_budget_minutes,
                used_minutes: used,
                percentage,
                suggested_action,
            });

            // Update tracked warning level
            self.warning_levels.insert(project.id, new_level);
        }

        // 2. Check break enforcement
        let minutes_since_break = self.minutes_since_last_break();
        if state.is_tracking && !state.is_idle {
            if minutes_since_break >= self.break_interval_minutes * 2 {
                // Very overdue - create a break alert as critical
                alerts.push(EnforcementAlert {
                    project_name: "Mola Zamani".to_string(),
                    project_id: -1, // Special ID for break alerts
                    level: WarningLevel::Aggressive,
                    message: format!(
                        "{}dk aralik vermeden calisiyorsun! Lutfen mola ver.",
                        minutes_since_break
                    ),
                    budget_minutes: self.break_interval_minutes,
                    used_minutes: minutes_since_break,
                    percentage: (minutes_since_break as f64 / self.break_interval_minutes as f64) * 100.0,
                    suggested_action: "5dk mola ver".to_string(),
                });
            } else if minutes_since_break >= self.break_interval_minutes {
                alerts.push(EnforcementAlert {
                    project_name: "Mola Hatirlatma".to_string(),
                    project_id: -1,
                    level: WarningLevel::Gentle,
                    message: format!(
                        "{}dk aralik vermeden calisiyorsun. Kisa bir mola oneriyoruz.",
                        minutes_since_break
                    ),
                    budget_minutes: self.break_interval_minutes,
                    used_minutes: minutes_since_break,
                    percentage: (minutes_since_break as f64 / self.break_interval_minutes as f64) * 100.0,
                    suggested_action: "Gozlerini dinlendir, esneme yap".to_string(),
                });
            }
        }

        // 3. Check daily overtime
        if state.today_total_minutes > self.daily_max_hours * 60 {
            let overtime = state.today_total_minutes - self.daily_max_hours * 60;
            alerts.push(EnforcementAlert {
                project_name: "Gunluk Limit".to_string(),
                project_id: -2, // Special ID for daily limit
                level: WarningLevel::Firm,
                message: format!(
                    "Bugun toplam {}s {}dk calistin. Gunluk {}s limitini astin!",
                    state.today_total_minutes / 60,
                    state.today_total_minutes % 60,
                    self.daily_max_hours
                ),
                budget_minutes: self.daily_max_hours * 60,
                used_minutes: state.today_total_minutes,
                percentage: (state.today_total_minutes as f64 / (self.daily_max_hours * 60) as f64) * 100.0,
                suggested_action: format!("Bugunku calismani bitir (+{}dk fazla mesai)", overtime),
            });
        }

        alerts
    }

    /// Build the warning message based on level
    fn build_message(
        &self,
        level: &WarningLevel,
        project_name: &str,
        used: i64,
        budget: i64,
        percentage: f64,
    ) -> String {
        match level {
            WarningLevel::Gentle => {
                format!(
                    "{} projesinde bugun {}dk/{}dk harcadin. %{:.0} butceye ulastin.",
                    project_name, used, budget, percentage
                )
            }
            WarningLevel::Firm => {
                format!(
                    "{} projesi butcesi doldu! {}dk/{}dk. Baska projeye gec.",
                    project_name, used, budget
                )
            }
            WarningLevel::Aggressive => {
                format!(
                    "BUTCE ASILDI! {}: {}dk / {}dk butce (%{:.0})",
                    project_name, used, budget, percentage
                )
            }
            WarningLevel::Critical => {
                format!(
                    "LUTFEN DUR! {} projesinde {}dk harcadin. Butce: {}dk. Bu proje icin bugun yeterince calistin.",
                    project_name, used, budget
                )
            }
            WarningLevel::None => String::new(),
        }
    }

    /// User requests emergency override to continue working
    pub fn request_override(
        &mut self,
        project_id: i64,
        reason: String,
        extra_minutes: i64,
    ) -> bool {
        let timestamp = chrono::Local::now().to_rfc3339();

        let override_entry = EmergencyOverride {
            project_id,
            reason: reason.clone(),
            timestamp: timestamp.clone(),
            extra_minutes,
        };

        self.emergency_overrides.push(override_entry.clone());

        // Log to database
        if let Ok(conn) = Connection::open(&self.db_path) {
            let _ = conn.execute(
                "INSERT INTO enforcement_overrides (project_id, reason, timestamp, extra_minutes) VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![project_id, reason, timestamp, extra_minutes],
            );
        }

        // Clear dismissed state so the next escalation level will trigger
        self.dismissed_warnings.remove(&project_id);

        // Reset warning level to allow re-evaluation
        if let Some(level) = self.warning_levels.get(&project_id) {
            // Step back one level so the system can re-alert at higher level
            let new_severity = if level.severity() > 1 {
                level.severity() - 1
            } else {
                0
            };
            let new_level = match new_severity {
                0 => WarningLevel::None,
                1 => WarningLevel::Gentle,
                2 => WarningLevel::Firm,
                3 => WarningLevel::Aggressive,
                _ => WarningLevel::Critical,
            };
            self.warning_levels.insert(project_id, new_level);
        }

        true
    }

    /// Dismiss a warning for a project (it will escalate on next check)
    pub fn dismiss_warning(&mut self, project_id: i64) -> bool {
        if let Some(level) = self.warning_levels.get(&project_id) {
            self.dismissed_warnings.insert(project_id, level.clone());
            true
        } else {
            false
        }
    }

    /// Record that user took a break
    pub fn record_break(&mut self) {
        self.last_break_time = Some(chrono::Local::now());
    }

    /// Get minutes since last break
    pub fn minutes_since_last_break(&self) -> i64 {
        let reference = self.last_break_time.unwrap_or(self.session_start);
        let now = chrono::Local::now();
        (now - reference).num_minutes()
    }

    /// Check if an emergency override is still active (within extra_minutes window)
    fn is_override_active(&self, o: &EmergencyOverride) -> bool {
        if let Ok(ts) = chrono::DateTime::parse_from_rfc3339(&o.timestamp) {
            let expires = ts + chrono::Duration::minutes(o.extra_minutes);
            chrono::Local::now() < expires.with_timezone(&chrono::Local)
        } else {
            false
        }
    }

    /// Get overtime stats for all projects
    pub fn get_overtime_stats(&self) -> Vec<OvertimeInfo> {
        let conn = match Connection::open(&self.db_path) {
            Ok(c) => c,
            Err(_) => return Vec::new(),
        };

        let projects = match queries::get_all_projects(&conn) {
            Ok(p) => p,
            Err(_) => return Vec::new(),
        };

        let mut stats = Vec::new();

        for project in projects {
            if project.daily_budget_minutes <= 0 {
                continue;
            }

            let used = queries::get_project_today_minutes(&conn, project.id).unwrap_or(0);
            let overtime = if used > project.daily_budget_minutes {
                used - project.daily_budget_minutes
            } else {
                0
            };
            let percentage = if project.daily_budget_minutes > 0 {
                (used as f64 / project.daily_budget_minutes as f64) * 100.0
            } else {
                0.0
            };

            stats.push(OvertimeInfo {
                project_name: project.name,
                budget_minutes: project.daily_budget_minutes,
                actual_minutes: used,
                overtime_minutes: overtime,
                percentage,
            });
        }

        stats
    }

    /// Get all emergency overrides
    pub fn get_overrides(&self) -> Vec<EmergencyOverride> {
        // Also load from DB for persistence
        let mut all = self.emergency_overrides.clone();

        if let Ok(conn) = Connection::open(&self.db_path) {
            let today = chrono::Local::now().format("%Y-%m-%d").to_string();
            if let Ok(mut stmt) = conn.prepare(
                "SELECT project_id, reason, timestamp, extra_minutes FROM enforcement_overrides WHERE timestamp LIKE ?1 ORDER BY timestamp DESC",
            ) {
                if let Ok(rows) = stmt.query_map(rusqlite::params![format!("{}%", today)], |row| {
                    Ok(EmergencyOverride {
                        project_id: row.get(0)?,
                        reason: row.get(1)?,
                        timestamp: row.get(2)?,
                        extra_minutes: row.get(3)?,
                    })
                }) {
                    for r in rows.flatten() {
                        // Avoid duplicates
                        if !all.iter().any(|o| o.timestamp == r.timestamp && o.project_id == r.project_id) {
                            all.push(r);
                        }
                    }
                }
            }
        }

        all
    }

    /// Get all active warning levels
    pub fn get_active_warnings(&self) -> &HashMap<i64, WarningLevel> {
        &self.warning_levels
    }

    /// Set enforcement level
    pub fn set_enforcement_level(&mut self, level: String) -> bool {
        match level.as_str() {
            "gentle" | "strict" | "extreme" => {
                self.enforcement_level = level;
                true
            }
            _ => false,
        }
    }

    /// Get enforcement level
    pub fn get_enforcement_level(&self) -> &str {
        &self.enforcement_level
    }

    /// Set break interval
    pub fn set_break_interval(&mut self, minutes: i64) {
        self.break_interval_minutes = minutes;
    }

    /// Set daily max hours
    pub fn set_daily_max_hours(&mut self, hours: i64) {
        self.daily_max_hours = hours;
    }

    /// Get break interval
    pub fn get_break_interval(&self) -> i64 {
        self.break_interval_minutes
    }

    /// Get daily max hours
    pub fn get_daily_max_hours(&self) -> i64 {
        self.daily_max_hours
    }

    /// Get last break time
    pub fn get_last_break_time(&self) -> Option<String> {
        self.last_break_time.map(|t| t.to_rfc3339())
    }

    /// Reset daily state (call at midnight)
    pub fn reset_daily(&mut self) {
        self.warning_levels.clear();
        self.dismissed_warnings.clear();
        self.emergency_overrides.clear();
        self.last_break_time = None;
        self.session_start = chrono::Local::now();
    }

    /// Initialize enforcement tables in the database
    pub fn initialize_enforcement_tables(conn: &Connection) -> rusqlite::Result<()> {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS enforcement_overrides (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                reason TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                extra_minutes INTEGER NOT NULL
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS enforcement_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER,
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                dismissed INTEGER DEFAULT 0
            )",
            [],
        )?;

        Ok(())
    }
}
