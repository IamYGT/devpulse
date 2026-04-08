use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::commands::AppState;

#[derive(Serialize, Deserialize, Clone)]
pub struct HeatmapDay {
    pub date: String,
    pub total_minutes: i64,
    pub productivity_score: f64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CategoryBreakdown {
    pub category: String,
    pub total_minutes: i64,
    pub percentage: f64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AppUsage {
    pub process_name: String,
    pub display_name: Option<String>,
    pub total_minutes: i64,
    pub category: String,
}

#[tauri::command]
pub fn get_yearly_heatmap(state: tauri::State<'_, AppState>, year: i32) -> Vec<HeatmapDay> {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let mut stmt = match conn.prepare(
        "SELECT
            date(timestamp) as day,
            COALESCE(SUM(duration_seconds) / 60, 0) as total_min,
            COALESCE(SUM(CASE WHEN category = 'productive' THEN duration_seconds ELSE 0 END), 0) as prod_sec,
            COALESCE(SUM(duration_seconds), 0) as total_sec
         FROM activity_logs
         WHERE timestamp LIKE ?1
         GROUP BY day
         ORDER BY day",
    ) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    let pattern = format!("{}%", year);
    let rows = stmt
        .query_map(params![pattern], |row| {
            let total_sec: f64 = row.get::<_, i64>(3)? as f64;
            let prod_sec: f64 = row.get::<_, i64>(2)? as f64;
            let score = if total_sec > 0.0 {
                (prod_sec / total_sec) * 100.0
            } else {
                0.0
            };
            Ok(HeatmapDay {
                date: row.get(0)?,
                total_minutes: row.get(1)?,
                productivity_score: score,
            })
        })
        .ok();

    match rows {
        Some(r) => r.filter_map(|x| x.ok()).collect(),
        None => Vec::new(),
    }
}

#[tauri::command]
pub fn get_category_breakdown(
    state: tauri::State<'_, AppState>,
    date: String,
) -> Vec<CategoryBreakdown> {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let mut stmt = match conn.prepare(
        "SELECT
            category,
            COALESCE(SUM(duration_seconds) / 60, 0) as total_min
         FROM activity_logs
         WHERE timestamp LIKE ?1
         GROUP BY category",
    ) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    let pattern = format!("{}%", date);
    let rows: Vec<(String, i64)> = match stmt.query_map(params![pattern], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
    }) {
        Ok(r) => r.filter_map(|x| x.ok()).collect(),
        Err(_) => return Vec::new(),
    };

    let grand_total: i64 = rows.iter().map(|(_, m)| m).sum();

    rows.into_iter()
        .map(|(category, total_minutes)| {
            let percentage = if grand_total > 0 {
                (total_minutes as f64 / grand_total as f64) * 100.0
            } else {
                0.0
            };
            CategoryBreakdown {
                category,
                total_minutes,
                percentage,
            }
        })
        .collect()
}

#[tauri::command]
pub fn get_top_apps(
    state: tauri::State<'_, AppState>,
    date: String,
    limit: i32,
) -> Vec<AppUsage> {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let mut stmt = match conn.prepare(
        "SELECT
            a.process_name,
            ac.display_name,
            COALESCE(SUM(a.duration_seconds) / 60, 0) as total_min,
            a.category
         FROM activity_logs a
         LEFT JOIN app_categories ac ON a.process_name = ac.process_name
         WHERE a.timestamp LIKE ?1
         GROUP BY a.process_name
         ORDER BY total_min DESC
         LIMIT ?2",
    ) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    let pattern = format!("{}%", date);
    let rows = stmt
        .query_map(params![pattern, limit], |row| {
            Ok(AppUsage {
                process_name: row.get(0)?,
                display_name: row.get(1)?,
                total_minutes: row.get(2)?,
                category: row.get(3)?,
            })
        })
        .ok();

    match rows {
        Some(r) => r.filter_map(|x| x.ok()).collect(),
        None => Vec::new(),
    }
}
