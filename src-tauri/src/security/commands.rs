use crate::commands::AppState;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct DataIntegrityReport {
    pub total_records: i64,
    pub orphaned_activity_logs: i64,
    pub duplicate_entries: i64,
    pub invalid_timestamps: i64,
    pub zero_duration_entries: i64,
    pub database_size_mb: f64,
    pub issues: Vec<IntegrityIssue>,
}

#[derive(Debug, Clone, Serialize)]
pub struct IntegrityIssue {
    pub severity: String,
    pub table: String,
    pub description: String,
    pub affected_rows: i64,
    pub fixable: bool,
}

#[tauri::command]
pub fn check_data_integrity(state: tauri::State<'_, AppState>) -> DataIntegrityReport {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return DataIntegrityReport::default(),
    };

    // Check for orphaned activity logs
    let orphaned = conn
        .query_row(
            "SELECT COUNT(*) FROM activity_logs WHERE project_id IS NOT NULL AND project_id NOT IN (SELECT id FROM projects)",
            [],
            |row| row.get::<_, i64>(0),
        )
        .unwrap_or(0);

    // Check for duplicate entries (same timestamp + process_name)
    let duplicates = conn
        .query_row(
            "SELECT COUNT(*) FROM activity_logs a1 WHERE EXISTS (SELECT 1 FROM activity_logs a2 WHERE a2.id != a1.id AND a2.timestamp = a1.timestamp AND a2.process_name = a1.process_name)",
            [],
            |row| row.get::<_, i64>(0),
        )
        .unwrap_or(0);

    // Check for zero-duration entries
    let zero_duration = conn
        .query_row(
            "SELECT COUNT(*) FROM activity_logs WHERE duration_seconds = 0",
            [],
            |row| row.get::<_, i64>(0),
        )
        .unwrap_or(0);

    // Check for future timestamps
    let invalid_ts = conn
        .query_row(
            "SELECT COUNT(*) FROM activity_logs WHERE timestamp > datetime('now', '+1 hour', 'localtime')",
            [],
            |row| row.get::<_, i64>(0),
        )
        .unwrap_or(0);

    // Total records
    let total = conn
        .query_row("SELECT COUNT(*) FROM activity_logs", [], |row| {
            row.get::<_, i64>(0)
        })
        .unwrap_or(0);

    // DB file size
    let db_size = std::fs::metadata(&state.db_path)
        .map(|m| m.len() as f64 / (1024.0 * 1024.0))
        .unwrap_or(0.0);

    let mut issues = Vec::new();
    if orphaned > 0 {
        issues.push(IntegrityIssue {
            severity: "medium".to_string(),
            table: "activity_logs".to_string(),
            description: format!("{} kayit silinmis projelere isaret ediyor", orphaned),
            affected_rows: orphaned,
            fixable: true,
        });
    }
    if zero_duration > 100 {
        issues.push(IntegrityIssue {
            severity: "low".to_string(),
            table: "activity_logs".to_string(),
            description: format!("{} kayit sifir sureli (gereksiz veri)", zero_duration),
            affected_rows: zero_duration,
            fixable: true,
        });
    }
    if invalid_ts > 0 {
        issues.push(IntegrityIssue {
            severity: "high".to_string(),
            table: "activity_logs".to_string(),
            description: format!("{} kayit gelecek tarihli (gecersiz zaman damgasi)", invalid_ts),
            affected_rows: invalid_ts,
            fixable: false,
        });
    }
    if duplicates > 0 {
        issues.push(IntegrityIssue {
            severity: "low".to_string(),
            table: "activity_logs".to_string(),
            description: format!("{} tekrarlanan kayit bulundu", duplicates),
            affected_rows: duplicates,
            fixable: false,
        });
    }

    DataIntegrityReport {
        total_records: total,
        orphaned_activity_logs: orphaned,
        duplicate_entries: duplicates,
        invalid_timestamps: invalid_ts,
        zero_duration_entries: zero_duration,
        database_size_mb: db_size,
        issues,
    }
}

#[tauri::command]
pub fn fix_data_integrity(state: tauri::State<'_, AppState>) -> i64 {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return 0,
    };
    let mut fixed = 0i64;

    // Fix orphaned logs - set project_id to NULL
    fixed += conn
        .execute(
            "UPDATE activity_logs SET project_id = NULL WHERE project_id IS NOT NULL AND project_id NOT IN (SELECT id FROM projects)",
            [],
        )
        .unwrap_or(0) as i64;

    // Delete zero-duration entries older than 7 days
    fixed += conn
        .execute(
            "DELETE FROM activity_logs WHERE duration_seconds = 0 AND timestamp < datetime('now', '-7 days', 'localtime')",
            [],
        )
        .unwrap_or(0) as i64;

    // Vacuum to reclaim space
    let _ = conn.execute_batch("VACUUM;");

    fixed
}

#[tauri::command]
pub fn cleanup_old_data(state: tauri::State<'_, AppState>, days: i64) -> i64 {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return 0,
    };

    let safe_days = days.max(30); // minimum 30 days retention
    let cutoff = format!("-{} days", safe_days);
    let deleted = conn
        .execute(
            &format!(
                "DELETE FROM activity_logs WHERE timestamp < datetime('now', '{}', 'localtime')",
                cutoff
            ),
            [],
        )
        .unwrap_or(0) as i64;

    let _ = conn.execute_batch("VACUUM;");
    deleted
}

impl Default for DataIntegrityReport {
    fn default() -> Self {
        Self {
            total_records: 0,
            orphaned_activity_logs: 0,
            duplicate_entries: 0,
            invalid_timestamps: 0,
            zero_duration_entries: 0,
            database_size_mb: 0.0,
            issues: Vec::new(),
        }
    }
}
