use rusqlite::Connection;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyGoal {
    pub goal_type: String,
    pub target_value: f64,
    pub current_value: f64,
    pub achieved: bool,
}

pub fn initialize_goals_tables(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS daily_goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            goal_type TEXT NOT NULL UNIQUE,
            target_value REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS daily_goal_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            goal_type TEXT NOT NULL,
            current_value REAL DEFAULT 0,
            achieved INTEGER DEFAULT 0,
            UNIQUE(date, goal_type)
        );
    ")?;
    Ok(())
}

pub fn set_goal(conn: &Connection, goal_type: &str, target: f64) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO daily_goals (goal_type, target_value) VALUES (?1, ?2)
         ON CONFLICT(goal_type) DO UPDATE SET target_value = ?2",
        rusqlite::params![goal_type, target],
    )?;
    Ok(())
}

pub fn get_goals_with_progress(conn: &Connection, date: &str) -> rusqlite::Result<Vec<DailyGoal>> {
    let mut stmt = conn.prepare(
        "SELECT g.goal_type, g.target_value,
                COALESCE(p.current_value, 0) as current_value,
                COALESCE(p.achieved, 0) as achieved
         FROM daily_goals g
         LEFT JOIN daily_goal_progress p ON g.goal_type = p.goal_type AND p.date = ?1"
    )?;
    let rows = stmt.query_map([date], |row| {
        Ok(DailyGoal {
            goal_type: row.get(0)?,
            target_value: row.get(1)?,
            current_value: row.get(2)?,
            achieved: row.get::<_, i64>(3)? != 0,
        })
    })?;
    rows.collect()
}

pub fn update_goal_progress(conn: &Connection, date: &str) -> rusqlite::Result<()> {
    // Get all defined goals
    let mut stmt = conn.prepare("SELECT goal_type, target_value FROM daily_goals")?;
    let goals: Vec<(String, f64)> = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?))
    })?.filter_map(|r| r.ok()).collect();

    for (goal_type, target) in &goals {
        let current_value = match goal_type.as_str() {
            "productive_hours" => {
                // Sum productive minutes from activity_logs, convert to hours
                let minutes: f64 = conn.query_row(
                    "SELECT COALESCE(SUM(duration_seconds), 0) / 60.0 FROM activity_logs
                     WHERE date(start_time) = ?1 AND category IN ('coding', 'development', 'productive')",
                    [date],
                    |row| row.get(0),
                ).unwrap_or(0.0);
                minutes / 60.0
            }
            "commits" => {
                // Count commits from git_events
                let count: i64 = conn.query_row(
                    "SELECT COUNT(*) FROM git_events WHERE date(timestamp) = ?1",
                    [date],
                    |row| row.get(0),
                ).unwrap_or(0);
                count as f64
            }
            "productivity_score" => {
                // Calculate productivity score from activity ratios
                let productive: f64 = conn.query_row(
                    "SELECT COALESCE(SUM(duration_seconds), 0) FROM activity_logs
                     WHERE date(start_time) = ?1 AND category IN ('coding', 'development', 'productive')",
                    [date],
                    |row| row.get(0),
                ).unwrap_or(0.0);
                let total: f64 = conn.query_row(
                    "SELECT COALESCE(SUM(duration_seconds), 1) FROM activity_logs
                     WHERE date(start_time) = ?1",
                    [date],
                    |row| row.get(0),
                ).unwrap_or(1.0);
                (productive / total) * 100.0
            }
            _ => 0.0,
        };

        let achieved = if current_value >= *target { 1 } else { 0 };

        conn.execute(
            "INSERT INTO daily_goal_progress (date, goal_type, current_value, achieved)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(date, goal_type) DO UPDATE SET current_value = ?3, achieved = ?4",
            rusqlite::params![date, goal_type, current_value, achieved],
        )?;
    }

    Ok(())
}
