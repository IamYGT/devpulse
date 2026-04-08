use sysinfo::{Pid, System};
use std::path::Path;

pub struct DetectedProject {
    pub name: String,
    pub path: String,
}

/// Try to detect a project from a process's working directory.
/// Walks up the directory tree looking for a .git directory.
pub fn detect_project_from_pid(system: &System, pid: u32) -> Option<DetectedProject> {
    let pid = Pid::from_u32(pid);
    let process = system.process(pid)?;
    let cwd = process.cwd()?;
    detect_project_from_path(cwd)
}

pub fn detect_project_from_path(path: &Path) -> Option<DetectedProject> {
    let mut current = path.to_path_buf();
    loop {
        if current.join(".git").exists() {
            let name = current.file_name()?.to_string_lossy().to_string();
            return Some(DetectedProject {
                name,
                path: current.to_string_lossy().to_string(),
            });
        }
        if !current.pop() {
            break;
        }
    }
    None
}
