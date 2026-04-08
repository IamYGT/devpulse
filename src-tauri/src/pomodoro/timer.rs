use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PomodoroMode {
    Work,
    ShortBreak,
    LongBreak,
    Idle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PomodoroState {
    pub mode: PomodoroMode,
    pub remaining_seconds: i64,
    pub sessions_completed: i32,
    pub is_running: bool,
    pub work_duration: i64,
    pub short_break_duration: i64,
    pub long_break_duration: i64,
    pub long_break_interval: i32,
}

pub struct PomodoroTimer {
    pub state: Arc<Mutex<PomodoroState>>,
}

impl PomodoroTimer {
    pub fn new() -> Self {
        let state = PomodoroState {
            mode: PomodoroMode::Idle,
            remaining_seconds: 0,
            sessions_completed: 0,
            is_running: false,
            work_duration: 25 * 60,
            short_break_duration: 5 * 60,
            long_break_duration: 15 * 60,
            long_break_interval: 4,
        };
        Self {
            state: Arc::new(Mutex::new(state)),
        }
    }

    /// Tick the timer by elapsed_secs. Returns an optional notification message
    /// when a phase transition occurs.
    pub fn tick(&self, elapsed_secs: i64) -> Option<String> {
        let mut s = self.state.lock().unwrap();
        if !s.is_running || s.mode == PomodoroMode::Idle {
            return None;
        }

        s.remaining_seconds -= elapsed_secs;

        if s.remaining_seconds <= 0 {
            s.remaining_seconds = 0;
            return Some(Self::transition(&mut s));
        }

        None
    }

    /// Start a new work session from idle or reset state.
    pub fn start(&self) {
        let mut s = self.state.lock().unwrap();
        s.mode = PomodoroMode::Work;
        s.remaining_seconds = s.work_duration;
        s.is_running = true;
    }

    /// Pause the running timer.
    pub fn pause(&self) {
        let mut s = self.state.lock().unwrap();
        s.is_running = false;
    }

    /// Resume a paused timer.
    pub fn resume(&self) {
        let mut s = self.state.lock().unwrap();
        if s.mode != PomodoroMode::Idle {
            s.is_running = true;
        }
    }

    /// Skip to the next phase immediately.
    pub fn skip(&self) -> String {
        let mut s = self.state.lock().unwrap();
        if s.mode == PomodoroMode::Idle {
            return String::from("Zamanlayici baslatilmadi.");
        }
        Self::transition(&mut s)
    }

    /// Stop the timer entirely and reset to idle.
    pub fn stop(&self) {
        let mut s = self.state.lock().unwrap();
        s.mode = PomodoroMode::Idle;
        s.remaining_seconds = 0;
        s.is_running = false;
        s.sessions_completed = 0;
    }

    /// Get a snapshot of the current state.
    pub fn get_state(&self) -> PomodoroState {
        self.state.lock().unwrap().clone()
    }

    /// Transition to the next phase. Called when timer reaches 0 or on skip.
    fn transition(s: &mut PomodoroState) -> String {
        match s.mode {
            PomodoroMode::Work => {
                s.sessions_completed += 1;

                if s.sessions_completed % s.long_break_interval == 0 {
                    s.mode = PomodoroMode::LongBreak;
                    s.remaining_seconds = s.long_break_duration;
                    format!(
                        "Tebrikler! {} oturum tamamlandi. Uzun mola zamani!",
                        s.sessions_completed
                    )
                } else {
                    s.mode = PomodoroMode::ShortBreak;
                    s.remaining_seconds = s.short_break_duration;
                    format!(
                        "Oturum {} tamamlandi. Kisa mola zamani!",
                        s.sessions_completed
                    )
                }
            }
            PomodoroMode::ShortBreak | PomodoroMode::LongBreak => {
                s.mode = PomodoroMode::Work;
                s.remaining_seconds = s.work_duration;
                String::from("Mola bitti! Calismaya devam.")
            }
            PomodoroMode::Idle => {
                String::from("Zamanlayici hazir.")
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_timer_is_idle() {
        let timer = PomodoroTimer::new();
        let state = timer.get_state();
        assert_eq!(state.mode, PomodoroMode::Idle);
        assert_eq!(state.remaining_seconds, 0);
        assert!(!state.is_running);
    }

    #[test]
    fn test_start_begins_work() {
        let timer = PomodoroTimer::new();
        timer.start();
        let state = timer.get_state();
        assert_eq!(state.mode, PomodoroMode::Work);
        assert_eq!(state.remaining_seconds, 25 * 60);
        assert!(state.is_running);
    }

    #[test]
    fn test_tick_decrements() {
        let timer = PomodoroTimer::new();
        timer.start();
        let msg = timer.tick(10);
        assert!(msg.is_none());
        let state = timer.get_state();
        assert_eq!(state.remaining_seconds, 25 * 60 - 10);
    }

    #[test]
    fn test_work_to_short_break_transition() {
        let timer = PomodoroTimer::new();
        timer.start();
        // Tick past work duration
        let msg = timer.tick(25 * 60 + 1);
        assert!(msg.is_some());
        let state = timer.get_state();
        assert_eq!(state.mode, PomodoroMode::ShortBreak);
        assert_eq!(state.sessions_completed, 1);
    }

    #[test]
    fn test_long_break_after_4_sessions() {
        let timer = PomodoroTimer::new();
        // Complete 3 work+break cycles
        for _ in 0..3 {
            timer.start();
            {
                let mut s = timer.state.lock().unwrap();
                s.remaining_seconds = 0;
                s.sessions_completed += 1;
                s.mode = PomodoroMode::ShortBreak;
                s.remaining_seconds = s.short_break_duration;
            }
            // Skip break
            {
                let mut s = timer.state.lock().unwrap();
                s.mode = PomodoroMode::Work;
                s.remaining_seconds = s.work_duration;
            }
        }
        // Now on 4th work session - set sessions to 3 and simulate completion
        {
            let mut s = timer.state.lock().unwrap();
            s.mode = PomodoroMode::Work;
            s.remaining_seconds = 1;
            s.is_running = true;
            s.sessions_completed = 3;
        }
        let msg = timer.tick(2);
        assert!(msg.is_some());
        let state = timer.get_state();
        assert_eq!(state.mode, PomodoroMode::LongBreak);
        assert_eq!(state.sessions_completed, 4);
    }

    #[test]
    fn test_pause_resume() {
        let timer = PomodoroTimer::new();
        timer.start();
        timer.pause();
        assert!(!timer.get_state().is_running);
        timer.resume();
        assert!(timer.get_state().is_running);
    }

    #[test]
    fn test_stop_resets() {
        let timer = PomodoroTimer::new();
        timer.start();
        timer.tick(60);
        timer.stop();
        let state = timer.get_state();
        assert_eq!(state.mode, PomodoroMode::Idle);
        assert_eq!(state.sessions_completed, 0);
        assert!(!state.is_running);
    }
}
