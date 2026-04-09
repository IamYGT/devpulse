use serde::Serialize;
use std::sync::Mutex;

use super::manager::{EnforcementManager, WarningLevel};

/// Managed state for enforcement - must be registered with Tauri .manage()
pub struct EnforcementAppState {
    pub manager: Mutex<EnforcementManager>,
}

// --- Response structs ---

#[derive(Debug, Clone, Serialize)]
pub struct EnforcementStatus {
    pub active_warnings: Vec<ActiveWarning>,
    pub enforcement_level: String,
    pub break_due: bool,
    pub minutes_since_break: i64,
    pub daily_overtime_minutes: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ActiveWarning {
    pub project_name: String,
    pub project_id: i64,
    pub level: String,
    pub message: String,
    pub percentage: f64,
    pub suggested_project: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OvertimeInfo {
    pub project_name: String,
    pub budget_minutes: i64,
    pub actual_minutes: i64,
    pub overtime_minutes: i64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct BreakStatus {
    pub minutes_since_break: i64,
    pub break_recommended: bool,
    pub break_enforced: bool,
    pub last_break_time: Option<String>,
}

// --- Tauri commands ---

/// Get the current enforcement status including all active warnings
#[tauri::command]
pub fn get_enforcement_status(
    app_state: tauri::State<'_, crate::commands::AppState>,
    enforcement_state: tauri::State<'_, EnforcementAppState>,
) -> EnforcementStatus {
    let tracker_state = app_state.tracker_state.lock().unwrap().clone();
    let mut manager = enforcement_state.manager.lock().unwrap();

    // Run enforcement check
    let alerts = manager.check(&tracker_state);

    let active_warnings: Vec<ActiveWarning> = alerts
        .iter()
        .map(|a| {
            let suggested_project = if a.suggested_action.contains("projesine gec") {
                Some(a.suggested_action.replace(" projesine gec", ""))
            } else {
                None
            };

            ActiveWarning {
                project_name: a.project_name.clone(),
                project_id: a.project_id,
                level: a.level.as_str().to_string(),
                message: a.message.clone(),
                percentage: a.percentage,
                suggested_project,
            }
        })
        .collect();

    let minutes_since_break = manager.minutes_since_last_break();
    let break_due = minutes_since_break >= manager.get_break_interval();

    // Calculate daily overtime
    let daily_max_minutes = manager.get_daily_max_hours() * 60;
    let daily_overtime = if tracker_state.today_total_minutes > daily_max_minutes {
        tracker_state.today_total_minutes - daily_max_minutes
    } else {
        0
    };

    EnforcementStatus {
        active_warnings,
        enforcement_level: manager.get_enforcement_level().to_string(),
        break_due,
        minutes_since_break,
        daily_overtime_minutes: daily_overtime,
    }
}

/// Request an emergency override to continue working past budget
#[tauri::command]
pub fn request_emergency_override(
    enforcement_state: tauri::State<'_, EnforcementAppState>,
    project_id: i64,
    reason: String,
    extra_minutes: i64,
) -> bool {
    let mut manager = enforcement_state.manager.lock().unwrap();
    manager.request_override(project_id, reason, extra_minutes)
}

/// Get overtime report for all projects today
#[tauri::command]
pub fn get_overtime_report(
    enforcement_state: tauri::State<'_, EnforcementAppState>,
) -> Vec<OvertimeInfo> {
    let manager = enforcement_state.manager.lock().unwrap();
    let stats = manager.get_overtime_stats();

    stats
        .into_iter()
        .map(|s| OvertimeInfo {
            project_name: s.project_name,
            budget_minutes: s.budget_minutes,
            actual_minutes: s.actual_minutes,
            overtime_minutes: s.overtime_minutes,
            percentage: s.percentage,
        })
        .collect()
}

/// Get break status - when was last break, should user take one
#[tauri::command]
pub fn get_break_status(
    enforcement_state: tauri::State<'_, EnforcementAppState>,
) -> BreakStatus {
    let manager = enforcement_state.manager.lock().unwrap();
    let minutes = manager.minutes_since_last_break();
    let interval = manager.get_break_interval();

    BreakStatus {
        minutes_since_break: minutes,
        break_recommended: minutes >= interval,
        break_enforced: minutes >= interval * 2,
        last_break_time: manager.get_last_break_time(),
    }
}

/// Dismiss a warning for a project (it will escalate next check)
#[tauri::command]
pub fn dismiss_warning(
    enforcement_state: tauri::State<'_, EnforcementAppState>,
    project_id: i64,
) -> bool {
    let mut manager = enforcement_state.manager.lock().unwrap();
    manager.dismiss_warning(project_id)
}

/// Set enforcement level: "gentle", "strict", "extreme"
#[tauri::command]
pub fn set_enforcement_level(
    enforcement_state: tauri::State<'_, EnforcementAppState>,
    level: String,
) -> bool {
    let mut manager = enforcement_state.manager.lock().unwrap();
    manager.set_enforcement_level(level)
}

/// Record that user started a break
#[tauri::command]
pub fn record_break_start(
    enforcement_state: tauri::State<'_, EnforcementAppState>,
) -> bool {
    let mut manager = enforcement_state.manager.lock().unwrap();
    manager.record_break();
    true
}

/// Get override history for today
#[tauri::command]
pub fn get_override_history(
    enforcement_state: tauri::State<'_, EnforcementAppState>,
) -> Vec<super::manager::EmergencyOverride> {
    let manager = enforcement_state.manager.lock().unwrap();
    manager.get_overrides()
}

/// Set break interval in minutes
#[tauri::command]
pub fn set_break_interval(
    enforcement_state: tauri::State<'_, EnforcementAppState>,
    minutes: i64,
) -> bool {
    let mut manager = enforcement_state.manager.lock().unwrap();
    manager.set_break_interval(minutes);
    true
}

/// Set daily max hours
#[tauri::command]
pub fn set_daily_max_hours(
    enforcement_state: tauri::State<'_, EnforcementAppState>,
    hours: i64,
) -> bool {
    let mut manager = enforcement_state.manager.lock().unwrap();
    manager.set_daily_max_hours(hours);
    true
}
