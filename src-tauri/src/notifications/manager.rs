use std::collections::HashMap;

pub struct NotificationManager {
    db_path: String,
    cooldowns: HashMap<String, chrono::DateTime<chrono::Local>>,
}

impl NotificationManager {
    pub fn new(db_path: String) -> Self {
        Self {
            db_path,
            cooldowns: HashMap::new(),
        }
    }

    /// Check all notification conditions. Returns list of notifications to send.
    pub fn check(&mut self, tracker_state: &crate::models::TrackerState) -> Vec<NotificationEvent> {
        let mut events = Vec::new();
        let _now = chrono::Local::now();

        // 1. Long session alert: if elapsed_seconds > 90 minutes (5400s) without break
        if tracker_state.elapsed_seconds > 5400 && !tracker_state.is_idle {
            if self.should_notify("long_session", 1800) {
                // cooldown 30min
                events.push(NotificationEvent {
                    title: "Uzun Oturum Uyarisi".to_string(),
                    body: format!(
                        "{}dk'dir ara vermeden calisiyorsun. Kisa bir mola ver!",
                        tracker_state.elapsed_seconds / 60
                    ),
                    urgency: Urgency::Warning,
                });
            }
        }

        // 2. Distracting app alert: if current category is distracting for > 5 minutes
        if tracker_state.current_category == "distracting" && tracker_state.elapsed_seconds > 300 {
            if self.should_notify("distracting_alert", 600) {
                // cooldown 10min
                events.push(NotificationEvent {
                    title: "Dikkat Dagitici Uygulama!".to_string(),
                    body: format!(
                        "{} uygulamasinda {}dk gecirdin.",
                        tracker_state.current_process_name,
                        tracker_state.elapsed_seconds / 60
                    ),
                    urgency: Urgency::Alert,
                });
            }
        }

        // 3. Daily goal check
        // (check from goals tables if a goal is almost met)

        // 4. Productivity drop alert
        if tracker_state.today_total_minutes > 60 && tracker_state.productivity_percentage < 30.0 {
            if self.should_notify("low_productivity", 3600) {
                // cooldown 1hr
                events.push(NotificationEvent {
                    title: "Verimlilik Dusuk".to_string(),
                    body: format!(
                        "Bugunun verimliligi %{:.0}. Odaklanmayi dene!",
                        tracker_state.productivity_percentage
                    ),
                    urgency: Urgency::Info,
                });
            }
        }

        // 5. Milestone celebration
        if tracker_state.today_productive_minutes > 0
            && tracker_state.today_productive_minutes % 60 == 0
        {
            let hours = tracker_state.today_productive_minutes / 60;
            if self.should_notify(&format!("milestone_{}", hours), 3600) {
                events.push(NotificationEvent {
                    title: "Tebrikler!".to_string(),
                    body: format!("Bugun {} saat uretken calistin!", hours),
                    urgency: Urgency::Success,
                });
            }
        }

        events
    }

    fn should_notify(&mut self, key: &str, cooldown_seconds: i64) -> bool {
        let now = chrono::Local::now();
        if let Some(last) = self.cooldowns.get(key) {
            if (now - *last).num_seconds() < cooldown_seconds {
                return false;
            }
        }
        self.cooldowns.insert(key.to_string(), now);
        true
    }

    /// Get the database path (for future use with goal queries).
    #[allow(dead_code)]
    pub fn db_path(&self) -> &str {
        &self.db_path
    }
}

pub struct NotificationEvent {
    pub title: String,
    pub body: String,
    pub urgency: Urgency,
}

pub enum Urgency {
    Info,
    Warning,
    Alert,
    Success,
}
