use rusqlite::{params, Connection};

use crate::models::*;

pub fn insert_activity_log(conn: &Connection, log: &ActivityLog) -> rusqlite::Result<i64> {
    conn.execute(
        "INSERT INTO activity_logs (timestamp, window_title, process_name, project_id, category, duration_seconds, is_idle)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            log.timestamp,
            log.window_title,
            log.process_name,
            log.project_id,
            log.category,
            log.duration_seconds,
            log.is_idle as i32,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn insert_git_event(conn: &Connection, event: &GitEvent) -> rusqlite::Result<i64> {
    conn.execute(
        "INSERT INTO git_events (timestamp, project_id, commit_hash, branch, message, lines_added, lines_removed)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            event.timestamp,
            event.project_id,
            event.commit_hash,
            event.branch,
            event.message,
            event.lines_added,
            event.lines_removed,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_or_create_project(conn: &Connection, name: &str, path: Option<&str>) -> rusqlite::Result<Project> {
    let existing: Option<Project> = conn
        .query_row(
            "SELECT id, name, path, daily_budget_minutes, category, created_at FROM projects WHERE name = ?1",
            params![name],
            |row| {
                Ok(Project {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    path: row.get(2)?,
                    daily_budget_minutes: row.get(3)?,
                    category: row.get(4)?,
                    created_at: row.get(5)?,
                })
            },
        )
        .ok();

    if let Some(project) = existing {
        return Ok(project);
    }

    conn.execute(
        "INSERT INTO projects (name, path) VALUES (?1, ?2)",
        params![name, path],
    )?;

    let id = conn.last_insert_rowid();
    Ok(Project {
        id,
        name: name.to_string(),
        path: path.map(|s| s.to_string()),
        daily_budget_minutes: 0,
        category: "development".to_string(),
        created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    })
}

pub fn get_all_projects(conn: &Connection) -> rusqlite::Result<Vec<Project>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, path, daily_budget_minutes, category, created_at FROM projects ORDER BY name",
    )?;
    let projects = stmt.query_map([], |row| {
        Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            daily_budget_minutes: row.get(3)?,
            category: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(projects)
}

pub fn get_category_for_process(conn: &Connection, process_name: &str) -> rusqlite::Result<String> {
    conn.query_row(
        "SELECT category FROM app_categories WHERE process_name = ?1",
        params![process_name],
        |row| row.get(0),
    )
    .or(Ok("neutral".to_string()))
}

pub fn get_today_timeline(conn: &Connection) -> rusqlite::Result<Vec<TimelineEntry>> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let mut stmt = conn.prepare(
        "SELECT a.timestamp, a.duration_seconds, a.process_name, a.window_title, p.name, a.category, a.is_idle
         FROM activity_logs a
         LEFT JOIN projects p ON a.project_id = p.id
         WHERE a.timestamp LIKE ?1
         ORDER BY a.timestamp DESC
         LIMIT 500",
    )?;
    let entries = stmt.query_map(params![format!("{}%", today)], |row| {
        Ok(TimelineEntry {
            timestamp: row.get(0)?,
            duration_seconds: row.get(1)?,
            process_name: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
            window_title: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
            project_name: row.get(4)?,
            category: row.get(5)?,
            is_idle: row.get::<_, i32>(6)? != 0,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(entries)
}

pub fn get_today_summary(conn: &Connection) -> rusqlite::Result<Vec<DailySummary>> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let mut stmt = conn.prepare(
        "SELECT
            ?1 as date,
            a.project_id,
            p.name,
            COALESCE(SUM(a.duration_seconds) / 60, 0) as total_minutes,
            COALESCE(SUM(CASE WHEN a.category = 'productive' THEN a.duration_seconds ELSE 0 END) / 60, 0) as productive_minutes,
            COALESCE(SUM(CASE WHEN a.category = 'distracting' THEN a.duration_seconds ELSE 0 END) / 60, 0) as distracting_minutes,
            COALESCE(SUM(CASE WHEN a.is_idle = 1 THEN a.duration_seconds ELSE 0 END) / 60, 0) as idle_minutes,
            (SELECT COUNT(*) FROM git_events g WHERE g.project_id = a.project_id AND g.timestamp LIKE ?2) as commit_count
         FROM activity_logs a
         LEFT JOIN projects p ON a.project_id = p.id
         WHERE a.timestamp LIKE ?2
         GROUP BY a.project_id",
    )?;
    let summaries = stmt.query_map(params![today, format!("{}%", today)], |row| {
        let total: f64 = row.get::<_, i64>(3)? as f64;
        let productive: f64 = row.get::<_, i64>(4)? as f64;
        let score = if total > 0.0 { (productive / total) * 100.0 } else { 0.0 };
        Ok(DailySummary {
            date: row.get(0)?,
            project_id: row.get(1)?,
            project_name: row.get(2)?,
            total_minutes: row.get(3)?,
            productive_minutes: row.get(4)?,
            distracting_minutes: row.get(5)?,
            idle_minutes: row.get(6)?,
            commit_count: row.get(7)?,
            productivity_score: score,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(summaries)
}

pub fn get_today_commits_count(conn: &Connection) -> rusqlite::Result<i64> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    conn.query_row(
        "SELECT COUNT(*) FROM git_events WHERE timestamp LIKE ?1",
        params![format!("{}%", today)],
        |row| row.get(0),
    )
}

pub fn get_project_today_minutes(conn: &Connection, project_id: i64) -> rusqlite::Result<i64> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    conn.query_row(
        "SELECT COALESCE(SUM(duration_seconds) / 60, 0) FROM activity_logs WHERE project_id = ?1 AND timestamp LIKE ?2",
        params![project_id, format!("{}%", today)],
        |row| row.get(0),
    )
}

pub fn set_project_budget(conn: &Connection, project_id: i64, minutes: i64) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE projects SET daily_budget_minutes = ?1 WHERE id = ?2",
        params![minutes, project_id],
    )?;
    Ok(())
}

pub fn get_weekly_trends(conn: &Connection) -> rusqlite::Result<Vec<DayTrend>> {
    let mut stmt = conn.prepare(
        "SELECT
            date(a.timestamp) as day,
            COALESCE(SUM(a.duration_seconds) / 60, 0),
            COALESCE(SUM(CASE WHEN a.category = 'productive' THEN a.duration_seconds ELSE 0 END) / 60, 0),
            COALESCE(SUM(CASE WHEN a.category = 'distracting' THEN a.duration_seconds ELSE 0 END) / 60, 0),
            (SELECT COUNT(*) FROM git_events g WHERE date(g.timestamp) = date(a.timestamp))
         FROM activity_logs a
         WHERE a.timestamp >= datetime('now', '-7 days', 'localtime')
         GROUP BY day
         ORDER BY day",
    )?;
    let trends = stmt.query_map([], |row| {
        let total: f64 = row.get::<_, i64>(1)? as f64;
        let productive: f64 = row.get::<_, i64>(2)? as f64;
        let score = if total > 0.0 { (productive / total) * 100.0 } else { 0.0 };
        Ok(DayTrend {
            date: row.get(0)?,
            total_minutes: row.get(1)?,
            productive_minutes: row.get(2)?,
            distracting_minutes: row.get(3)?,
            commit_count: row.get(4)?,
            productivity_score: score,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(trends)
}

pub fn get_git_events_for_project(conn: &Connection, project_id: i64, date: &str) -> rusqlite::Result<Vec<GitEvent>> {
    let mut stmt = conn.prepare(
        "SELECT id, timestamp, project_id, commit_hash, branch, message, lines_added, lines_removed
         FROM git_events
         WHERE project_id = ?1 AND timestamp LIKE ?2
         ORDER BY timestamp DESC",
    )?;
    let events = stmt.query_map(params![project_id, format!("{}%", date)], |row| {
        Ok(GitEvent {
            id: row.get(0)?,
            timestamp: row.get(1)?,
            project_id: row.get(2)?,
            commit_hash: row.get(3)?,
            branch: row.get(4)?,
            message: row.get(5)?,
            lines_added: row.get(6)?,
            lines_removed: row.get(7)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(events)
}
