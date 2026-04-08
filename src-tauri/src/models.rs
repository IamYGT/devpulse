use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub path: Option<String>,
    pub daily_budget_minutes: i64,
    pub category: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityLog {
    pub id: i64,
    pub timestamp: String,
    pub window_title: Option<String>,
    pub process_name: Option<String>,
    pub project_id: Option<i64>,
    pub category: String,
    pub duration_seconds: i64,
    pub is_idle: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitEvent {
    pub id: i64,
    pub timestamp: String,
    pub project_id: Option<i64>,
    pub commit_hash: Option<String>,
    pub branch: Option<String>,
    pub message: Option<String>,
    pub lines_added: i64,
    pub lines_removed: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailySummary {
    pub date: String,
    pub project_id: Option<i64>,
    pub project_name: Option<String>,
    pub total_minutes: i64,
    pub productive_minutes: i64,
    pub distracting_minutes: i64,
    pub idle_minutes: i64,
    pub commit_count: i64,
    pub productivity_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppCategory {
    pub id: i64,
    pub process_name: String,
    pub category: String,
    pub display_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackerState {
    pub is_tracking: bool,
    pub is_idle: bool,
    pub current_window_title: String,
    pub current_process_name: String,
    pub current_project: Option<String>,
    pub current_project_id: Option<i64>,
    pub current_file: Option<String>,
    pub current_branch: Option<String>,
    pub current_category: String,
    pub session_start: String,
    pub elapsed_seconds: i64,
    pub today_commits: i64,
    pub today_productive_minutes: i64,
    pub today_total_minutes: i64,
    pub productivity_percentage: f64,
    pub budget_used_minutes: i64,
    pub budget_limit_minutes: i64,
    pub current_url: Option<String>,
    pub current_domain: Option<String>,
    pub current_language: Option<String>,
    pub vscode_open_tabs: i32,
    pub vscode_dirty_files: i32,
    pub vscode_is_debugging: bool,
    pub vscode_terminal_active: bool,
    pub claude_is_active: bool,
    pub claude_session_minutes: i64,
}

impl Default for TrackerState {
    fn default() -> Self {
        Self {
            is_tracking: true,
            is_idle: false,
            current_window_title: String::new(),
            current_process_name: String::new(),
            current_project: None,
            current_project_id: None,
            current_file: None,
            current_branch: None,
            current_category: "neutral".to_string(),
            session_start: chrono::Local::now().to_rfc3339(),
            elapsed_seconds: 0,
            today_commits: 0,
            today_productive_minutes: 0,
            today_total_minutes: 0,
            productivity_percentage: 0.0,
            budget_used_minutes: 0,
            budget_limit_minutes: 0,
            current_url: None,
            current_domain: None,
            current_language: None,
            vscode_open_tabs: 0,
            vscode_dirty_files: 0,
            vscode_is_debugging: false,
            vscode_terminal_active: false,
            claude_is_active: false,
            claude_session_minutes: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineEntry {
    pub timestamp: String,
    pub duration_seconds: i64,
    pub process_name: String,
    pub window_title: String,
    pub project_name: Option<String>,
    pub category: String,
    pub is_idle: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectStats {
    pub project: Project,
    pub today_minutes: i64,
    pub today_commits: i64,
    pub current_branch: Option<String>,
    pub budget_percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeeklyTrends {
    pub days: Vec<DayTrend>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DayTrend {
    pub date: String,
    pub total_minutes: i64,
    pub productive_minutes: i64,
    pub distracting_minutes: i64,
    pub commit_count: i64,
    pub productivity_score: f64,
}
