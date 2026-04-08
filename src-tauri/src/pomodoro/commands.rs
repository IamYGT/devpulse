use tauri;
use super::timer::{PomodoroState, PomodoroTimer};

pub struct PomodoroAppState {
    pub timer: PomodoroTimer,
}

#[tauri::command]
pub fn start_pomodoro(state: tauri::State<'_, PomodoroAppState>) -> PomodoroState {
    state.timer.start();
    state.timer.get_state()
}

#[tauri::command]
pub fn pause_pomodoro(state: tauri::State<'_, PomodoroAppState>) -> PomodoroState {
    let current = state.timer.get_state();
    if current.is_running {
        state.timer.pause();
    } else {
        state.timer.resume();
    }
    state.timer.get_state()
}

#[tauri::command]
pub fn skip_pomodoro(state: tauri::State<'_, PomodoroAppState>) -> String {
    state.timer.skip()
}

#[tauri::command]
pub fn stop_pomodoro(state: tauri::State<'_, PomodoroAppState>) -> PomodoroState {
    state.timer.stop();
    state.timer.get_state()
}

#[tauri::command]
pub fn get_pomodoro_state(state: tauri::State<'_, PomodoroAppState>) -> PomodoroState {
    state.timer.get_state()
}

#[tauri::command]
pub fn tick_pomodoro(state: tauri::State<'_, PomodoroAppState>, elapsed_secs: i64) -> Option<String> {
    state.timer.tick(elapsed_secs)
}

#[tauri::command]
pub fn set_pomodoro_config(
    state: tauri::State<'_, PomodoroAppState>,
    work: i64,
    short_break: i64,
    long_break: i64,
    interval: i32,
) -> PomodoroState {
    {
        let mut s = state.timer.state.lock().unwrap();
        s.work_duration = work;
        s.short_break_duration = short_break;
        s.long_break_duration = long_break;
        s.long_break_interval = interval;
    }
    state.timer.get_state()
}
