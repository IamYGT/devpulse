use std::sync::{Arc, Mutex};
use chrono::Local;
use sysinfo::System;

use crate::db::queries;
use crate::models::{ActivityLog, TrackerState};
use crate::tracker::categorizer::categorize_process;
use crate::tracker::idle_detector::is_idle;
use crate::tracker::vscode_detector::parse_vscode_title;
use crate::tracker::claude_detector::is_claude_running;

#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId};

#[cfg(windows)]
fn get_foreground_window_info() -> Option<(String, u32)> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return None;
        }

        let mut title_buf = [0u16; 512];
        let len = GetWindowTextW(hwnd, &mut title_buf);
        let title = if len > 0 {
            String::from_utf16_lossy(&title_buf[..len as usize])
        } else {
            String::new()
        };

        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));

        // Guard: PID 0 means we couldn't get the process (sleep/wake transition)
        if pid == 0 {
            return None;
        }

        Some((title, pid))
    }
}

#[cfg(not(windows))]
fn get_foreground_window_info() -> Option<(String, u32)> {
    None
}

fn get_process_name_by_pid(system: &System, pid: u32) -> String {
    use sysinfo::Pid;
    let pid = Pid::from_u32(pid);
    system
        .process(pid)
        .map(|p| p.name().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

pub struct WindowTracker {
    state: Arc<Mutex<TrackerState>>,
    db_path: String,
    system: System,
    last_window_title: String,
    last_switch_time: chrono::DateTime<Local>,
    last_process_name: String,
    last_project_id: Option<i64>,
}

impl WindowTracker {
    pub fn new(state: Arc<Mutex<TrackerState>>, db_path: String) -> Self {
        Self {
            state,
            db_path,
            system: System::new_all(),
            last_window_title: String::new(),
            last_switch_time: Local::now(),
            last_process_name: String::new(),
            last_project_id: None,
        }
    }

    pub fn tick(&mut self) {
        let idle = is_idle(120);

        // Detect sleep/wake: if more than 10 minutes passed since last tick, reset
        let now = Local::now();
        let elapsed = (now - self.last_switch_time).num_seconds();
        if elapsed > 600 {
            // System was likely asleep - reset timing
            self.last_switch_time = now;
            self.last_window_title.clear();
            return; // Skip this tick, resume normal on next
        }

        // Refresh process list periodically (every ~10 ticks = 20 seconds)
        self.system.refresh_processes();

        let (title, pid) = match get_foreground_window_info() {
            Some(info) => info,
            None => return,
        };

        let process_name = get_process_name_by_pid(&self.system, pid);

        // Detect if window changed
        let window_changed = title != self.last_window_title;

        if window_changed && !self.last_window_title.is_empty() {
            // Save previous window's activity
            let duration = (Local::now() - self.last_switch_time).num_seconds().max(0);
            if duration > 0 {
                self.save_activity(duration, idle);
            }
            self.last_switch_time = Local::now();
        }

        // Open DB for category lookup and project detection
        let conn = match rusqlite::Connection::open(&self.db_path) {
            Ok(c) => { c.busy_timeout(std::time::Duration::from_secs(5)).ok(); c },
            Err(_) => return,
        };

        let category = categorize_process(&conn, &process_name, &title);

        // Detect VS Code project
        let vscode_info = parse_vscode_title(&title);
        let (project_name, project_id, current_file) = if let Some(info) = &vscode_info {
            let project = queries::get_or_create_project(&conn, &info.workspace, info.workspace_path.as_deref()).ok();
            let pid = project.as_ref().map(|p| p.id);
            (Some(info.workspace.clone()), pid, Some(info.file.clone()))
        } else {
            (None, None, None)
        };

        // Check Claude Code running
        let claude_running = is_claude_running(&self.system);

        // Get today's stats
        let today_commits = queries::get_today_commits_count(&conn).unwrap_or(0);
        let today_summaries = queries::get_today_summary(&conn).unwrap_or_default();
        let today_total: i64 = today_summaries.iter().map(|s| s.total_minutes).sum();
        let today_productive: i64 = today_summaries.iter().map(|s| s.productive_minutes).sum();
        let productivity_pct = if today_total > 0 {
            (today_productive as f64 / today_total as f64) * 100.0
        } else {
            0.0
        };

        // Budget info for current project
        let (budget_used, budget_limit) = if let Some(pid) = project_id {
            let used = queries::get_project_today_minutes(&conn, pid).unwrap_or(0);
            let limit = today_summaries.iter()
                .find(|s| s.project_id == Some(pid))
                .map(|_| {
                    conn.query_row(
                        "SELECT daily_budget_minutes FROM projects WHERE id = ?1",
                        rusqlite::params![pid],
                        |row| row.get::<_, i64>(0),
                    ).unwrap_or(0)
                })
                .unwrap_or(0);
            (used, limit)
        } else {
            (0, 0)
        };

        // Update shared state
        {
            let mut state = self.state.lock().unwrap();
            state.is_idle = idle;
            state.current_window_title = title.clone();
            state.current_process_name = process_name.clone();
            state.current_project = project_name;
            state.current_project_id = project_id;
            state.current_file = current_file;
            state.current_category = category.clone();
            state.today_commits = today_commits;
            state.today_productive_minutes = today_productive;
            state.today_total_minutes = today_total;
            state.productivity_percentage = productivity_pct;
            state.budget_used_minutes = budget_used;
            state.budget_limit_minutes = budget_limit;
            state.elapsed_seconds = (Local::now() - self.last_switch_time).num_seconds().max(0);

            if claude_running && state.current_category == "neutral" {
                state.current_category = "productive".to_string();
            }
        }

        self.last_window_title = title;
        self.last_process_name = process_name;
        self.last_project_id = project_id;
    }

    fn save_activity(&self, duration: i64, idle: bool) {
        let conn = match rusqlite::Connection::open(&self.db_path) {
            Ok(c) => { c.busy_timeout(std::time::Duration::from_secs(5)).ok(); c },
            Err(_) => return,
        };

        let category = categorize_process(&conn, &self.last_process_name, &self.last_window_title);

        let log = ActivityLog {
            id: 0,
            timestamp: self.last_switch_time.format("%Y-%m-%d %H:%M:%S").to_string(),
            window_title: Some(self.last_window_title.clone()),
            process_name: Some(self.last_process_name.clone()),
            project_id: self.last_project_id,
            category,
            duration_seconds: duration,
            is_idle: idle,
        };

        let _ = queries::insert_activity_log(&conn, &log);
    }
}
