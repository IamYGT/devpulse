use rusqlite::Connection;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreakInfo {
    pub streak_type: String,
    pub current_streak: i64,
    pub longest_streak: i64,
    pub last_active_date: Option<String>,
}

pub fn initialize_streaks_table(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS streaks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            streak_type TEXT NOT NULL UNIQUE,
            current_streak INTEGER DEFAULT 0,
            longest_streak INTEGER DEFAULT 0,
            last_active_date TEXT
        );
    ")?;
    // Seed default streak types
    conn.execute("INSERT OR IGNORE INTO streaks (streak_type) VALUES ('productive_day')", [])?;
    conn.execute("INSERT OR IGNORE INTO streaks (streak_type) VALUES ('commit_day')", [])?;
    Ok(())
}

pub fn update_streak(conn: &Connection, streak_type: &str, date: &str, qualifies: bool) -> rusqlite::Result<()> {
    if !qualifies {
        conn.execute(
            "UPDATE streaks SET current_streak = 0 WHERE streak_type = ?1",
            [streak_type],
        )?;
        return Ok(());
    }

    // Get current state
    let mut stmt = conn.prepare(
        "SELECT current_streak, longest_streak, last_active_date FROM streaks WHERE streak_type = ?1"
    )?;
    let (current, longest, last_date): (i64, i64, Option<String>) = stmt.query_row(
        [streak_type],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )?;

    let new_streak = if let Some(ref last) = last_date {
        let last_parsed = chrono::NaiveDate::parse_from_str(last, "%Y-%m-%d")
            .unwrap_or_else(|_| chrono::NaiveDate::from_ymd_opt(2000, 1, 1).unwrap());
        let today_parsed = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
            .unwrap_or_else(|_| chrono::NaiveDate::from_ymd_opt(2000, 1, 1).unwrap());
        let diff = (today_parsed - last_parsed).num_days();

        if diff == 1 {
            // Consecutive day: increment
            current + 1
        } else if diff == 0 {
            // Same day: keep current (already counted)
            current.max(1)
        } else {
            // Gap: reset to 1
            1
        }
    } else {
        // First ever entry
        1
    };

    let new_longest = longest.max(new_streak);

    conn.execute(
        "UPDATE streaks SET current_streak = ?1, longest_streak = ?2, last_active_date = ?3 WHERE streak_type = ?4",
        rusqlite::params![new_streak, new_longest, date, streak_type],
    )?;

    Ok(())
}

pub fn get_all_streaks(conn: &Connection) -> rusqlite::Result<Vec<StreakInfo>> {
    let mut stmt = conn.prepare(
        "SELECT streak_type, current_streak, longest_streak, last_active_date FROM streaks"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(StreakInfo {
            streak_type: row.get(0)?,
            current_streak: row.get(1)?,
            longest_streak: row.get(2)?,
            last_active_date: row.get(3)?,
        })
    })?;
    rows.collect()
}

pub fn check_daily_streaks(conn: &Connection, date: &str) -> rusqlite::Result<()> {
    // Check productive_day: >= 4 hours (240 minutes) of productive time today
    let productive_minutes: f64 = conn.query_row(
        "SELECT COALESCE(SUM(duration_seconds), 0) / 60.0 FROM activity_logs
         WHERE date(start_time) = ?1 AND category IN ('coding', 'development', 'productive')",
        [date],
        |row| row.get(0),
    ).unwrap_or(0.0);
    let qualifies_productive = productive_minutes >= 240.0;
    update_streak(conn, "productive_day", date, qualifies_productive)?;

    // Check commit_day: >= 1 commit today
    let commit_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM git_events WHERE date(timestamp) = ?1",
        [date],
        |row| row.get(0),
    ).unwrap_or(0);
    let qualifies_commit = commit_count >= 1;
    update_streak(conn, "commit_day", date, qualifies_commit)?;

    Ok(())
}
