use rusqlite::{params, Connection};
use super::models::*;
use super::auto_scheduler;

/// Ensure schedule tables exist
fn ensure_tables(conn: &Connection) {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schedule_blocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            project_id INTEGER REFERENCES projects(id),
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            priority TEXT DEFAULT 'P1',
            status TEXT DEFAULT 'planned',
            actual_minutes INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS schedule_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        );
        CREATE TABLE IF NOT EXISTS schedule_template_blocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_id INTEGER REFERENCES schedule_templates(id) ON DELETE CASCADE,
            project_id INTEGER REFERENCES projects(id),
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            day_of_week INTEGER DEFAULT 0
        );"
    ).ok();
}

/// Calculate planned minutes from HH:MM start/end
fn calc_planned_minutes(start: &str, end: &str) -> i64 {
    let parse_hm = |s: &str| -> i64 {
        let parts: Vec<&str> = s.split(':').collect();
        if parts.len() == 2 {
            let h: i64 = parts[0].parse().unwrap_or(0);
            let m: i64 = parts[1].parse().unwrap_or(0);
            h * 60 + m
        } else {
            0
        }
    };
    let s = parse_hm(start);
    let e = parse_hm(end);
    if e > s { e - s } else { 0 }
}

/// Fetch blocks for a given date and build a DaySchedule
fn build_day_schedule(conn: &Connection, date: &str) -> DaySchedule {
    let mut stmt = conn.prepare(
        "SELECT sb.id, sb.date, sb.project_id, COALESCE(p.name, 'Bilinmeyen'),
                sb.start_time, sb.end_time, sb.priority, sb.status, sb.actual_minutes
         FROM schedule_blocks sb
         LEFT JOIN projects p ON p.id = sb.project_id
         WHERE sb.date = ?1
         ORDER BY sb.start_time ASC"
    ).unwrap();

    let blocks: Vec<ScheduleBlock> = stmt.query_map(params![date], |row| {
        Ok(ScheduleBlock {
            id: row.get(0)?,
            date: row.get(1)?,
            project_id: row.get(2)?,
            project_name: row.get(3)?,
            start_time: row.get(4)?,
            end_time: row.get(5)?,
            priority: row.get(6)?,
            status: row.get(7)?,
            actual_minutes: row.get(8)?,
        })
    }).unwrap().filter_map(|r| r.ok()).collect();

    let total_planned: i64 = blocks.iter()
        .map(|b| calc_planned_minutes(&b.start_time, &b.end_time))
        .sum();
    let total_actual: i64 = blocks.iter().map(|b| b.actual_minutes).sum();

    let adherence = if total_planned > 0 {
        let ratio = total_actual as f64 / total_planned as f64;
        (ratio * 100.0).min(100.0)
    } else {
        0.0
    };

    DaySchedule {
        date: date.to_string(),
        blocks,
        total_planned_minutes: total_planned,
        total_actual_minutes: total_actual,
        adherence_score: adherence,
    }
}

// ─── Tauri Commands ──────────────────────────────────────────────────

#[tauri::command]
pub fn get_today_schedule(state: tauri::State<'_, crate::commands::AppState>) -> DaySchedule {
    let conn = match Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return DaySchedule {
            date: String::new(), blocks: vec![], total_planned_minutes: 0,
            total_actual_minutes: 0, adherence_score: 0.0,
        },
    };
    ensure_tables(&conn);
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    build_day_schedule(&conn, &today)
}

#[tauri::command]
pub fn get_schedule_for_date(
    state: tauri::State<'_, crate::commands::AppState>,
    date: String,
) -> DaySchedule {
    let conn = match Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return DaySchedule {
            date: date.clone(), blocks: vec![], total_planned_minutes: 0,
            total_actual_minutes: 0, adherence_score: 0.0,
        },
    };
    ensure_tables(&conn);
    build_day_schedule(&conn, &date)
}

#[tauri::command]
pub fn create_schedule_block(
    state: tauri::State<'_, crate::commands::AppState>,
    date: String,
    project_id: i64,
    start_time: String,
    end_time: String,
    priority: String,
) -> i64 {
    let conn = match Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return -1,
    };
    ensure_tables(&conn);
    match conn.execute(
        "INSERT INTO schedule_blocks (date, project_id, start_time, end_time, priority, status, actual_minutes)
         VALUES (?1, ?2, ?3, ?4, ?5, 'planned', 0)",
        params![date, project_id, start_time, end_time, priority],
    ) {
        Ok(_) => conn.last_insert_rowid(),
        Err(_) => -1,
    }
}

#[tauri::command]
pub fn update_schedule_block(
    state: tauri::State<'_, crate::commands::AppState>,
    id: i64,
    start_time: String,
    end_time: String,
    priority: String,
    status: String,
) -> bool {
    let conn = match Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return false,
    };
    ensure_tables(&conn);

    // If completing, calculate actual_minutes from tracked data
    let actual = if status == "completed" {
        calc_planned_minutes(&start_time, &end_time)
    } else {
        // Keep existing actual_minutes unless completing
        conn.query_row(
            "SELECT actual_minutes FROM schedule_blocks WHERE id = ?1",
            params![id],
            |row| row.get::<_, i64>(0),
        ).unwrap_or(0)
    };

    conn.execute(
        "UPDATE schedule_blocks SET start_time = ?1, end_time = ?2, priority = ?3, status = ?4, actual_minutes = ?5 WHERE id = ?6",
        params![start_time, end_time, priority, status, actual, id],
    ).is_ok()
}

#[tauri::command]
pub fn delete_schedule_block(
    state: tauri::State<'_, crate::commands::AppState>,
    id: i64,
) -> bool {
    let conn = match Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return false,
    };
    ensure_tables(&conn);
    conn.execute("DELETE FROM schedule_blocks WHERE id = ?1", params![id]).is_ok()
}

#[tauri::command]
pub fn get_schedule_suggestions(
    state: tauri::State<'_, crate::commands::AppState>,
) -> Vec<ScheduleSuggestion> {
    let conn = match Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };
    ensure_tables(&conn);
    auto_scheduler::generate_suggestions(&conn)
}

#[tauri::command]
pub fn get_schedule_adherence(
    state: tauri::State<'_, crate::commands::AppState>,
    date: String,
) -> f64 {
    let conn = match Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return 0.0,
    };
    ensure_tables(&conn);
    let schedule = build_day_schedule(&conn, &date);
    schedule.adherence_score
}

#[tauri::command]
pub fn apply_schedule_template(
    state: tauri::State<'_, crate::commands::AppState>,
    template_name: String,
    date: String,
) -> bool {
    let conn = match Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return false,
    };
    ensure_tables(&conn);

    // Find template
    let template_id: i64 = match conn.query_row(
        "SELECT id FROM schedule_templates WHERE name = ?1",
        params![template_name],
        |row| row.get(0),
    ) {
        Ok(id) => id,
        Err(_) => return false,
    };

    // Get day_of_week for the target date (0=Mon..6=Sun)
    // Parse the date and figure out day_of_week
    let target_dow: i32 = chrono::NaiveDate::parse_from_str(&date, "%Y-%m-%d")
        .map(|d| d.format("%u").to_string().parse::<i32>().unwrap_or(1) - 1) // %u: 1=Mon..7=Sun -> 0=Mon..6=Sun
        .unwrap_or(0);

    // Get template blocks matching this day of week (or all if day_of_week = -1)
    let mut stmt = match conn.prepare(
        "SELECT project_id, start_time, end_time FROM schedule_template_blocks
         WHERE template_id = ?1 AND (day_of_week = ?2 OR day_of_week = -1)
         ORDER BY start_time ASC"
    ) {
        Ok(s) => s,
        Err(_) => return false,
    };

    let blocks: Vec<(i64, String, String)> = stmt.query_map(
        params![template_id, target_dow],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    ).ok()
    .map(|rows| rows.filter_map(|r| r.ok()).collect())
    .unwrap_or_default();

    // Delete existing blocks for that date first
    conn.execute("DELETE FROM schedule_blocks WHERE date = ?1", params![date]).ok();

    // Insert template blocks
    for (pid, st, et) in blocks {
        conn.execute(
            "INSERT INTO schedule_blocks (date, project_id, start_time, end_time, priority, status, actual_minutes)
             VALUES (?1, ?2, ?3, ?4, 'P1', 'planned', 0)",
            params![date, pid, st, et],
        ).ok();
    }

    true
}

#[tauri::command]
pub fn save_schedule_template(
    state: tauri::State<'_, crate::commands::AppState>,
    name: String,
    blocks_json: String,
) -> i64 {
    let conn = match Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return -1,
    };
    ensure_tables(&conn);

    // Parse the blocks JSON
    let blocks: Vec<TemplateBlock> = match serde_json::from_str(&blocks_json) {
        Ok(b) => b,
        Err(_) => return -1,
    };

    // Upsert template
    conn.execute(
        "INSERT OR REPLACE INTO schedule_templates (name) VALUES (?1)",
        params![name],
    ).ok();

    let template_id: i64 = match conn.query_row(
        "SELECT id FROM schedule_templates WHERE name = ?1",
        params![name],
        |row| row.get(0),
    ) {
        Ok(id) => id,
        Err(_) => return -1,
    };

    // Clear old blocks for this template
    conn.execute(
        "DELETE FROM schedule_template_blocks WHERE template_id = ?1",
        params![template_id],
    ).ok();

    // Insert new blocks
    for b in &blocks {
        conn.execute(
            "INSERT INTO schedule_template_blocks (template_id, project_id, start_time, end_time, day_of_week)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![template_id, b.project_id, b.start_time, b.end_time, b.day_of_week],
        ).ok();
    }

    template_id
}

#[tauri::command]
pub fn get_next_scheduled_project(
    state: tauri::State<'_, crate::commands::AppState>,
) -> Option<ScheduleBlock> {
    let conn = Connection::open(&state.db_path).ok()?;
    ensure_tables(&conn);

    let now = chrono::Local::now();
    let today = now.format("%Y-%m-%d").to_string();
    let current_time = now.format("%H:%M").to_string();

    // First check: is there a block happening RIGHT NOW?
    let current_block: Option<ScheduleBlock> = conn.prepare(
        "SELECT sb.id, sb.date, sb.project_id, COALESCE(p.name, 'Bilinmeyen'),
                sb.start_time, sb.end_time, sb.priority, sb.status, sb.actual_minutes
         FROM schedule_blocks sb
         LEFT JOIN projects p ON p.id = sb.project_id
         WHERE sb.date = ?1 AND sb.start_time <= ?2 AND sb.end_time > ?2
               AND sb.status IN ('planned', 'active')
         ORDER BY sb.start_time ASC
         LIMIT 1"
    ).ok()?.query_map(params![today, current_time], |row| {
        Ok(ScheduleBlock {
            id: row.get(0)?,
            date: row.get(1)?,
            project_id: row.get(2)?,
            project_name: row.get(3)?,
            start_time: row.get(4)?,
            end_time: row.get(5)?,
            priority: row.get(6)?,
            status: row.get(7)?,
            actual_minutes: row.get(8)?,
        })
    }).ok()?.filter_map(|r| r.ok()).next();

    if current_block.is_some() {
        return current_block;
    }

    // Otherwise get the next upcoming block
    let mut stmt2 = conn.prepare(
        "SELECT sb.id, sb.date, sb.project_id, COALESCE(p.name, 'Bilinmeyen'),
                sb.start_time, sb.end_time, sb.priority, sb.status, sb.actual_minutes
         FROM schedule_blocks sb
         LEFT JOIN projects p ON p.id = sb.project_id
         WHERE sb.date = ?1 AND sb.start_time > ?2
               AND sb.status IN ('planned', 'active')
         ORDER BY sb.start_time ASC
         LIMIT 1"
    ).ok()?;
    let result = stmt2.query_map(params![today, current_time], |row| {
        Ok(ScheduleBlock {
            id: row.get(0)?,
            date: row.get(1)?,
            project_id: row.get(2)?,
            project_name: row.get(3)?,
            start_time: row.get(4)?,
            end_time: row.get(5)?,
            priority: row.get(6)?,
            status: row.get(7)?,
            actual_minutes: row.get(8)?,
        })
    }).ok()?.filter_map(|r| r.ok()).next();
    result
}

#[tauri::command]
pub fn get_schedule_templates(
    state: tauri::State<'_, crate::commands::AppState>,
) -> Vec<ScheduleTemplate> {
    let conn = match Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };
    ensure_tables(&conn);

    let mut stmt = match conn.prepare("SELECT id, name FROM schedule_templates ORDER BY name ASC") {
        Ok(s) => s,
        Err(_) => return vec![],
    };

    let templates: Vec<(i64, String)> = stmt.query_map([], |row| {
        Ok((row.get(0)?, row.get(1)?))
    }).ok()
    .map(|rows| rows.filter_map(|r| r.ok()).collect())
    .unwrap_or_default();

    templates.into_iter().map(|(id, name)| {
        let blocks = conn.prepare(
            "SELECT project_id, start_time, end_time, day_of_week
             FROM schedule_template_blocks WHERE template_id = ?1 ORDER BY start_time"
        ).ok().map(|mut s| {
            s.query_map(params![id], |row| {
                Ok(TemplateBlock {
                    project_id: row.get(0)?,
                    start_time: row.get(1)?,
                    end_time: row.get(2)?,
                    day_of_week: row.get(3)?,
                })
            }).ok()
            .map(|rows| rows.filter_map(|r| r.ok()).collect())
            .unwrap_or_default()
        }).unwrap_or_default();

        ScheduleTemplate { id, name, blocks }
    }).collect()
}

#[tauri::command]
pub fn auto_generate_schedule(
    state: tauri::State<'_, crate::commands::AppState>,
    date: String,
) -> DaySchedule {
    let conn = match Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return DaySchedule {
            date: date.clone(), blocks: vec![], total_planned_minutes: 0,
            total_actual_minutes: 0, adherence_score: 0.0,
        },
    };
    ensure_tables(&conn);

    // Clear existing planned blocks for that date
    conn.execute(
        "DELETE FROM schedule_blocks WHERE date = ?1 AND status = 'planned'",
        params![date],
    ).ok();

    // Generate blocks via auto_scheduler
    let generated = auto_scheduler::generate_day_blocks(&conn, &date);

    for block in &generated {
        conn.execute(
            "INSERT INTO schedule_blocks (date, project_id, start_time, end_time, priority, status, actual_minutes)
             VALUES (?1, ?2, ?3, ?4, ?5, 'planned', 0)",
            params![block.date, block.project_id, block.start_time, block.end_time, block.priority],
        ).ok();
    }

    build_day_schedule(&conn, &date)
}
