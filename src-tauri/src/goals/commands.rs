use crate::commands::AppState;
use super::streaks;
use super::daily_goals;

#[tauri::command]
pub fn get_streaks(state: tauri::State<'_, AppState>) -> Vec<streaks::StreakInfo> {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };
    streaks::get_all_streaks(&conn).unwrap_or_default()
}

#[tauri::command]
pub fn set_daily_goal(state: tauri::State<'_, AppState>, goal_type: String, target: f64) -> bool {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return false,
    };
    daily_goals::set_goal(&conn, &goal_type, target).is_ok()
}

#[tauri::command]
pub fn get_daily_goals(state: tauri::State<'_, AppState>) -> Vec<daily_goals::DailyGoal> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };
    // Update progress before returning
    let _ = daily_goals::update_goal_progress(&conn, &today);
    daily_goals::get_goals_with_progress(&conn, &today).unwrap_or_default()
}
