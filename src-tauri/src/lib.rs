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
            // Intelligence commands
            intelligence::commands::get_morning_brief,
            intelligence::commands::get_daily_report_card,
            intelligence::commands::get_smart_suggestion,
            intelligence::commands::get_productivity_patterns,
            // Backup commands
            backup::commands::backup_database,
            backup::commands::get_database_info,
            backup::commands::reset_database,
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
                let mut budget_manager = BudgetManager::new(db_clone);

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
