use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationRule {
    pub id: i64,
    pub name: String,
    pub enabled: bool,
    pub condition: RuleCondition,
    pub action: RuleAction,
    pub last_triggered: Option<String>,
    pub trigger_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleCondition {
    pub condition_type: String,  // "time_exceeded", "app_opened", "idle_detected", "schedule_missed"
    pub value: String,           // JSON-encoded parameters
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleAction {
    pub action_type: String,     // "notify", "pause_tracking", "switch_project", "start_pomodoro"
    pub value: String,           // JSON-encoded parameters
}

#[derive(Debug, Clone, Serialize)]
pub struct TriggeredAction {
    pub rule_id: i64,
    pub rule_name: String,
    pub action: RuleAction,
}

pub fn evaluate_rules(
    rules: &[AutomationRule],
    state: &crate::models::TrackerState,
    db_path: &str,
) -> Vec<TriggeredAction> {
    let mut actions = Vec::new();
    for rule in rules {
        if !rule.enabled {
            continue;
        }
        if check_condition(&rule.condition, state, db_path) {
            actions.push(TriggeredAction {
                rule_id: rule.id,
                rule_name: rule.name.clone(),
                action: rule.action.clone(),
            });
        }
    }
    actions
}

fn check_condition(
    cond: &RuleCondition,
    state: &crate::models::TrackerState,
    _db_path: &str,
) -> bool {
    match cond.condition_type.as_str() {
        "time_exceeded" => {
            // Value: {"project_id": 1, "minutes": 120}
            if let Ok(params) = serde_json::from_str::<serde_json::Value>(&cond.value) {
                let minutes = params["minutes"].as_i64().unwrap_or(120);
                state.elapsed_seconds > minutes * 60
            } else {
                false
            }
        }
        "productivity_below" => {
            // Value: {"percentage": 50}
            if let Ok(params) = serde_json::from_str::<serde_json::Value>(&cond.value) {
                let threshold = params["percentage"].as_f64().unwrap_or(50.0);
                state.productivity_percentage < threshold && state.today_total_minutes > 30
            } else {
                false
            }
        }
        "idle_detected" => state.is_idle,
        "distracting_app" => state.current_category == "distracting",
        "no_commits" => {
            // Value: {"hours": 2}
            if let Ok(params) = serde_json::from_str::<serde_json::Value>(&cond.value) {
                let hours = params["hours"].as_i64().unwrap_or(2);
                state.today_commits == 0 && state.today_productive_minutes > hours * 60
            } else {
                false
            }
        }
        _ => false,
    }
}
