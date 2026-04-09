use rusqlite::{params, Connection};
use super::models::*;

/// Working hours configuration
const WORK_START: i32 = 9 * 60;      // 09:00 in minutes
const LUNCH_START: i32 = 12 * 60;    // 12:00
const LUNCH_END: i32 = 13 * 60;      // 13:00
const WORK_END: i32 = 18 * 60;       // 18:00
const BREAK_MINUTES: i32 = 10;       // 10 min break between blocks
const MIN_BLOCK_MINUTES: i32 = 30;   // minimum block size

fn minutes_to_hhmm(mins: i32) -> String {
    format!("{:02}:{:02}", mins / 60, mins % 60)
}

/// Information about a project for scheduling
struct ProjectInfo {
    id: i64,
    name: String,
    budget_minutes: i64,
    used_today_minutes: i64,
    priority: String,
    last_worked_days_ago: i64,
}

/// Gather project data for scheduling decisions
fn gather_project_info(conn: &Connection) -> Vec<ProjectInfo> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    // Get all projects with their budgets
    let mut stmt = match conn.prepare(
        "SELECT id, name, daily_budget_minutes, category FROM projects ORDER BY name"
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };

    let projects: Vec<(i64, String, i64, String)> = stmt.query_map([], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
    }).ok()
    .map(|rows| rows.filter_map(|r| r.ok()).collect())
    .unwrap_or_default();

    projects.into_iter().map(|(id, name, budget, category)| {
        // Check how much time was already tracked today for this project
        let used_today: i64 = conn.query_row(
            "SELECT COALESCE(SUM(duration_seconds), 0) / 60
             FROM activity_log
             WHERE project_id = ?1 AND DATE(timestamp) = ?2 AND is_idle = 0",
            params![id, today],
            |row| row.get(0),
        ).unwrap_or(0);

        // Check when this project was last worked on
        let last_date: Option<String> = conn.query_row(
            "SELECT DATE(timestamp) FROM activity_log
             WHERE project_id = ?1 AND is_idle = 0
             ORDER BY timestamp DESC LIMIT 1",
            params![id],
            |row| row.get(0),
        ).ok();

        let days_ago = last_date.map(|d| {
            chrono::NaiveDate::parse_from_str(&d, "%Y-%m-%d").ok().map(|ld| {
                let today_d = chrono::Local::now().date_naive();
                (today_d - ld).num_days()
            }).unwrap_or(999)
        }).unwrap_or(999);

        // Determine priority based on category and urgency
        let priority = match category.as_str() {
            "work" | "critical" => "P0",
            "study" | "learning" => "P1",
            _ => "P2",
        };

        ProjectInfo {
            id,
            name,
            budget_minutes: if budget > 0 { budget } else { 120 }, // default 2hrs if no budget
            used_today_minutes: used_today,
            priority: priority.to_string(),
            last_worked_days_ago: days_ago,
        }
    }).collect()
}

/// Generate scheduling suggestions based on project data
pub fn generate_suggestions(conn: &Connection) -> Vec<ScheduleSuggestion> {
    let mut infos = gather_project_info(conn);

    // Sort by priority (P0 first), then by neglect (more days ago = more urgent)
    infos.sort_by(|a, b| {
        a.priority.cmp(&b.priority)
            .then(b.last_worked_days_ago.cmp(&a.last_worked_days_ago))
    });

    infos.into_iter().map(|info| {
        let remaining = (info.budget_minutes - info.used_today_minutes).max(0);

        let reason = if info.used_today_minutes >= info.budget_minutes {
            format!("Bugun butcesine ulasildi ({} dk kullanildi)", info.used_today_minutes)
        } else if info.last_worked_days_ago > 3 {
            format!("{} gundur dokunulmadi! Acil ilgilenilmeli.", info.last_worked_days_ago)
        } else if info.last_worked_days_ago > 1 {
            format!("{} gundur calismadin. {} dk kaldi.", info.last_worked_days_ago, remaining)
        } else {
            format!("Gunluk butce: {} dk, kalan: {} dk", info.budget_minutes, remaining)
        };

        ScheduleSuggestion {
            project_name: info.name,
            project_id: info.id,
            suggested_minutes: remaining.min(info.budget_minutes),
            reason,
            priority: info.priority,
        }
    }).collect()
}

/// Generate a full day of schedule blocks automatically
pub fn generate_day_blocks(conn: &Connection, date: &str) -> Vec<ScheduleBlock> {
    let mut infos = gather_project_info(conn);

    // Sort: P0 first, then P1, then P2. Within same priority, neglected projects first
    infos.sort_by(|a, b| {
        a.priority.cmp(&b.priority)
            .then(b.last_worked_days_ago.cmp(&a.last_worked_days_ago))
    });

    // Filter out projects that have already hit their budget
    infos.retain(|p| p.used_today_minutes < p.budget_minutes);

    let mut blocks: Vec<ScheduleBlock> = Vec::new();
    let mut current_time = WORK_START; // 09:00

    let mut block_id_counter = 0i64;

    for info in &infos {
        if current_time >= WORK_END {
            break;
        }

        // Skip lunch hour
        if current_time >= LUNCH_START && current_time < LUNCH_END {
            current_time = LUNCH_END;
        }

        let remaining_budget = (info.budget_minutes - info.used_today_minutes).max(0) as i32;
        if remaining_budget < MIN_BLOCK_MINUTES {
            continue;
        }

        // Calculate block duration: respect budget but also available time
        let available_before_lunch = if current_time < LUNCH_START {
            LUNCH_START - current_time
        } else {
            WORK_END - current_time
        };

        let block_duration = remaining_budget
            .min(available_before_lunch)
            .min(180) // max 3 hours per block
            .max(MIN_BLOCK_MINUTES);

        let end_time = (current_time + block_duration).min(WORK_END);

        // Don't create tiny blocks
        if end_time - current_time < MIN_BLOCK_MINUTES {
            current_time = end_time + BREAK_MINUTES;
            continue;
        }

        block_id_counter += 1;
        blocks.push(ScheduleBlock {
            id: block_id_counter,
            date: date.to_string(),
            project_id: info.id,
            project_name: info.name.clone(),
            start_time: minutes_to_hhmm(current_time),
            end_time: minutes_to_hhmm(end_time),
            priority: info.priority.clone(),
            status: "planned".to_string(),
            actual_minutes: 0,
        });

        current_time = end_time + BREAK_MINUTES;

        // Skip lunch if we land on it
        if current_time >= LUNCH_START && current_time < LUNCH_END {
            current_time = LUNCH_END;
        }
    }

    blocks
}
