#[cfg(windows)]
use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};

/// Returns true if the user has been idle for more than `threshold_seconds`.
#[cfg(windows)]
pub fn is_idle(threshold_seconds: u64) -> bool {
    unsafe {
        let mut info = LASTINPUTINFO {
            cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
            dwTime: 0,
        };
        if GetLastInputInfo(&mut info).as_bool() {
            let tick_count = windows::Win32::System::SystemInformation::GetTickCount();
            let idle_ms = tick_count.wrapping_sub(info.dwTime) as u64;
            return idle_ms > threshold_seconds * 1000;
        }
    }
    false
}

#[cfg(not(windows))]
pub fn is_idle(_threshold_seconds: u64) -> bool {
    false
}

/// Returns the number of seconds since last user input.
#[cfg(windows)]
pub fn idle_seconds() -> u64 {
    unsafe {
        let mut info = LASTINPUTINFO {
            cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
            dwTime: 0,
        };
        if GetLastInputInfo(&mut info).as_bool() {
            let tick_count = windows::Win32::System::SystemInformation::GetTickCount();
            let idle_ms = tick_count.wrapping_sub(info.dwTime) as u64;
            return idle_ms / 1000;
        }
    }
    0
}

#[cfg(not(windows))]
pub fn idle_seconds() -> u64 {
    0
}
