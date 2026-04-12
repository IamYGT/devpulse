use std::sync::{Arc, Mutex};
use serde::Serialize;
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

// --- Extension data structs ---

#[derive(Debug, Clone, Serialize)]
pub struct BrowserTab {
    pub id: i64,
    pub timestamp: String,
    pub url: Option<String>,
    pub domain: Option<String>,
    pub title: Option<String>,
    pub duration_seconds: i64,
    pub category: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct VscodeEvent {
    pub id: i64,
    pub timestamp: String,
    pub workspace: Option<String>,
    pub active_file: Option<String>,
    pub language: Option<String>,
    pub branch: Option<String>,
    pub dirty_files: i32,
    pub open_tabs: i32,
    pub is_debugging: bool,
    pub terminal_active: bool,
    pub duration_seconds: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct LanguageTime {
    pub language: String,
    pub total_minutes: f64,
    pub percentage: f64,
}

// --- Extension data commands ---

#[tauri::command]
pub fn get_browser_history(state: tauri::State<'_, AppState>, date: String) -> Vec<BrowserTab> {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let date_start = format!("{}T00:00:00", date);
    let date_end = format!("{}T23:59:59", date);

    let mut stmt = match conn.prepare(
        "SELECT id, timestamp, url, domain, title, duration_seconds, category
         FROM browser_tabs
         WHERE timestamp >= ?1 AND timestamp <= ?2
         ORDER BY timestamp DESC",
    ) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    let rows = match stmt.query_map(rusqlite::params![date_start, date_end], |row| {
        Ok(BrowserTab {
            id: row.get(0)?,
            timestamp: row.get(1)?,
            url: row.get(2)?,
            domain: row.get(3)?,
            title: row.get(4)?,
            duration_seconds: row.get(5)?,
            category: row.get::<_, String>(6).unwrap_or_else(|_| "neutral".to_string()),
        })
    }) {
        Ok(r) => r,
        Err(_) => return Vec::new(),
    };

    rows.filter_map(|r| r.ok()).collect()
}

#[tauri::command]
pub fn get_vscode_history(state: tauri::State<'_, AppState>, date: String) -> Vec<VscodeEvent> {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let date_start = format!("{}T00:00:00", date);
    let date_end = format!("{}T23:59:59", date);

    let mut stmt = match conn.prepare(
        "SELECT id, timestamp, workspace, active_file, language, branch,
                dirty_files, open_tabs, is_debugging, terminal_active, duration_seconds
         FROM vscode_events
         WHERE timestamp >= ?1 AND timestamp <= ?2
         ORDER BY timestamp DESC",
    ) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    let rows = match stmt.query_map(rusqlite::params![date_start, date_end], |row| {
        Ok(VscodeEvent {
            id: row.get(0)?,
            timestamp: row.get(1)?,
            workspace: row.get(2)?,
            active_file: row.get(3)?,
            language: row.get(4)?,
            branch: row.get(5)?,
            dirty_files: row.get(6)?,
            open_tabs: row.get(7)?,
            is_debugging: row.get::<_, i32>(8).unwrap_or(0) != 0,
            terminal_active: row.get::<_, i32>(9).unwrap_or(0) != 0,
            duration_seconds: row.get(10)?,
        })
    }) {
        Ok(r) => r,
        Err(_) => return Vec::new(),
    };

    rows.filter_map(|r| r.ok()).collect()
}

#[tauri::command]
pub fn get_language_breakdown(state: tauri::State<'_, AppState>, date: String) -> Vec<LanguageTime> {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let date_start = format!("{}T00:00:00", date);
    let date_end = format!("{}T23:59:59", date);

    let mut stmt = match conn.prepare(
        "SELECT language, COUNT(*) as event_count
         FROM vscode_events
         WHERE timestamp >= ?1 AND timestamp <= ?2
           AND language IS NOT NULL AND language != ''
         GROUP BY language
         ORDER BY event_count DESC",
    ) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    let rows: Vec<(String, f64)> = match stmt.query_map(rusqlite::params![date_start, date_end], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, f64>(1)?,
        ))
    }) {
        Ok(r) => r.filter_map(|r| r.ok()).collect(),
        Err(_) => return Vec::new(),
    };

    let total: f64 = rows.iter().map(|(_, count)| count).sum();

    rows.into_iter()
        .map(|(lang, count)| {
            let percentage = if total > 0.0 {
                (count / total) * 100.0
            } else {
                0.0
            };
            LanguageTime {
                language: lang,
                total_minutes: count, // each event ~= interval of tracking
                percentage,
            }
        })
        .collect()
}

// --- Extension status ---

#[derive(Debug, Clone, Serialize, Default)]
pub struct ExtensionStatus {
    pub chrome_connected: bool,
    pub chrome_last_event: Option<String>,
    pub chrome_today_events: i64,
    pub vscode_connected: bool,
    pub vscode_last_event: Option<String>,
    pub vscode_today_events: i64,
}

#[tauri::command]
pub fn check_extension_status(state: tauri::State<'_, AppState>) -> ExtensionStatus {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return ExtensionStatus::default(),
    };

    let chrome_last = conn.query_row(
        "SELECT timestamp FROM browser_tabs ORDER BY id DESC LIMIT 1",
        [],
        |row| row.get::<_, String>(0),
    ).ok();

    let vscode_last = conn.query_row(
        "SELECT timestamp FROM vscode_events ORDER BY id DESC LIMIT 1",
        [],
        |row| row.get::<_, String>(0),
    ).ok();

    let today_prefix = format!("{}%", chrono::Local::now().format("%Y-%m-%d"));

    let chrome_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM browser_tabs WHERE timestamp LIKE ?1",
        rusqlite::params![today_prefix],
        |row| row.get(0),
    ).unwrap_or(0);

    let vscode_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM vscode_events WHERE timestamp LIKE ?1",
        rusqlite::params![today_prefix],
        |row| row.get(0),
    ).unwrap_or(0);

    // Consider "connected" if last event was within 30 seconds
    let now = chrono::Local::now();
    let chrome_connected = chrome_last.as_ref().map_or(false, |ts| {
        chrono::NaiveDateTime::parse_from_str(ts, "%Y-%m-%dT%H:%M:%S%.f")
            .or_else(|_| chrono::NaiveDateTime::parse_from_str(ts, "%Y-%m-%d %H:%M:%S"))
            .map_or(false, |t| (now.naive_local() - t).num_seconds() < 30)
    });
    let vscode_connected = vscode_last.as_ref().map_or(false, |ts| {
        chrono::NaiveDateTime::parse_from_str(ts, "%Y-%m-%dT%H:%M:%S%.f")
            .or_else(|_| chrono::NaiveDateTime::parse_from_str(ts, "%Y-%m-%d %H:%M:%S"))
            .map_or(false, |t| (now.naive_local() - t).num_seconds() < 30)
    });

    ExtensionStatus {
        chrome_connected,
        chrome_last_event: chrome_last,
        chrome_today_events: chrome_count,
        vscode_connected,
        vscode_last_event: vscode_last,
        vscode_today_events: vscode_count,
    }
}

#[tauri::command]
pub fn open_extensions_folder(state: tauri::State<'_, AppState>, folder: String) -> bool {
    // Get the app install directory from the executable path
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."));

    // Try multiple locations: next to exe, project source dir, appdata
    let candidates = vec![
        exe_dir.join("extensions").join(&folder),
        exe_dir.parent().unwrap_or(&exe_dir).join("extensions").join(&folder),
        // Source project location
        std::path::PathBuf::from(r"C:\Users\ETETB\OneDrive\Desktop\ygt\devpulse\extensions").join(&folder),
    ];

    for path in &candidates {
        if path.exists() {
            return std::process::Command::new("explorer.exe")
                .arg(path.to_string_lossy().to_string())
                .spawn()
                .is_ok();
        }
    }

    // Fallback: open the DB directory
    let db_dir = std::path::Path::new(&state.db_path)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| ".".to_string());
    std::process::Command::new("explorer.exe")
        .arg(&db_dir)
        .spawn()
        .is_ok()
}

// --- Missing commands that frontend calls ---

#[tauri::command]
pub fn open_data_folder(state: tauri::State<'_, AppState>) -> bool {
    let db_dir = std::path::Path::new(&state.db_path)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| ".".to_string());
    std::process::Command::new("explorer.exe")
        .arg(&db_dir)
        .spawn()
        .is_ok()
}

#[tauri::command]
pub fn save_project_note(state: tauri::State<'_, AppState>, project_id: i64, text: String) -> bool {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return false,
    };
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS project_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            timestamp TEXT DEFAULT (datetime('now', 'localtime'))
        )"
    ).ok();
    conn.execute(
        "INSERT INTO project_notes (project_id, text) VALUES (?1, ?2)",
        rusqlite::params![project_id, text],
    ).is_ok()
}

#[tauri::command]
pub fn get_project_notes(state: tauri::State<'_, AppState>, project_id: i64) -> Vec<ProjectNote> {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS project_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            timestamp TEXT DEFAULT (datetime('now', 'localtime'))
        )"
    ).ok();
    let result: Vec<ProjectNote> = (|| {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, text, timestamp FROM project_notes WHERE project_id = ?1 ORDER BY id DESC LIMIT 20"
        ).ok()?;
        let rows = stmt.query_map(rusqlite::params![project_id], |row| {
            Ok(ProjectNote {
                id: row.get(0)?,
                project_id: row.get(1)?,
                text: row.get(2)?,
                timestamp: row.get(3)?,
            })
        }).ok()?;
        Some(rows.filter_map(|r| r.ok()).collect())
    })().unwrap_or_default();
    result
}

#[derive(Debug, Clone, Serialize)]
pub struct ProjectNote {
    pub id: i64,
    pub project_id: i64,
    pub text: String,
    pub timestamp: String,
}

#[tauri::command]
pub fn set_active_project(state: tauri::State<'_, AppState>, project_id: i64) -> bool {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return false,
    };
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('active_project_id', ?1)",
        rusqlite::params![project_id.to_string()],
    ).is_ok()
}

#[tauri::command]
pub fn set_idle_threshold(state: tauri::State<'_, AppState>, seconds: i64) -> bool {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return false,
    };
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('idle_threshold', ?1)",
        rusqlite::params![seconds.to_string()],
    ).is_ok()
}

#[tauri::command]
pub fn set_autostart(_state: tauri::State<'_, AppState>, _enabled: bool) -> bool {
    // Autostart is handled by tauri-plugin-autostart
    // This command exists for frontend compatibility
    true
}

#[tauri::command]
pub fn get_project_last_active(state: tauri::State<'_, AppState>, project_id: i64) -> Option<String> {
    let conn = rusqlite::Connection::open(&state.db_path).ok()?;
    conn.query_row(
        "SELECT timestamp FROM activity_logs WHERE project_id = ?1 ORDER BY id DESC LIMIT 1",
        rusqlite::params![project_id],
        |row| row.get(0),
    ).ok()
}

#[tauri::command]
pub fn get_project_week_commits(state: tauri::State<'_, AppState>, project_id: i64) -> i64 {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return 0,
    };
    conn.query_row(
        "SELECT COUNT(*) FROM git_events WHERE project_id = ?1 AND timestamp >= datetime('now', '-7 days', 'localtime')",
        rusqlite::params![project_id],
        |row| row.get(0),
    ).unwrap_or(0)
}

#[tauri::command]
pub fn get_weekly_summaries(state: tauri::State<'_, AppState>) -> Vec<WeeklySummaryItem> {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    let result: Vec<WeeklySummaryItem> = (|| {
        let mut stmt = conn.prepare(
            "SELECT p.name,
                    COALESCE(SUM(CASE WHEN a.timestamp >= datetime('now', '-7 days', 'localtime') THEN a.duration_seconds ELSE 0 END), 0) / 60 as this_week,
                    COALESCE(SUM(CASE WHEN a.timestamp >= datetime('now', '-14 days', 'localtime') AND a.timestamp < datetime('now', '-7 days', 'localtime') THEN a.duration_seconds ELSE 0 END), 0) / 60 as last_week
             FROM projects p
             LEFT JOIN activity_logs a ON a.project_id = p.id
             GROUP BY p.id, p.name
             HAVING this_week > 0 OR last_week > 0
             ORDER BY this_week DESC"
        ).ok()?;
        let rows = stmt.query_map([], |row| {
            Ok(WeeklySummaryItem {
                project_name: row.get(0)?,
                this_week_minutes: row.get(1)?,
                last_week_minutes: row.get(2)?,
            })
        }).ok()?;
        Some(rows.filter_map(|r| r.ok()).collect())
    })().unwrap_or_default();
    result
}

#[derive(Debug, Clone, Serialize)]
pub struct WeeklySummaryItem {
    pub project_name: String,
    pub this_week_minutes: i64,
    pub last_week_minutes: i64,
}

#[tauri::command]
pub fn get_app_logs(_state: tauri::State<'_, AppState>) -> Vec<String> {
    let log_dir = std::env::var("APPDATA")
        .map(|p| std::path::PathBuf::from(p).join("com.ygtlabs.devpulse"))
        .unwrap_or_else(|_| std::path::PathBuf::from("."));
    let log_path = log_dir.join("devpulse.log");
    match std::fs::read_to_string(&log_path) {
        Ok(content) => content.lines().rev().take(100).map(String::from).collect(),
        Err(_) => vec!["Log dosyasi bulunamadi".to_string()],
    }
}
