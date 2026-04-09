use rusqlite::{params, Connection};
use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct DailyReportCard {
    pub date: String,
    pub grade: String,
    pub score: f64,
    pub metrics: ReportMetrics,
    pub highlights: Vec<String>,
    pub improvements: Vec<String>,
}

#[derive(Serialize, Clone)]
pub struct ReportMetrics {
    pub schedule_adherence: f64,
    pub productivity_score: f64,
    pub break_compliance: f64,
    pub commit_frequency: f64,
    pub focus_score: f64,
    pub overtime_penalty: f64,
}

fn score_to_grade(score: f64) -> String {
    if score >= 90.0 {
        "A".to_string()
    } else if score >= 80.0 {
        "B".to_string()
    } else if score >= 70.0 {
        "C".to_string()
    } else if score >= 60.0 {
        "D".to_string()
    } else {
        "F".to_string()
    }
}

pub fn generate_report_card(db_path: &str, date: &str) -> DailyReportCard {
    let conn = match Connection::open(db_path) {
        Ok(c) => c,
        Err(_) => {
            return empty_report(date);
        }
    };

    let date_prefix = format!("{}%", date);

    // --- Productivity Score (0-100) ---
    let total_minutes: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(duration_seconds), 0) / 60.0
             FROM activity_logs WHERE timestamp LIKE ?1 AND is_idle = 0",
            params![date_prefix],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let productive_minutes: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(duration_seconds), 0) / 60.0
             FROM activity_logs WHERE timestamp LIKE ?1 AND category = 'productive'",
            params![date_prefix],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let distracting_minutes: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(duration_seconds), 0) / 60.0
             FROM activity_logs WHERE timestamp LIKE ?1 AND category = 'distracting'",
            params![date_prefix],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let productivity_score = if total_minutes > 0.0 {
        ((productive_minutes / total_minutes) * 100.0).min(100.0)
    } else {
        0.0
    };

    // --- Schedule Adherence (0-100) ---
    let scheduled_total: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(
                (CAST(substr(end_time, 1, 2) AS INTEGER) * 60 + CAST(substr(end_time, 4, 2) AS INTEGER))
                - (CAST(substr(start_time, 1, 2) AS INTEGER) * 60 + CAST(substr(start_time, 4, 2) AS INTEGER))
             ), 0) FROM schedule_blocks WHERE date = ?1",
            params![date],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let schedule_adherence = if scheduled_total > 0.0 {
        ((productive_minutes / scheduled_total) * 100.0).min(100.0)
    } else {
        // No schedule: neutral score
        if productive_minutes > 60.0 { 70.0 } else { 50.0 }
    };

    // --- Break Compliance (0-100) ---
    // Check for sessions longer than 90 minutes without a break
    let long_sessions: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM (
                SELECT timestamp,
                       LAG(timestamp) OVER (ORDER BY timestamp) as prev_ts,
                       category
                FROM activity_logs
                WHERE timestamp LIKE ?1
                  AND is_idle = 0
                  AND category = 'productive'
                ORDER BY timestamp
             ) WHERE (julianday(timestamp) - julianday(prev_ts)) * 1440 > 90",
            params![date_prefix],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let idle_periods: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM activity_logs
             WHERE timestamp LIKE ?1 AND is_idle = 1 AND duration_seconds >= 180",
            params![date_prefix],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let total_hours = total_minutes / 60.0;
    let expected_breaks = (total_hours / 1.5).floor() as i64;
    let break_compliance = if expected_breaks > 0 {
        ((idle_periods as f64 / expected_breaks as f64) * 100.0).min(100.0)
    } else {
        if total_minutes < 90.0 { 100.0 } else { 50.0 }
    };

    // --- Commit Frequency (0-100) ---
    let commit_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM git_events WHERE timestamp LIKE ?1",
            params![date_prefix],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let commit_frequency = if productive_minutes > 0.0 {
        let commits_per_hour = (commit_count as f64) / (productive_minutes / 60.0);
        // Target: ~2 commits per hour is ideal
        (commits_per_hour / 2.0 * 100.0).min(100.0)
    } else {
        0.0
    };

    // --- Focus Score (0-100) ---
    // Based on project switching frequency
    let project_switches: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM (
                SELECT project_id,
                       LAG(project_id) OVER (ORDER BY timestamp) as prev_project
                FROM activity_logs
                WHERE timestamp LIKE ?1
                  AND is_idle = 0
                  AND project_id IS NOT NULL
             ) WHERE project_id != prev_project",
            params![date_prefix],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let focus_score = if total_hours > 0.0 {
        let switches_per_hour = project_switches as f64 / total_hours;
        // Fewer switches = better focus. Target: < 2 switches/hour = 100
        (100.0 - (switches_per_hour - 2.0).max(0.0) * 15.0).max(0.0).min(100.0)
    } else {
        50.0
    };

    // --- Overtime Penalty (0-100, higher = less overtime = good) ---
    let overtime_penalty = if total_hours > 10.0 {
        // Penalize for working more than 10 hours
        (100.0 - (total_hours - 10.0) * 20.0).max(0.0)
    } else if total_hours > 8.0 {
        // Light penalty for 8-10 hours
        (100.0 - (total_hours - 8.0) * 5.0).max(0.0)
    } else {
        100.0
    };

    // --- Composite Score ---
    let score = (
        schedule_adherence * 0.20
        + productivity_score * 0.25
        + break_compliance * 0.15
        + commit_frequency * 0.15
        + focus_score * 0.15
        + overtime_penalty * 0.10
    ).min(100.0);

    let grade = score_to_grade(score);

    // --- Highlights ---
    let mut highlights: Vec<String> = Vec::new();

    if productivity_score >= 70.0 {
        highlights.push(format!(
            "Verimlilik %{:.0} - Harika is cikardin!",
            productivity_score
        ));
    }
    if commit_count >= 5 {
        highlights.push(format!(
            "Bugun {} commit attin, duzenli kayit yaptin.",
            commit_count
        ));
    }
    if focus_score >= 80.0 {
        highlights.push("Odaklanma puanin yuksek, proje gecisleri az.".to_string());
    }
    if break_compliance >= 80.0 {
        highlights.push("Molalarina uygun sekilde ara verdin.".to_string());
    }
    if total_hours >= 4.0 && total_hours <= 8.0 {
        highlights.push(format!(
            "{:.1} saat calistin, saglikli bir tempo.",
            total_hours
        ));
    }
    if schedule_adherence >= 85.0 && scheduled_total > 0.0 {
        highlights.push("Planina buyuk olcude uydun, tebrikler!".to_string());
    }

    if highlights.is_empty() {
        highlights.push("Her gun bir adim, devam et!".to_string());
    }

    // --- Improvements ---
    let mut improvements: Vec<String> = Vec::new();

    if productivity_score < 50.0 && total_minutes > 60.0 {
        improvements.push(format!(
            "Dikkat dagitici uygulamalarda {:.0}dk gecirdin, azaltmayi dene.",
            distracting_minutes
        ));
    }
    if commit_count == 0 && productive_minutes > 60.0 {
        improvements.push(
            "Bugün hic commit yok. Kucuk commitleri aliskanlık haline getir.".to_string(),
        );
    }
    if focus_score < 60.0 {
        improvements.push(format!(
            "{} proje gecisi cok fazla, tek projeye odaklanmaya calis.",
            project_switches
        ));
    }
    if break_compliance < 50.0 && total_hours > 2.0 {
        improvements.push(
            "Yeterince mola vermemissin. Her 90dk'da 5dk mola ver.".to_string(),
        );
    }
    if total_hours > 10.0 {
        improvements.push(format!(
            "{:.1} saat calistin, fazla mesai sagligina zarar verebilir.",
            total_hours
        ));
    }
    if schedule_adherence < 50.0 && scheduled_total > 0.0 {
        improvements.push(
            "Planina uymadin, daha gercekci bloklar olusturmayi dene.".to_string(),
        );
    }

    let metrics = ReportMetrics {
        schedule_adherence,
        productivity_score,
        break_compliance,
        commit_frequency,
        focus_score,
        overtime_penalty,
    };

    DailyReportCard {
        date: date.to_string(),
        grade,
        score,
        metrics,
        highlights,
        improvements,
    }
}

fn empty_report(date: &str) -> DailyReportCard {
    DailyReportCard {
        date: date.to_string(),
        grade: "F".to_string(),
        score: 0.0,
        metrics: ReportMetrics {
            schedule_adherence: 0.0,
            productivity_score: 0.0,
            break_compliance: 0.0,
            commit_frequency: 0.0,
            focus_score: 0.0,
            overtime_penalty: 100.0,
        },
        highlights: vec!["Veri bulunamadi.".to_string()],
        improvements: vec!["Takip aktifken calismaya basla!".to_string()],
    }
}
