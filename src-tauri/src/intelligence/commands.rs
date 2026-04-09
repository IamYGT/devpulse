use crate::commands::AppState;
use rusqlite::{params, Connection};
use serde::Serialize;

use super::morning_brief;
use super::report_card;

// ---- Smart Suggestion ----

#[derive(Serialize, Clone)]
pub struct SmartSuggestion {
    pub action: String,
    pub message: String,
    pub project_name: Option<String>,
    pub urgency: String,
}

// ---- Productivity Patterns ----

#[derive(Serialize, Clone)]
pub struct ProductivityPatterns {
    pub most_productive_hour: i32,
    pub least_productive_hour: i32,
    pub best_day_of_week: String,
    pub avg_focus_duration_minutes: i64,
    pub avg_daily_commits: f64,
    pub avg_daily_productive_hours: f64,
}

// ---- Commands ----

#[tauri::command]
pub fn get_morning_brief(
    state: tauri::State<'_, AppState>,
) -> morning_brief::MorningBrief {
    morning_brief::generate_morning_brief(&state.db_path)
}

#[tauri::command]
pub fn get_daily_report_card(
    state: tauri::State<'_, AppState>,
    date: String,
) -> report_card::DailyReportCard {
    report_card::generate_report_card(&state.db_path, &date)
}

#[tauri::command]
pub fn get_smart_suggestion(
    state: tauri::State<'_, AppState>,
) -> SmartSuggestion {
    generate_smart_suggestion(&state.db_path, &state.tracker_state)
}

#[tauri::command]
pub fn get_productivity_patterns(
    state: tauri::State<'_, AppState>,
) -> ProductivityPatterns {
    generate_productivity_patterns(&state.db_path)
}

// ---- Smart Suggestion Logic ----

fn generate_smart_suggestion(
    db_path: &str,
    tracker_state: &std::sync::Arc<std::sync::Mutex<crate::models::TrackerState>>,
) -> SmartSuggestion {
    let current_state = match tracker_state.lock() {
        Ok(s) => s.clone(),
        Err(p) => p.into_inner().clone(),
    };

    let conn = match Connection::open(db_path) {
        Ok(c) => c,
        Err(_) => {
            return SmartSuggestion {
                action: "keep_going".to_string(),
                message: "Veritabanina baglanilamadi, calisma devam et.".to_string(),
                project_name: None,
                urgency: "low".to_string(),
            };
        }
    };

    let today = chrono::Local::now().date_naive().format("%Y-%m-%d").to_string();
    let today_prefix = format!("{}%", today);

    // 1. Check if working too long without break (>90 min continuous)
    if current_state.elapsed_seconds > 5400 && !current_state.is_idle {
        return SmartSuggestion {
            action: "take_break".to_string(),
            message: format!(
                "{}dk oldu ara vermeden calisiyorsun. 5dk mola ver, gozlerini dinlendir.",
                current_state.elapsed_seconds / 60
            ),
            project_name: current_state.current_project.clone(),
            urgency: "high".to_string(),
        };
    }

    // 2. Check budget overflow - suggest switching project
    if current_state.budget_limit_minutes > 0
        && current_state.budget_used_minutes >= current_state.budget_limit_minutes
    {
        // Find an alternative project with remaining budget
        let alt_project: Option<String> = conn
            .query_row(
                "SELECT p.name FROM projects p
                 LEFT JOIN (
                     SELECT project_id, COALESCE(SUM(duration_seconds), 0) / 60 as used
                     FROM activity_logs
                     WHERE timestamp LIKE ?1 AND is_idle = 0
                     GROUP BY project_id
                 ) a ON p.id = a.project_id
                 WHERE p.daily_budget_minutes > 0
                   AND COALESCE(a.used, 0) < p.daily_budget_minutes
                   AND p.name != ?2
                 ORDER BY p.daily_budget_minutes - COALESCE(a.used, 0) DESC
                 LIMIT 1",
                params![today_prefix, current_state.current_project.as_deref().unwrap_or("")],
                |row| row.get(0),
            )
            .ok();

        let project_name = alt_project.clone().unwrap_or_else(|| "baska bir proje".to_string());

        return SmartSuggestion {
            action: "switch_project".to_string(),
            message: format!(
                "{} projesinin butcesi doldu! {} projesine gec.",
                current_state.current_project.as_deref().unwrap_or("Mevcut proje"),
                project_name
            ),
            project_name: alt_project,
            urgency: "high".to_string(),
        };
    }

    // 3. Check no commits for a while
    let last_commit_minutes: i64 = conn
        .query_row(
            "SELECT COALESCE(
                (julianday('now', 'localtime') - julianday(MAX(timestamp))) * 1440,
                999
             ) FROM git_events WHERE timestamp LIKE ?1",
            params![today_prefix],
            |row| row.get(0),
        )
        .unwrap_or(999);

    if last_commit_minutes > 120 && current_state.today_productive_minutes > 60 {
        return SmartSuggestion {
            action: "commit_changes".to_string(),
            message: format!(
                "Son {}dk'dir commit yok. Degisiklikleri kaydetmeyi unutma!",
                last_commit_minutes.min(999)
            ),
            project_name: current_state.current_project.clone(),
            urgency: "medium".to_string(),
        };
    }

    // 4. Check if idle for too long
    if current_state.is_idle && current_state.elapsed_seconds > 600 {
        return SmartSuggestion {
            action: "keep_going".to_string(),
            message: format!(
                "{}dk'dir bosta gorunuyorsun. Hazir oldugun zaman devam et!",
                current_state.elapsed_seconds / 60
            ),
            project_name: None,
            urgency: "low".to_string(),
        };
    }

    // 5. Check scheduled block that should have started
    let now_time = chrono::Local::now().format("%H:%M").to_string();
    let scheduled_project: Option<String> = conn
        .query_row(
            "SELECT p.name FROM schedule_blocks sb
             JOIN projects p ON sb.project_id = p.id
             WHERE sb.date = ?1
               AND sb.start_time <= ?2
               AND sb.end_time > ?2
               AND sb.status = 'planned'
             LIMIT 1",
            params![today, now_time],
            |row| row.get(0),
        )
        .ok();

    if let Some(ref sched_project) = scheduled_project {
        let current = current_state.current_project.as_deref().unwrap_or("");
        if current != sched_project {
            return SmartSuggestion {
                action: "switch_project".to_string(),
                message: format!(
                    "Planina gore simdi {} uzerinde calisman gerekiyor!",
                    sched_project
                ),
                project_name: Some(sched_project.clone()),
                urgency: "medium".to_string(),
            };
        }
    }

    // 6. Good productivity, encourage
    if current_state.productivity_percentage >= 75.0 && current_state.today_productive_minutes > 30 {
        return SmartSuggestion {
            action: "keep_going".to_string(),
            message: format!(
                "Harika gidiyorsun! %{:.0} verimlilik, bu odaklanmayi koru.",
                current_state.productivity_percentage
            ),
            project_name: current_state.current_project.clone(),
            urgency: "low".to_string(),
        };
    }

    // 7. Low productivity warning
    if current_state.productivity_percentage > 0.0
        && current_state.productivity_percentage < 30.0
        && current_state.today_total_minutes > 60
    {
        return SmartSuggestion {
            action: "keep_going".to_string(),
            message: format!(
                "Verimlilik %{:.0} - dikkat dagitici uygulamalari kapatmayi dene.",
                current_state.productivity_percentage
            ),
            project_name: None,
            urgency: "medium".to_string(),
        };
    }

    // Default: neutral encouragement
    SmartSuggestion {
        action: "keep_going".to_string(),
        message: "Calisma devam ediyor, guzel gidiyorsun!".to_string(),
        project_name: current_state.current_project.clone(),
        urgency: "low".to_string(),
    }
}

// ---- Productivity Patterns Logic ----

fn generate_productivity_patterns(db_path: &str) -> ProductivityPatterns {
    let conn = match Connection::open(db_path) {
        Ok(c) => c,
        Err(_) => {
            return ProductivityPatterns {
                most_productive_hour: 10,
                least_productive_hour: 15,
                best_day_of_week: "Pazartesi".to_string(),
                avg_focus_duration_minutes: 0,
                avg_daily_commits: 0.0,
                avg_daily_productive_hours: 0.0,
            };
        }
    };

    // Most productive hour (last 30 days)
    let most_productive_hour: i32 = conn
        .query_row(
            "SELECT CAST(substr(timestamp, 12, 2) AS INTEGER) as hour
             FROM activity_logs
             WHERE category = 'productive'
               AND timestamp >= date('now', '-30 days')
             GROUP BY hour
             ORDER BY SUM(duration_seconds) DESC
             LIMIT 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or(10);

    // Least productive hour
    let least_productive_hour: i32 = conn
        .query_row(
            "SELECT CAST(substr(timestamp, 12, 2) AS INTEGER) as hour
             FROM activity_logs
             WHERE category = 'distracting'
               AND timestamp >= date('now', '-30 days')
             GROUP BY hour
             ORDER BY SUM(duration_seconds) DESC
             LIMIT 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or(15);

    // Best day of week (0=Sunday, 6=Saturday in SQLite strftime)
    let best_day_num: i32 = conn
        .query_row(
            "SELECT CAST(strftime('%w', substr(timestamp, 1, 10)) AS INTEGER) as dow
             FROM activity_logs
             WHERE category = 'productive'
               AND timestamp >= date('now', '-30 days')
             GROUP BY dow
             ORDER BY SUM(duration_seconds) DESC
             LIMIT 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or(1);

    let best_day_of_week = match best_day_num {
        0 => "Pazar",
        1 => "Pazartesi",
        2 => "Sali",
        3 => "Carsamba",
        4 => "Persembe",
        5 => "Cuma",
        6 => "Cumartesi",
        _ => "Pazartesi",
    }
    .to_string();

    // Average focus duration (continuous productive sessions)
    let avg_focus_duration_minutes: i64 = conn
        .query_row(
            "SELECT COALESCE(AVG(duration_seconds) / 60, 0)
             FROM activity_logs
             WHERE category = 'productive'
               AND timestamp >= date('now', '-30 days')
               AND duration_seconds > 60",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Average daily commits (last 30 days)
    let total_commits_30d: f64 = conn
        .query_row(
            "SELECT CAST(COUNT(*) AS REAL)
             FROM git_events
             WHERE timestamp >= date('now', '-30 days')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0.0);
    let avg_daily_commits = total_commits_30d / 30.0;

    // Average daily productive hours (last 30 days)
    let total_productive_minutes_30d: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(duration_seconds), 0) / 60.0
             FROM activity_logs
             WHERE category = 'productive'
               AND timestamp >= date('now', '-30 days')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let active_days: f64 = conn
        .query_row(
            "SELECT CAST(COUNT(DISTINCT substr(timestamp, 1, 10)) AS REAL)
             FROM activity_logs
             WHERE category = 'productive'
               AND timestamp >= date('now', '-30 days')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(1.0);

    let avg_daily_productive_hours = if active_days > 0.0 {
        total_productive_minutes_30d / 60.0 / active_days
    } else {
        0.0
    };

    ProductivityPatterns {
        most_productive_hour,
        least_productive_hour,
        best_day_of_week,
        avg_focus_duration_minutes,
        avg_daily_commits,
        avg_daily_productive_hours,
    }
}
