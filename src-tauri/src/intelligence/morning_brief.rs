use chrono::{Datelike, Timelike};
use rusqlite::{params, Connection};
use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct MorningBrief {
    pub greeting: String,
    pub date: String,
    pub planned_projects: Vec<PlannedProject>,
    pub yesterday_summary: YesterdaySummary,
    pub streak_days: i64,
    pub tip_of_the_day: String,
}

#[derive(Serialize, Clone)]
pub struct PlannedProject {
    pub name: String,
    pub planned_minutes: i64,
    pub priority: String,
    pub last_active: Option<String>,
    pub pending_commits: bool,
}

#[derive(Serialize, Clone)]
pub struct YesterdaySummary {
    pub total_hours: f64,
    pub productivity: f64,
    pub top_project: String,
    pub schedule_adherence: f64,
}

const TIPS: &[&str] = &[
    "Pomodoro teknigiyle calismak odaklanmani %25 artirabilir.",
    "Her 90 dakikada 5 dakika mola ver, gozlerini dinlendir.",
    "En zor gorevi gunun ilk saatinde yap (deep work).",
    "Proje gecislerini minimize et, context switching maliyetlidir.",
    "Gunluk hedeflerini sabah belirle, aksam kontrol et.",
    "Commit sik, commit kucuk. Buyuk commitler riski artirir.",
    "Dikkat dagitici uygulamalari kapatarak basla.",
    "2 saatlik odaklanma bloklari olustur, arada 15dk mola ver.",
    "Sabah rutini olustur: kahve, plan, deep work.",
    "Idle sureni takip et, verimli calisma sureni artir.",
    "Her gun en az 1 commit at, sureklilik onemli.",
    "Ayni projede 3+ saat calismak tukenmeye yol acabilir, denge kur.",
    "Aksam yatmadan yarin ne yapacagini planla.",
    "Muzik dinlemek odaklanmani artirabilir, dene!",
];

fn get_greeting() -> String {
    let hour = chrono::Local::now().hour();
    match hour {
        5..=11 => "Gunaydin!".to_string(),
        12..=17 => "Iyi gunler!".to_string(),
        18..=22 => "Iyi aksamlar!".to_string(),
        _ => "Gece kusu musun?".to_string(),
    }
}

fn get_tip_of_the_day() -> String {
    let day_of_year = chrono::Local::now().ordinal() as usize;
    let index = day_of_year % TIPS.len();
    TIPS[index].to_string()
}

fn get_yesterday_date() -> String {
    let yesterday = chrono::Local::now().date_naive() - chrono::Duration::days(1);
    yesterday.format("%Y-%m-%d").to_string()
}

fn get_today_date() -> String {
    chrono::Local::now().date_naive().format("%Y-%m-%d").to_string()
}

fn calculate_streak(conn: &Connection) -> i64 {
    let today = chrono::Local::now().date_naive();
    let mut streak: i64 = 0;

    for i in 1..=365i64 {
        let check_date = today - chrono::Duration::days(i);
        let date_str = check_date.format("%Y-%m-%d").to_string();
        let date_prefix = format!("{}%", date_str);

        let has_productive: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM activity_logs
                 WHERE timestamp LIKE ?1
                   AND category = 'productive'
                   AND duration_seconds > 0",
                params![date_prefix],
                |row| row.get::<_, i64>(0),
            )
            .map(|c| c > 10)
            .unwrap_or(false);

        if has_productive {
            streak += 1;
        } else {
            break;
        }
    }

    streak
}

pub fn generate_morning_brief(db_path: &str) -> MorningBrief {
    let conn = match Connection::open(db_path) {
        Ok(c) => c,
        Err(_) => {
            return MorningBrief {
                greeting: get_greeting(),
                date: get_today_date(),
                planned_projects: Vec::new(),
                yesterday_summary: YesterdaySummary {
                    total_hours: 0.0,
                    productivity: 0.0,
                    top_project: "Veri yok".to_string(),
                    schedule_adherence: 0.0,
                },
                streak_days: 0,
                tip_of_the_day: get_tip_of_the_day(),
            };
        }
    };

    // --- Yesterday summary ---
    let yesterday = get_yesterday_date();
    let yesterday_prefix = format!("{}%", yesterday);

    let total_minutes: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(duration_seconds), 0) / 60.0
             FROM activity_logs WHERE timestamp LIKE ?1 AND is_idle = 0",
            params![yesterday_prefix],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let productive_minutes: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(duration_seconds), 0) / 60.0
             FROM activity_logs WHERE timestamp LIKE ?1 AND category = 'productive'",
            params![yesterday_prefix],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let productivity = if total_minutes > 0.0 {
        (productive_minutes / total_minutes) * 100.0
    } else {
        0.0
    };

    let top_project: String = conn
        .query_row(
            "SELECT COALESCE(p.name, 'Bilinmeyen')
             FROM activity_logs a
             LEFT JOIN projects p ON a.project_id = p.id
             WHERE a.timestamp LIKE ?1 AND a.category = 'productive'
             GROUP BY a.project_id
             ORDER BY SUM(a.duration_seconds) DESC
             LIMIT 1",
            params![yesterday_prefix],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "Veri yok".to_string());

    // Schedule adherence: compare scheduled vs actual
    let scheduled_total: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(
                (CAST(substr(end_time, 1, 2) AS INTEGER) * 60 + CAST(substr(end_time, 4, 2) AS INTEGER))
                - (CAST(substr(start_time, 1, 2) AS INTEGER) * 60 + CAST(substr(start_time, 4, 2) AS INTEGER))
             ), 0) FROM schedule_blocks WHERE date = ?1",
            params![yesterday],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let schedule_adherence = if scheduled_total > 0.0 {
        ((productive_minutes / scheduled_total) * 100.0).min(100.0)
    } else {
        // No schedule defined, give benefit of the doubt
        if productive_minutes > 0.0 { 75.0 } else { 0.0 }
    };

    let yesterday_summary = YesterdaySummary {
        total_hours: total_minutes / 60.0,
        productivity,
        top_project,
        schedule_adherence,
    };

    // --- Planned projects (projects with budgets or scheduled today) ---
    let today = get_today_date();
    let mut planned_projects: Vec<PlannedProject> = Vec::new();

    // First get scheduled projects for today
    {
        let mut stmt = conn
            .prepare(
                "SELECT p.name,
                        (CAST(substr(sb.end_time, 1, 2) AS INTEGER) * 60 + CAST(substr(sb.end_time, 4, 2) AS INTEGER))
                        - (CAST(substr(sb.start_time, 1, 2) AS INTEGER) * 60 + CAST(substr(sb.start_time, 4, 2) AS INTEGER)) as planned_min,
                        sb.priority
                 FROM schedule_blocks sb
                 JOIN projects p ON sb.project_id = p.id
                 WHERE sb.date = ?1
                 ORDER BY sb.start_time",
            )
            .ok();

        if let Some(ref mut stmt) = stmt {
            if let Ok(rows) = stmt.query_map(params![today], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, String>(2)?,
                ))
            }) {
                for row in rows.flatten() {
                    planned_projects.push(PlannedProject {
                        name: row.0,
                        planned_minutes: row.1,
                        priority: row.2,
                        last_active: None,
                        pending_commits: false,
                    });
                }
            }
        }
    }

    // If no schedule, fall back to projects with budgets
    if planned_projects.is_empty() {
        let mut stmt = conn
            .prepare(
                "SELECT name, daily_budget_minutes FROM projects
                 WHERE daily_budget_minutes > 0
                 ORDER BY daily_budget_minutes DESC",
            )
            .ok();

        if let Some(ref mut stmt) = stmt {
            if let Ok(rows) = stmt.query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
            }) {
                for row in rows.flatten() {
                    planned_projects.push(PlannedProject {
                        name: row.0,
                        planned_minutes: row.1,
                        priority: "P2".to_string(),
                        last_active: None,
                        pending_commits: false,
                    });
                }
            }
        }
    }

    // Enrich with last_active and pending_commits
    for project in &mut planned_projects {
        // Last active timestamp
        let last_active: Option<String> = conn
            .query_row(
                "SELECT a.timestamp FROM activity_logs a
                 JOIN projects p ON a.project_id = p.id
                 WHERE p.name = ?1 AND a.category = 'productive'
                 ORDER BY a.timestamp DESC LIMIT 1",
                params![project.name],
                |row| row.get(0),
            )
            .ok();
        project.last_active = last_active;

        // Check if there are recent git events (pending work indicator)
        let recent_commits: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM git_events g
                 JOIN projects p ON g.project_id = p.id
                 WHERE p.name = ?1
                   AND g.timestamp LIKE ?2",
                params![project.name, format!("{}%", yesterday)],
                |row| row.get(0),
            )
            .unwrap_or(0);

        // If there were commits yesterday but none today, mark as pending
        let today_commits: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM git_events g
                 JOIN projects p ON g.project_id = p.id
                 WHERE p.name = ?1
                   AND g.timestamp LIKE ?2",
                params![project.name, format!("{}%", today)],
                |row| row.get(0),
            )
            .unwrap_or(0);

        project.pending_commits = recent_commits > 0 && today_commits == 0;
    }

    // --- Streak ---
    let streak_days = calculate_streak(&conn);

    MorningBrief {
        greeting: get_greeting(),
        date: get_today_date(),
        planned_projects,
        yesterday_summary,
        streak_days,
        tip_of_the_day: get_tip_of_the_day(),
    }
}
