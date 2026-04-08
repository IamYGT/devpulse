use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaySummary {
    pub date: String,
    pub total_minutes: i64,
    pub productive_minutes: i64,
    pub commit_count: i64,
    pub productivity_score: f64,
}

/// Ensures the DevPulse export directory exists under user's Documents folder.
fn get_export_dir() -> Result<PathBuf, String> {
    let docs = dirs_next()
        .ok_or_else(|| "Belgeler klasoru bulunamadi".to_string())?;
    let export_dir = docs.join("DevPulse");
    fs::create_dir_all(&export_dir)
        .map_err(|e| format!("Klasor olusturulamadi: {}", e))?;
    Ok(export_dir)
}

/// Returns user's Documents directory path on Windows.
fn dirs_next() -> Option<PathBuf> {
    // Use USERPROFILE env on Windows, fallback to home_dir
    if let Ok(profile) = std::env::var("USERPROFILE") {
        let docs = PathBuf::from(profile).join("Documents");
        if docs.exists() {
            return Some(docs);
        }
    }
    // Fallback
    #[allow(deprecated)]
    std::env::home_dir().map(|h| h.join("Documents"))
}

/// Export activity logs as CSV for a date range. Returns the file path on success.
pub fn export_activities_csv(
    conn: &Connection,
    date_from: &str,
    date_to: &str,
) -> Result<String, String> {
    let export_dir = get_export_dir()?;
    let filename = format!("devpulse_{}_{}.csv", date_from, date_to);
    let file_path = export_dir.join(&filename);

    let mut stmt = conn
        .prepare(
            "SELECT a.timestamp, a.window_title, a.process_name, p.name, a.category,
                    a.duration_seconds, a.is_idle
             FROM activity_logs a
             LEFT JOIN projects p ON a.project_id = p.id
             WHERE date(a.timestamp) >= ?1 AND date(a.timestamp) <= ?2
             ORDER BY a.timestamp",
        )
        .map_err(|e| format!("Sorgu hatasi: {}", e))?;

    let rows = stmt
        .query_map(params![date_from, date_to], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                row.get::<_, String>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, i32>(6)?,
            ))
        })
        .map_err(|e| format!("Sorgu hatasi: {}", e))?;

    let mut csv_content =
        String::from("timestamp,window_title,process_name,project,category,duration_seconds,is_idle\n");

    for row in rows {
        let (timestamp, window_title, process_name, project, category, duration, is_idle) =
            row.map_err(|e| format!("Satir hatasi: {}", e))?;
        // Escape CSV fields that might contain commas or quotes
        let escape = |s: &str| -> String {
            if s.contains(',') || s.contains('"') || s.contains('\n') {
                format!("\"{}\"", s.replace('"', "\"\""))
            } else {
                s.to_string()
            }
        };
        csv_content.push_str(&format!(
            "{},{},{},{},{},{},{}\n",
            escape(&timestamp),
            escape(&window_title),
            escape(&process_name),
            escape(&project),
            escape(&category),
            duration,
            is_idle
        ));
    }

    fs::write(&file_path, &csv_content)
        .map_err(|e| format!("Dosya yazma hatasi: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

/// Export activity logs as JSON for a date range. Returns the file path on success.
pub fn export_activities_json(
    conn: &Connection,
    date_from: &str,
    date_to: &str,
) -> Result<String, String> {
    let export_dir = get_export_dir()?;
    let filename = format!("devpulse_{}_{}.json", date_from, date_to);
    let file_path = export_dir.join(&filename);

    let mut stmt = conn
        .prepare(
            "SELECT a.timestamp, a.window_title, a.process_name, p.name, a.category,
                    a.duration_seconds, a.is_idle
             FROM activity_logs a
             LEFT JOIN projects p ON a.project_id = p.id
             WHERE date(a.timestamp) >= ?1 AND date(a.timestamp) <= ?2
             ORDER BY a.timestamp",
        )
        .map_err(|e| format!("Sorgu hatasi: {}", e))?;

    let rows = stmt
        .query_map(params![date_from, date_to], |row| {
            Ok(serde_json::json!({
                "timestamp": row.get::<_, String>(0)?,
                "window_title": row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                "process_name": row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                "project": row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                "category": row.get::<_, String>(4)?,
                "duration_seconds": row.get::<_, i64>(5)?,
                "is_idle": row.get::<_, i32>(6)? != 0,
            }))
        })
        .map_err(|e| format!("Sorgu hatasi: {}", e))?;

    let mut entries = Vec::new();
    for row in rows {
        entries.push(row.map_err(|e| format!("Satir hatasi: {}", e))?);
    }

    let json_content = serde_json::to_string_pretty(&entries)
        .map_err(|e| format!("JSON hatasi: {}", e))?;

    fs::write(&file_path, &json_content)
        .map_err(|e| format!("Dosya yazma hatasi: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

/// Generate a markdown daily report for a given date.
pub fn generate_daily_report(conn: &Connection, date: &str) -> String {
    let date_pattern = format!("{}%", date);

    // Total time and productive/distracting breakdown
    let (total_min, productive_min, distracting_min): (i64, i64, i64) = conn
        .query_row(
            "SELECT
                COALESCE(SUM(duration_seconds) / 60, 0),
                COALESCE(SUM(CASE WHEN category = 'productive' THEN duration_seconds ELSE 0 END) / 60, 0),
                COALESCE(SUM(CASE WHEN category = 'distracting' THEN duration_seconds ELSE 0 END) / 60, 0)
             FROM activity_logs
             WHERE timestamp LIKE ?1",
            params![date_pattern],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .unwrap_or((0, 0, 0));

    // Total commits
    let commit_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM git_events WHERE timestamp LIKE ?1",
            params![date_pattern],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let productivity_pct = if total_min > 0 {
        (productive_min as f64 / total_min as f64 * 100.0).round() as i64
    } else {
        0
    };

    let total_hours = total_min / 60;
    let total_remaining_min = total_min % 60;
    let prod_hours = productive_min / 60;
    let prod_remaining_min = productive_min % 60;

    let mut report = format!(
        "# DevPulse Gunluk Rapor - {}\n\n## Ozet\n- Toplam: {}s {}dk\n- Uretken: {}s {}dk (%{})\n- Dikkat Dagitici: {}dk\n- Commit: {} adet\n",
        date,
        total_hours, total_remaining_min,
        prod_hours, prod_remaining_min, productivity_pct,
        distracting_min,
        commit_count,
    );

    // Project breakdown
    let mut stmt = conn
        .prepare(
            "SELECT p.name,
                    COALESCE(SUM(a.duration_seconds) / 60, 0),
                    (SELECT COUNT(*) FROM git_events g WHERE g.project_id = a.project_id AND g.timestamp LIKE ?1)
             FROM activity_logs a
             LEFT JOIN projects p ON a.project_id = p.id
             WHERE a.timestamp LIKE ?1
             GROUP BY a.project_id
             ORDER BY SUM(a.duration_seconds) DESC",
        )
        .unwrap();

    let projects: Vec<(String, i64, i64)> = stmt
        .query_map(params![date_pattern], |row| {
            Ok((
                row.get::<_, Option<String>>(0)?.unwrap_or_else(|| "Diger".to_string()),
                row.get(1)?,
                row.get(2)?,
            ))
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    if !projects.is_empty() {
        report.push_str("\n## Proje Bazli\n");
        for (name, minutes, commits) in &projects {
            report.push_str(&format!("- {}: {}dk ({} commit)\n", name, minutes, commits));
        }
    }

    // Top apps
    let mut app_stmt = conn
        .prepare(
            "SELECT process_name, COALESCE(SUM(duration_seconds) / 60, 0) as mins
             FROM activity_logs
             WHERE timestamp LIKE ?1 AND process_name IS NOT NULL
             GROUP BY process_name
             ORDER BY mins DESC
             LIMIT 10",
        )
        .unwrap();

    let apps: Vec<(String, i64)> = app_stmt
        .query_map(params![date_pattern], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    if !apps.is_empty() {
        report.push_str("\n## En Cok Kullanilan Uygulamalar\n");
        for (i, (app, minutes)) in apps.iter().enumerate() {
            report.push_str(&format!("{}. {}: {}dk\n", i + 1, app, minutes));
        }
    }

    report
}

/// Get monthly data for the heatmap view.
pub fn get_monthly_data(conn: &Connection, year: i32, month: i32) -> Vec<DaySummary> {
    let date_prefix = format!("{:04}-{:02}", year, month);

    let mut stmt = match conn.prepare(
        "SELECT
            date(a.timestamp) as day,
            COALESCE(SUM(a.duration_seconds) / 60, 0),
            COALESCE(SUM(CASE WHEN a.category = 'productive' THEN a.duration_seconds ELSE 0 END) / 60, 0),
            (SELECT COUNT(*) FROM git_events g WHERE date(g.timestamp) = date(a.timestamp))
         FROM activity_logs a
         WHERE a.timestamp LIKE ?1
         GROUP BY day
         ORDER BY day",
    ) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    let result = match stmt.query_map(params![format!("{}%", date_prefix)], |row| {
        let total: f64 = row.get::<_, i64>(1)? as f64;
        let productive: f64 = row.get::<_, i64>(2)? as f64;
        let score = if total > 0.0 {
            (productive / total) * 100.0
        } else {
            0.0
        };
        Ok(DaySummary {
            date: row.get(0)?,
            total_minutes: row.get(1)?,
            productive_minutes: row.get(2)?,
            commit_count: row.get(3)?,
            productivity_score: score,
        })
    }) {
        Ok(rows) => rows.filter_map(|r| r.ok()).collect(),
        Err(_) => Vec::new(),
    };
    result
}
