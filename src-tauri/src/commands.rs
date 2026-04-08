use std::sync::{Arc, Mutex};
use crate::db::queries;
use crate::models::*;

pub struct AppState {
    pub tracker_state: Arc<Mutex<TrackerState>>,
    pub db_path: String,
}

#[tauri::command]
pub fn get_current_state(state: tauri::State<'_, AppState>) -> TrackerState {
    state.tracker_state.lock().unwrap().clone()
}

#[tauri::command]
pub fn get_today_timeline(state: tauri::State<'_, AppState>) -> Vec<TimelineEntry> {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    queries::get_today_timeline(&conn).unwrap_or_default()
}

#[tauri::command]
pub fn get_today_summary(state: tauri::State<'_, AppState>) -> Vec<DailySummary> {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    queries::get_today_summary(&conn).unwrap_or_default()
}

#[tauri::command]
pub fn get_projects(state: tauri::State<'_, AppState>) -> Vec<Project> {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    queries::get_all_projects(&conn).unwrap_or_default()
}

#[tauri::command]
pub fn get_git_events(state: tauri::State<'_, AppState>, project_id: i64, date: String) -> Vec<GitEvent> {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    queries::get_git_events_for_project(&conn, project_id, &date).unwrap_or_default()
}

#[tauri::command]
pub fn get_weekly_trends(state: tauri::State<'_, AppState>) -> WeeklyTrends {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return WeeklyTrends { days: Vec::new() },
    };
    WeeklyTrends {
        days: queries::get_weekly_trends(&conn).unwrap_or_default(),
    }
}

#[tauri::command]
pub fn set_project_budget(state: tauri::State<'_, AppState>, project_id: i64, minutes: i64) -> bool {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return false,
    };
    queries::set_project_budget(&conn, project_id, minutes).is_ok()
}

#[tauri::command]
pub fn pause_tracking(state: tauri::State<'_, AppState>) {
    let mut s = state.tracker_state.lock().unwrap();
    s.is_tracking = false;
}

#[tauri::command]
pub fn resume_tracking(state: tauri::State<'_, AppState>) {
    let mut s = state.tracker_state.lock().unwrap();
    s.is_tracking = true;
}

#[tauri::command]
pub fn save_setting(state: tauri::State<'_, AppState>, key: String, value: String) -> bool {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return false,
    };
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        rusqlite::params![key, value],
    ).is_ok()
}

#[tauri::command]
pub fn get_setting(state: tauri::State<'_, AppState>, key: String) -> Option<String> {
    let conn = rusqlite::Connection::open(&state.db_path).ok()?;
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        rusqlite::params![key],
        |row| row.get(0),
    ).ok()
}
