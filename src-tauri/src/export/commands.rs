use crate::commands::AppState;
use crate::export::exporter::{self, DaySummary};

#[tauri::command]
pub fn export_data_csv(
    state: tauri::State<'_, AppState>,
    date_from: String,
    date_to: String,
) -> Result<String, String> {
    let conn = rusqlite::Connection::open(&state.db_path)
        .map_err(|e| format!("Veritabani hatasi: {}", e))?;
    exporter::export_activities_csv(&conn, &date_from, &date_to)
}

#[tauri::command]
pub fn export_data_json(
    state: tauri::State<'_, AppState>,
    date_from: String,
    date_to: String,
) -> Result<String, String> {
    let conn = rusqlite::Connection::open(&state.db_path)
        .map_err(|e| format!("Veritabani hatasi: {}", e))?;
    exporter::export_activities_json(&conn, &date_from, &date_to)
}

#[tauri::command]
pub fn generate_daily_report(
    state: tauri::State<'_, AppState>,
    date: String,
) -> String {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return String::from("Veritabani baglantisi kurulamadi."),
    };
    exporter::generate_daily_report(&conn, &date)
}

#[tauri::command]
pub fn get_monthly_summary(
    state: tauri::State<'_, AppState>,
    year: i32,
    month: i32,
) -> Vec<DaySummary> {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    exporter::get_monthly_data(&conn, year, month)
}
