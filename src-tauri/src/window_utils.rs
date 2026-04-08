use tauri::Manager;

/// Position the minibar window just above the taskbar, right-aligned.
/// Call this on startup and when screen resolution changes.
pub fn position_minibar_above_taskbar(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("minibar") {
        // Get primary monitor working area
        if let Ok(Some(monitor)) = window.primary_monitor() {
            let screen = monitor.size();
            let work_area_height = screen.height; // approximate
            let taskbar_height: u32 = 48; // Windows 11 default
            let widget_width: u32 = 260;
            let widget_height: u32 = 28;
            let margin: u32 = 8;

            let x = (screen.width - widget_width - margin) as i32;
            let y = (work_area_height - taskbar_height - widget_height - margin) as i32;

            let _ = window.set_position(tauri::LogicalPosition::new(x as f64, y as f64));
            let _ = window.set_size(tauri::LogicalSize::new(widget_width as f64, widget_height as f64));
        }
    }
}

/// Toggle dashboard window visibility
pub fn toggle_dashboard(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("dashboard") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.center();
        }
    }
}

/// Toggle minibar window visibility
pub fn toggle_minibar(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("minibar") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
        }
    }
}
