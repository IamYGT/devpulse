use crate::commands::AppState;
use rusqlite::params;
use serde::Serialize;

use super::patterns::{detect_patterns, WorkPattern};
use super::rules::{AutomationRule, RuleAction, RuleCondition};

/* ------------------------------------------------------------------ */
/*  Category Suggestion                                                */
/* ------------------------------------------------------------------ */

#[derive(Serialize)]
pub struct CategorySuggestion {
    pub process_name: String,
    pub suggested_category: String,
    pub confidence: f64,
    pub reason: String,
}

/* ------------------------------------------------------------------ */
/*  DB Initialization (inline)                                         */
/* ------------------------------------------------------------------ */

fn ensure_automation_table(db_path: &str) {
    if let Ok(conn) = rusqlite::Connection::open(db_path) {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS automation_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                enabled INTEGER DEFAULT 1,
                condition_type TEXT NOT NULL,
                condition_value TEXT NOT NULL,
                action_type TEXT NOT NULL,
                action_value TEXT NOT NULL,
                last_triggered TEXT,
                trigger_count INTEGER DEFAULT 0
            );",
        )
        .ok();
    }
}

/* ------------------------------------------------------------------ */
/*  Commands                                                           */
/* ------------------------------------------------------------------ */

#[tauri::command]
pub fn get_automation_rules(state: tauri::State<'_, AppState>) -> Vec<AutomationRule> {
    ensure_automation_table(&state.db_path);
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let mut stmt = match conn.prepare(
        "SELECT id, name, enabled, condition_type, condition_value,
                action_type, action_value, last_triggered, trigger_count
         FROM automation_rules
         ORDER BY id DESC",
    ) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    stmt.query_map([], |row| {
        Ok(AutomationRule {
            id: row.get(0)?,
            name: row.get(1)?,
            enabled: row.get::<_, i32>(2)? != 0,
            condition: RuleCondition {
                condition_type: row.get(3)?,
                value: row.get(4)?,
            },
            action: RuleAction {
                action_type: row.get(5)?,
                value: row.get(6)?,
            },
            last_triggered: row.get(7)?,
            trigger_count: row.get(8)?,
        })
    })
    .ok()
    .map(|rows| rows.filter_map(|r| r.ok()).collect())
    .unwrap_or_default()
}

#[tauri::command]
pub fn create_automation_rule(
    state: tauri::State<'_, AppState>,
    name: String,
    condition_json: String,
    action_json: String,
) -> i64 {
    ensure_automation_table(&state.db_path);
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return -1,
    };

    let condition: RuleCondition = match serde_json::from_str(&condition_json) {
        Ok(c) => c,
        Err(_) => return -1,
    };
    let action: RuleAction = match serde_json::from_str(&action_json) {
        Ok(a) => a,
        Err(_) => return -1,
    };

    match conn.execute(
        "INSERT INTO automation_rules (name, enabled, condition_type, condition_value, action_type, action_value)
         VALUES (?1, 1, ?2, ?3, ?4, ?5)",
        params![
            name,
            condition.condition_type,
            condition.value,
            action.action_type,
            action.value,
        ],
    ) {
        Ok(_) => conn.last_insert_rowid(),
        Err(_) => -1,
    }
}

#[tauri::command]
pub fn update_automation_rule(
    state: tauri::State<'_, AppState>,
    id: i64,
    enabled: bool,
) -> bool {
    ensure_automation_table(&state.db_path);
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return false,
    };

    conn.execute(
        "UPDATE automation_rules SET enabled = ?1 WHERE id = ?2",
        params![enabled as i32, id],
    )
    .is_ok()
}

#[tauri::command]
pub fn delete_automation_rule(state: tauri::State<'_, AppState>, id: i64) -> bool {
    ensure_automation_table(&state.db_path);
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return false,
    };

    conn.execute("DELETE FROM automation_rules WHERE id = ?1", params![id])
        .is_ok()
}

#[tauri::command]
pub fn get_detected_patterns(state: tauri::State<'_, AppState>) -> Vec<WorkPattern> {
    detect_patterns(&state.db_path)
}

#[tauri::command]
pub fn get_auto_category_suggestions(
    state: tauri::State<'_, AppState>,
) -> Vec<CategorySuggestion> {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    // Known productive app keywords
    let productive_keywords = [
        "code", "vscode", "visual studio", "intellij", "webstorm", "pycharm",
        "terminal", "iterm", "cmd", "powershell", "git", "docker",
        "figma", "sketch", "postman", "insomnia",
        "notion", "obsidian", "jira", "linear", "trello",
    ];
    let distracting_keywords = [
        "youtube", "twitter", "reddit", "instagram", "facebook", "tiktok",
        "netflix", "twitch", "discord", "telegram", "whatsapp",
        "steam", "epic games", "spotify",
    ];
    let neutral_keywords = [
        "explorer", "finder", "settings", "calculator", "notepad",
        "paint", "photos", "preview",
    ];

    // Find uncategorized processes (those in activity_logs but not in app_categories)
    let mut stmt = match conn.prepare(
        "SELECT DISTINCT al.process_name, COUNT(*) as usage_count,
                SUM(al.duration_seconds) / 60 as total_minutes
         FROM activity_logs al
         LEFT JOIN app_categories ac ON LOWER(al.process_name) = LOWER(ac.process_name)
         WHERE al.process_name IS NOT NULL
           AND al.process_name != ''
           AND ac.id IS NULL
           AND al.timestamp >= date('now', '-14 days')
         GROUP BY al.process_name
         HAVING usage_count >= 3
         ORDER BY total_minutes DESC
         LIMIT 20",
    ) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    let uncategorized: Vec<(String, i64, i64)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .ok()
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();

    let mut suggestions = Vec::new();

    for (process_name, _usage_count, total_minutes) in uncategorized {
        let lower = process_name.to_lowercase();

        // Check against known keyword lists
        let mut category = "neutral";
        let mut confidence = 0.50;
        let mut reason = format!(
            "Son 14 gunde {} dakika kullanildi, otomatik siniflandirma",
            total_minutes
        );

        for kw in &productive_keywords {
            if lower.contains(kw) {
                category = "productive";
                confidence = 0.85;
                reason = format!("'{}' icerdigi icin verimli olarak siniflandirildi", kw);
                break;
            }
        }

        if category == "neutral" {
            for kw in &distracting_keywords {
                if lower.contains(kw) {
                    category = "distracting";
                    confidence = 0.85;
                    reason = format!(
                        "'{}' icerdigi icin dikkat dagitici olarak siniflandirildi",
                        kw
                    );
                    break;
                }
            }
        }

        if category == "neutral" {
            for kw in &neutral_keywords {
                if lower.contains(kw) {
                    confidence = 0.70;
                    reason = format!("'{}' icerdigi icin notr olarak siniflandirildi", kw);
                    break;
                }
            }
        }

        // Also check usage patterns: if this app is mostly used during productive hours,
        // it's likely productive
        if category == "neutral" && confidence < 0.70 {
            let productive_context: Option<i64> = conn
                .query_row(
                    "SELECT COUNT(*)
                     FROM activity_logs
                     WHERE process_name = ?1
                       AND timestamp >= date('now', '-14 days')
                       AND CAST(substr(timestamp, 12, 2) AS INTEGER) BETWEEN 9 AND 17",
                    params![process_name],
                    |row| row.get(0),
                )
                .ok();

            let total_usage: Option<i64> = conn
                .query_row(
                    "SELECT COUNT(*)
                     FROM activity_logs
                     WHERE process_name = ?1
                       AND timestamp >= date('now', '-14 days')",
                    params![process_name],
                    |row| row.get(0),
                )
                .ok();

            if let (Some(work_hours), Some(total)) = (productive_context, total_usage) {
                if total > 0 {
                    let work_ratio = work_hours as f64 / total as f64;
                    if work_ratio > 0.8 {
                        category = "productive";
                        confidence = 0.60;
                        reason = format!(
                            "Kullanimin %{:.0}'i calisma saatlerinde, verimli olabilir",
                            work_ratio * 100.0
                        );
                    }
                }
            }
        }

        suggestions.push(CategorySuggestion {
            process_name,
            suggested_category: category.to_string(),
            confidence,
            reason,
        });
    }

    suggestions
}
