use serde::Serialize;
use crate::commands::AppState;

#[derive(Debug, Clone, Serialize)]
pub struct DatabaseInfo {
    pub path: String,
    pub size_bytes: u64,
    pub last_modified: String,
    pub activity_count: i64,
    pub project_count: i64,
    pub git_event_count: i64,
}

fn get_backup_dir() -> String {
    let docs = std::env::var("USERPROFILE")
        .map(|p| std::path::PathBuf::from(p).join("Documents").join("DevPulse").join("backups"))
        .unwrap_or_else(|_| std::path::PathBuf::from("backups"));
    docs.to_string_lossy().to_string()
}

#[tauri::command]
pub fn backup_database(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let backup_dir = get_backup_dir();
    std::fs::create_dir_all(&backup_dir).map_err(|e| format!("Yedekleme klasoru olusturulamadi: {}", e))?;

    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let backup_path = format!("{}/devpulse_{}.db", backup_dir, timestamp);

    std::fs::copy(&state.db_path, &backup_path)
        .map_err(|e| format!("Veritabani kopyalanamadi: {}", e))?;

    Ok(backup_path)
}

#[tauri::command]
pub fn get_database_info(state: tauri::State<'_, AppState>) -> Result<DatabaseInfo, String> {
    let metadata = std::fs::metadata(&state.db_path)
        .map_err(|e| format!("Dosya bilgisi alinamadi: {}", e))?;

    let last_modified = metadata.modified()
        .map(|t| {
            let datetime: chrono::DateTime<chrono::Local> = t.into();
            datetime.format("%Y-%m-%d %H:%M:%S").to_string()
        })
        .unwrap_or_else(|_| "Bilinmiyor".to_string());

    let conn = rusqlite::Connection::open(&state.db_path)
        .map_err(|e| format!("Veritabani baglantisi hatasi: {}", e))?;

    let activity_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM activity_log",
        [],
        |row| row.get(0),
    ).unwrap_or(0);

    let project_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM projects",
        [],
        |row| row.get(0),
    ).unwrap_or(0);

    let git_event_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM git_events",
        [],
        |row| row.get(0),
    ).unwrap_or(0);

    Ok(DatabaseInfo {
        path: state.db_path.clone(),
        size_bytes: metadata.len(),
        last_modified,
        activity_count,
        project_count,
        git_event_count,
    })
}

#[tauri::command]
pub fn reset_database(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let conn = rusqlite::Connection::open(&state.db_path)
        .map_err(|e| format!("Veritabani baglantisi hatasi: {}", e))?;

    // Drop all data but keep schema
    let tables = vec![
        "activity_log",
        "git_events",
        "daily_summaries",
        "browser_tabs",
        "vscode_events",
        "settings",
    ];

    for table in tables {
        let sql = format!("DELETE FROM {}", table);
        conn.execute(&sql, []).ok();
    }

    Ok(true)
}

#[tauri::command]
pub fn restore_database(state: tauri::State<'_, AppState>, backup_path: String) -> Result<bool, String> {
    // Verify the backup file exists
    if !std::path::Path::new(&backup_path).exists() {
        return Err("Yedek dosyasi bulunamadi.".to_string());
    }

    // Copy backup over current database
    std::fs::copy(&backup_path, &state.db_path)
        .map_err(|e| format!("Veritabani geri yuklenemedi: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub fn get_backup_list() -> Vec<BackupEntry> {
    let backup_dir = get_backup_dir();
    let dir = match std::fs::read_dir(&backup_dir) {
        Ok(d) => d,
        Err(_) => return Vec::new(),
    };

    let mut entries: Vec<BackupEntry> = dir
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.ends_with(".db") || !name.starts_with("devpulse_") {
                return None;
            }
            let metadata = entry.metadata().ok()?;
            let modified = metadata.modified().ok().map(|t| {
                let datetime: chrono::DateTime<chrono::Local> = t.into();
                datetime.format("%Y-%m-%d %H:%M:%S").to_string()
            }).unwrap_or_default();

            Some(BackupEntry {
                filename: name,
                path: entry.path().to_string_lossy().to_string(),
                size_bytes: metadata.len(),
                created_at: modified,
            })
        })
        .collect();

    entries.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    entries
}

#[derive(Debug, Clone, Serialize)]
pub struct BackupEntry {
    pub filename: String,
    pub path: String,
    pub size_bytes: u64,
    pub created_at: String,
}
