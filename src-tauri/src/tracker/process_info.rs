use sysinfo::{Pid, System};

/// Get process name from PID using sysinfo.
pub fn get_process_name(system: &System, pid: u32) -> String {
    let pid = Pid::from_u32(pid);
    system
        .process(pid)
        .map(|p| p.name().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

/// Get the full executable path for a process.
pub fn get_process_exe_path(system: &System, pid: u32) -> Option<String> {
    let pid = Pid::from_u32(pid);
    system
        .process(pid)
        .and_then(|p| p.exe().map(|e| e.to_string_lossy().to_string()))
}
