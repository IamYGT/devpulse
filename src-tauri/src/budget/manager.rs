use rusqlite::Connection;
use crate::db::queries;

#[derive(Debug, Clone)]
pub struct BudgetAlert {
    pub project_name: String,
    pub used_minutes: i64,
    pub budget_minutes: i64,
    pub percentage: f64,
    pub alert_type: BudgetAlertType,
}

#[derive(Debug, Clone, PartialEq)]
pub enum BudgetAlertType {
    Warning80,  // 80% of budget used
    LimitReached, // 100% of budget used
}

pub struct BudgetManager {
    db_path: String,
    /// Track which alerts have been sent today to avoid repeating
    sent_alerts: std::collections::HashSet<String>,
}

impl BudgetManager {
    pub fn new(db_path: String) -> Self {
        Self {
            db_path,
            sent_alerts: std::collections::HashSet::new(),
        }
    }

    /// Check all projects with budgets and return any new alerts.
    pub fn check_budgets(&mut self) -> Vec<BudgetAlert> {
        let conn = match Connection::open(&self.db_path) {
            Ok(c) => c,
            Err(_) => return Vec::new(),
        };

        let projects = match queries::get_all_projects(&conn) {
            Ok(p) => p,
            Err(_) => return Vec::new(),
        };

        let mut alerts = Vec::new();

        for project in projects {
            if project.daily_budget_minutes <= 0 {
                continue; // No budget set
            }

            let used = match queries::get_project_today_minutes(&conn, project.id) {
                Ok(m) => m,
                Err(_) => continue,
            };

            let percentage = (used as f64 / project.daily_budget_minutes as f64) * 100.0;

            // Check 100% first
            let limit_key = format!("{}-100", project.id);
            if percentage >= 100.0 && !self.sent_alerts.contains(&limit_key) {
                alerts.push(BudgetAlert {
                    project_name: project.name.clone(),
                    used_minutes: used,
                    budget_minutes: project.daily_budget_minutes,
                    percentage,
                    alert_type: BudgetAlertType::LimitReached,
                });
                self.sent_alerts.insert(limit_key);
            }

            // Check 80%
            let warning_key = format!("{}-80", project.id);
            if percentage >= 80.0 && percentage < 100.0 && !self.sent_alerts.contains(&warning_key) {
                alerts.push(BudgetAlert {
                    project_name: project.name.clone(),
                    used_minutes: used,
                    budget_minutes: project.daily_budget_minutes,
                    percentage,
                    alert_type: BudgetAlertType::Warning80,
                });
                self.sent_alerts.insert(warning_key);
            }
        }

        alerts
    }

    /// Reset sent alerts (call at midnight).
    pub fn reset_daily(&mut self) {
        self.sent_alerts.clear();
    }
}
