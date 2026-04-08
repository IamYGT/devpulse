use tauri::Manager;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState};
use crate::commands::AppState;

pub fn setup_enhanced_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show_dashboard = MenuItemBuilder::with_id("show_dashboard", "Dashboard Ac").build(app)?;
    let show_minibar = MenuItemBuilder::with_id("show_minibar", "MiniBar Goster/Gizle").build(app)?;
    let pause_tracking = MenuItemBuilder::with_id("pause", "Takibi Duraklat").build(app)?;
    let separator1 = tauri::menu::PredefinedMenuItem::separator(app)?;

    // Status items (non-clickable)
    let status_item = MenuItemBuilder::with_id("status", "Durum: Aktif")
        .enabled(false)
        .build(app)?;
    let project_item = MenuItemBuilder::with_id("project", "Proje: -")
        .enabled(false)
        .build(app)?;
    let time_item = MenuItemBuilder::with_id("time", "Sure: 0dk")
        .enabled(false)
        .build(app)?;

    let separator2 = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Cikis").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&status_item)
        .item(&project_item)
        .item(&time_item)
        .item(&separator1)
        .item(&show_dashboard)
        .item(&show_minibar)
        .item(&pause_tracking)
        .item(&separator2)
        .item(&quit)
        .build()?;

    let pause_handle = pause_tracking.clone();
    let status_handle = status_item.clone();
    let project_handle = project_item.clone();
    let time_handle = time_item.clone();

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("DevPulse - Productivity Tracker")
        .on_menu_event(move |app, event| {
            match event.id().as_ref() {
                "show_dashboard" => {
                    crate::window_utils::toggle_dashboard(app);
                }
                "show_minibar" => {
                    crate::window_utils::toggle_minibar(app);
                }
                "pause" => {
                    if let Some(state) = app.try_state::<AppState>() {
                        let is_tracking = {
                            let mut s = state.tracker_state.lock().unwrap();
                            s.is_tracking = !s.is_tracking;
                            s.is_tracking
                        };
                        let _ = pause_handle.set_text(if is_tracking { "Takibi Duraklat" } else { "Takibe Devam Et" });
                        let _ = status_handle.set_text(if is_tracking { "Durum: Aktif" } else { "Durum: Durduruldu" });
                    }
                }
                "quit" => app.exit(0),
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                crate::window_utils::toggle_minibar(tray.app_handle());
            }
        })
        .build(app)?;

    // Spawn thread to update tray menu status every 10 seconds
    let app_handle = app.handle().clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(10));
            if let Some(state) = app_handle.try_state::<AppState>() {
                if let Ok(s) = state.tracker_state.lock() {
                    let project_text = format!("Proje: {}", s.current_project.as_deref().unwrap_or("-"));
                    let time_text = format!("Sure: {}dk", s.today_total_minutes);
                    let _ = project_handle.set_text(&project_text);
                    let _ = time_handle.set_text(&time_text);
                }
            }
        }
    });

    Ok(())
}
