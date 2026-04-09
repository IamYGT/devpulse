use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleBlock {
    pub id: i64,
    pub date: String,           // YYYY-MM-DD
    pub project_id: i64,
    pub project_name: String,
    pub start_time: String,     // HH:MM
    pub end_time: String,       // HH:MM
    pub priority: String,       // P0, P1, P2
    pub status: String,         // planned, active, completed, skipped
    pub actual_minutes: i64,    // how long actually worked
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaySchedule {
    pub date: String,
    pub blocks: Vec<ScheduleBlock>,
    pub total_planned_minutes: i64,
    pub total_actual_minutes: i64,
    pub adherence_score: f64,   // 0-100, how well user followed schedule
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleTemplate {
    pub id: i64,
    pub name: String,
    pub blocks: Vec<TemplateBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateBlock {
    pub project_id: i64,
    pub start_time: String,
    pub end_time: String,
    pub day_of_week: i32,  // 0=Mon, 6=Sun
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleSuggestion {
    pub project_name: String,
    pub project_id: i64,
    pub suggested_minutes: i64,
    pub reason: String,
    pub priority: String,
}
