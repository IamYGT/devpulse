mod commands;
mod db;
mod models;
mod tracker;
mod budget;
mod pomodoro;
mod export;
mod charts;
mod goals;
mod notifications;
mod window_utils;
mod tray_menu;
mod scheduler;
mod enforcement;
mod intelligence;
mod backup;
mod performance;
mod automation;
mod security;
mod notes;

use tauri::Manager;

use std::sync::{Arc, Mutex};
use commands::AppState;
use models::TrackerState;
use tracker::window_tracker::WindowTracker;
use tracker::git_monitor::GitMonitor;
use budget::manager::{BudgetManager, BudgetAlertType};

fn get_db_path() -> String {
    let app_dir = dirs_next().unwrap_or_else(|| std::path::PathBuf::from("."));
    let db_path = app_dir.join("devpulse.db");
    db_path.to_string_lossy().to_string()
}

fn dirs_next() -> Option<std::path::PathBuf> {
    std::env::var("APPDATA")
        .ok()
        .map(|p| std::path::PathBuf::from(p).join("com.ygtlabs.devpulse"))
        .map(|p| {
            std::fs::create_dir_all(&p).ok();
            p
        })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = get_db_path();

    // Initialize database
    {
        let conn = rusqlite::Connection::open(&db_path).expect("Failed to open database");
        db::schema::initialize_database(&conn).expect("Failed to initialize database");
        goals::streaks::initialize_streaks_table(&conn).ok();
        goals::daily_goals::initialize_goals_tables(&conn).ok();
    }

    let tracker_state = Arc::new(Mutex::new(TrackerState::default()));

    let app_state = AppState {
        tracker_state: tracker_state.clone(),
        db_path: db_path.clone(),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(app_state)
        .manage(pomodoro::commands::PomodoroAppState {
            timer: pomodoro::timer::PomodoroTimer::new(),
        })
        .manage(enforcement::commands::EnforcementAppState {
            manager: std::sync::Mutex::new(enforcement::manager::EnforcementManager::new(db_path.clone())),
        })
        .invoke_handler(tauri::generate_handler![
            // Core commands
            commands::get_current_state,
            commands::get_today_timeline,
            commands::get_today_summary,
            commands::get_projects,
            commands::get_git_events,
            commands::get_weekly_trends,
            commands::set_project_budget,
            commands::pause_tracking,
            commands::resume_tracking,
            commands::save_setting,
            commands::get_setting,
            // Pomodoro commands
            pomodoro::commands::start_pomodoro,
            pomodoro::commands::pause_pomodoro,
            pomodoro::commands::skip_pomodoro,
            pomodoro::commands::stop_pomodoro,
            pomodoro::commands::get_pomodoro_state,
            pomodoro::commands::tick_pomodoro,
            pomodoro::commands::set_pomodoro_config,
            // Export commands
            export::commands::export_data_csv,
            export::commands::export_data_json,
            export::commands::generate_daily_report,
            export::commands::get_monthly_summary,
            // Chart commands
            charts::commands::get_yearly_heatmap,
            charts::commands::get_category_breakdown,
            charts::commands::get_top_apps,
            // Goals commands
            goals::commands::get_streaks,
            goals::commands::set_daily_goal,
            goals::commands::get_daily_goals,
            // Extension data commands
            commands::get_browser_history,
            commands::get_vscode_history,
            commands::get_language_breakdown,
            // Extension status commands
            commands::check_extension_status,
            commands::open_extensions_folder,
            // Scheduler commands
            scheduler::commands::get_today_schedule,
            scheduler::commands::create_schedule_block,
            scheduler::commands::update_schedule_block,
            scheduler::commands::delete_schedule_block,
            scheduler::commands::get_schedule_for_date,
            scheduler::commands::get_schedule_suggestions,
            scheduler::commands::get_schedule_adherence,
            scheduler::commands::apply_schedule_template,
            scheduler::commands::save_schedule_template,
            scheduler::commands::get_schedule_templates,
            scheduler::commands::get_next_scheduled_project,
            scheduler::commands::auto_generate_schedule,
            // Enforcement commands
            enforcement::commands::get_enforcement_status,
            enforcement::commands::request_emergency_override,
            enforcement::commands::get_overtime_report,
            enforcement::commands::get_break_status,
            enforcement::commands::dismiss_warning,
            enforcement::commands::set_enforcement_level,
            enforcement::commands::record_break_start,
            enforcement::commands::get_override_history,
            enforcement::commands::set_break_interval,
            enforcement::commands::set_daily_max_hours,
            // Intelligence commands
            intelligence::commands::get_morning_brief,
            intelligence::commands::get_daily_report_card,
            intelligence::commands::get_smart_suggestion,
            intelligence::commands::get_productivity_patterns,
            // Backup commands
            backup::commands::backup_database,
            backup::commands::get_database_info,
            backup::commands::reset_database,
            backup::commands::restore_database,
            backup::commands::get_backup_list,
            // Missing frontend-called commands
            commands::open_data_folder,
            commands::save_project_note,
            commands::get_project_notes,
            commands::set_active_project,
            commands::set_idle_threshold,
            commands::set_autostart,
            commands::get_project_last_active,
            commands::get_project_week_commits,
            commands::get_weekly_summaries,
            // Automation commands
            automation::commands::get_automation_rules,
            automation::commands::create_automation_rule,
            automation::commands::update_automation_rule,
            automation::commands::delete_automation_rule,
            automation::commands::get_detected_patterns,
            automation::commands::get_auto_category_suggestions,
            // Security commands
            security::commands::check_data_integrity,
            security::commands::fix_data_integrity,
            security::commands::cleanup_old_data,
            // Notes commands
            notes::commands::create_note,
            notes::commands::update_note,
            notes::commands::delete_note,
            notes::commands::get_notes,
            notes::commands::get_note,
            notes::commands::archive_note,
            notes::commands::pin_note,
            notes::commands::search_notes,
            notes::commands::create_tag,
            notes::commands::get_tags,
            notes::commands::tag_note,
            notes::commands::untag_note,
            notes::commands::create_todo,
            notes::commands::update_todo,
            notes::commands::delete_todo,
            notes::commands::get_todos,
            notes::commands::reorder_todos,
            notes::commands::get_today_journal,
        ])
        .setup(move |app| {
            // Setup system tray (enhanced version)
            tray_menu::setup_enhanced_tray(app)?;

            // Start background tracking loop
            let state_clone = tracker_state.clone();
            let db_clone = db_path.clone();
            let app_handle = app.handle().clone();

            std::thread::spawn(move || {
                let mut window_tracker = WindowTracker::new(state_clone.clone(), db_clone.clone());
                let mut git_monitor = GitMonitor::new(db_clone.clone());
                let mut budget_manager = BudgetManager::new(db_clone.clone());

                let mut tick_count: u64 = 0;

                loop {
                    // Check if tracking is paused
                    let is_tracking = {
                        match state_clone.lock() {
                            Ok(s) => s.is_tracking,
                            Err(poisoned) => {
                                // Recover from poisoned mutex
                                eprintln!("[DevPulse] Tracker state mutex poisoned, recovering");
                                poisoned.into_inner().is_tracking
                            }
                        }
                    };

                    if is_tracking {
                        // Window tracking every 2 seconds
                        if let Err(e) = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                            window_tracker.tick();
                        })) {
                            eprintln!("[DevPulse] Window tracker tick failed: {:?}", e);
                        }

                        // Git check every 30 seconds (15 ticks)
                        if tick_count % 15 == 0 {
                            if let Err(e) = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                                git_monitor.check_projects();
                            })) {
                                eprintln!("[DevPulse] Git monitor check failed: {:?}", e);
                            }
                        }

                        // Budget check every 60 seconds (30 ticks)
                        if tick_count % 30 == 0 {
                            match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                                budget_manager.check_budgets()
                            })) {
                                Ok(alerts) => {
                                    for alert in alerts {
                                        send_budget_notification(&app_handle, &alert);
                                    }
                                }
                                Err(e) => {
                                    eprintln!("[DevPulse] Budget check failed: {:?}", e);
                                }
                            }
                        }

                        // Enforcement check every 10 seconds (5 ticks)
                        if tick_count % 5 == 0 {
                            if let Err(e) = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                                // Read current tracker state
                                let current_state = match state_clone.lock() {
                                    Ok(s) => s.clone(),
                                    Err(p) => p.into_inner().clone(),
                                };

                                // Check enforcement via the app state's enforcement manager
                                if let Some(enf_state) = app_handle.try_state::<enforcement::commands::EnforcementAppState>() {
                                    if let Ok(mut manager) = enf_state.manager.lock() {
                                        let alerts = manager.check(&current_state);
                                        for alert in &alerts {
                                            use tauri_plugin_notification::NotificationExt;
                                            let _ = app_handle.notification()
                                                .builder()
                                                .title(&format!("DevPulse: {}", alert.project_name))
                                                .body(&alert.message)
                                                .show();
                                        }
                                    }
                                }
                            })) {
                                eprintln!("[DevPulse] Enforcement check failed: {:?}", e);
                            }
                        }

                        // Scheduler adherence check every 60 seconds (30 ticks)
                        if tick_count % 30 == 0 {
                            if let Err(e) = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                                let today = chrono::Local::now().format("%Y-%m-%d").to_string();
                                if let Ok(conn) = rusqlite::Connection::open(&db_clone) {
                                    // Check if there are schedule blocks for today
                                    let has_schedule: bool = conn.query_row(
                                        "SELECT COUNT(*) FROM schedule_blocks WHERE date = ?1",
                                        rusqlite::params![today],
                                        |row| row.get::<_, i64>(0),
                                    ).unwrap_or(0) > 0;

                                    if has_schedule {
                                        // Get current project from tracker state
                                        let current_project = match state_clone.lock() {
                                            Ok(s) => s.current_project.clone(),
                                            Err(p) => p.into_inner().current_project.clone(),
                                        };

                                        // Get the currently scheduled project
                                        let now_time = chrono::Local::now().format("%H:%M").to_string();
                                        let scheduled_project: Option<String> = conn.query_row(
                                            "SELECT p.name FROM schedule_blocks sb
                                             JOIN projects p ON p.id = sb.project_id
                                             WHERE sb.date = ?1 AND sb.start_time <= ?2 AND sb.end_time > ?2
                                             ORDER BY sb.start_time ASC LIMIT 1",
                                            rusqlite::params![today, now_time],
                                            |row| row.get(0),
                                        ).ok();

                                        if let Some(scheduled) = scheduled_project {
                                            let current_name = current_project.as_deref().unwrap_or("(yok)");
                                            if current_name != scheduled {
                                                use tauri_plugin_notification::NotificationExt;
                                                let _ = app_handle.notification()
                                                    .builder()
                                                    .title("DevPulse: Takvim Uyarisi")
                                                    .body(&format!(
                                                        "Simdi '{}' uzerinde calismaniz gerekiyor ama '{}' uzerindesiniz.",
                                                        scheduled, current_name
                                                    ))
                                                    .show();
                                            }
                                        }
                                    }
                                }
                            })) {
                                eprintln!("[DevPulse] Scheduler adherence check failed: {:?}", e);
                            }
                        }

                        // Automation rules check every 60 seconds (30 ticks)
                        if tick_count % 30 == 0 {
                            if let Err(e) = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                                let current_state = match state_clone.lock() {
                                    Ok(s) => s.clone(),
                                    Err(p) => p.into_inner().clone(),
                                };

                                // Load rules from DB
                                if let Ok(conn) = rusqlite::Connection::open(&db_clone) {
                                    let rules = load_automation_rules(&conn);
                                    let triggered = automation::rules::evaluate_rules(&rules, &current_state, &db_clone);
                                    for action in &triggered {
                                        use tauri_plugin_notification::NotificationExt;
                                        match action.action.action_type.as_str() {
                                            "notify" => {
                                                let msg = serde_json::from_str::<serde_json::Value>(&action.action.value)
                                                    .ok()
                                                    .and_then(|v| v["message"].as_str().map(String::from))
                                                    .unwrap_or_else(|| format!("Kural tetiklendi: {}", action.rule_name));
                                                let _ = app_handle.notification()
                                                    .builder()
                                                    .title("DevPulse: Otomasyon")
                                                    .body(&msg)
                                                    .show();
                                            }
                                            _ => {
                                                let _ = app_handle.notification()
                                                    .builder()
                                                    .title("DevPulse: Otomasyon")
                                                    .body(&format!("Kural tetiklendi: {}", action.rule_name))
                                                    .show();
                                            }
                                        }
                                        // Update trigger count in DB
                                        conn.execute(
                                            "UPDATE automation_rules SET trigger_count = trigger_count + 1, last_triggered = ?1 WHERE id = ?2",
                                            rusqlite::params![chrono::Local::now().to_rfc3339(), action.rule_id],
                                        ).ok();
                                    }
                                }
                            })) {
                                eprintln!("[DevPulse] Automation rules check failed: {:?}", e);
                            }
                        }
                    }

                    tick_count = tick_count.wrapping_add(1);
                    std::thread::sleep(std::time::Duration::from_secs(2));
                }
            });

            // Start HTTP receiver for extensions
            let http_state = tracker_state.clone();
            let http_db = db_path.clone();
            let receiver = tracker::http_receiver::HttpReceiver::new(http_state, http_db);
            receiver.start();

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running DevPulse");
}

/// Load automation rules from the database for the background loop
fn load_automation_rules(conn: &rusqlite::Connection) -> Vec<automation::rules::AutomationRule> {
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
        Ok(automation::rules::AutomationRule {
            id: row.get(0)?,
            name: row.get(1)?,
            enabled: row.get::<_, i32>(2)? != 0,
            condition: automation::rules::RuleCondition {
                condition_type: row.get(3)?,
                value: row.get(4)?,
            },
            action: automation::rules::RuleAction {
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

fn send_budget_notification(
    app_handle: &tauri::AppHandle,
    alert: &budget::manager::BudgetAlert,
) {
    use tauri_plugin_notification::NotificationExt;

    let (title, body) = match alert.alert_type {
        BudgetAlertType::Warning80 => (
            format!("DevPulse: {} - %80 Uyari", alert.project_name),
            format!(
                "{} projesinde bugun {}/{} dakika harcadin. Butcenin %{:.0}'ine ulastin!",
                alert.project_name, alert.used_minutes, alert.budget_minutes, alert.percentage
            ),
        ),
        BudgetAlertType::LimitReached => (
            format!("DevPulse: {} - Butce Doldu!", alert.project_name),
            format!(
                "{} projesinin gunluk butcesi doldu! {}/{} dakika. Mola ver ya da baska projeye gec.",
                alert.project_name, alert.used_minutes, alert.budget_minutes
            ),
        ),
    };

    let _ = app_handle
        .notification()
        .builder()
        .title(&title)
        .body(&body)
        .show();
}
