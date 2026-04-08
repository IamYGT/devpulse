use sysinfo::System;

/// Information about Claude Code's running state.
#[derive(Debug, Clone)]
pub struct ClaudeStatus {
    /// Whether any Claude-related process is currently running.
    pub is_running: bool,
    /// Estimated session duration in seconds (based on process start time).
    /// None if not running or start time unavailable.
    pub session_duration_secs: Option<u64>,
    /// Which variant was detected.
    pub variant: ClaudeVariant,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ClaudeVariant {
    /// No Claude process found.
    None,
    /// Native claude.exe / claude CLI binary.
    NativeCli,
    /// Claude Code running as a node.exe process.
    NodeBased,
    /// Claude desktop app (Electron-based).
    DesktopApp,
}

/// Check if Claude Code is currently running.
///
/// This is the original API -- returns a simple bool for backward compatibility.
pub fn is_claude_running(system: &System) -> bool {
    detect_claude(system).is_running
}

/// Detect Claude Code with detailed status information.
///
/// Checks for:
/// - `claude.exe` / `claude` native CLI process
/// - `node.exe` processes with "claude" in their command line arguments (Claude Code runs as node)
/// - Claude desktop app (Electron)
pub fn detect_claude(system: &System) -> ClaudeStatus {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let mut best_status = ClaudeStatus {
        is_running: false,
        session_duration_secs: None,
        variant: ClaudeVariant::None,
    };

    for (_pid, process) in system.processes() {
        let name = process.name().to_lowercase();

        // Check for native Claude CLI binary
        if name == "claude" || name == "claude.exe" {
            let duration = process_duration(process.start_time(), now);
            return ClaudeStatus {
                is_running: true,
                session_duration_secs: duration,
                variant: ClaudeVariant::NativeCli,
            };
        }

        // Check for Claude desktop app (Electron-based, sometimes named differently)
        if name.starts_with("claude") && (name.contains("desktop") || name.contains("electron")) {
            let duration = process_duration(process.start_time(), now);
            // Prefer NativeCli if already found, otherwise use DesktopApp
            if best_status.variant == ClaudeVariant::None {
                best_status = ClaudeStatus {
                    is_running: true,
                    session_duration_secs: duration,
                    variant: ClaudeVariant::DesktopApp,
                };
            }
            continue;
        }

        // Check for node.exe running Claude Code
        if name == "node" || name == "node.exe" {
            if is_claude_node_process(process.cmd()) {
                let duration = process_duration(process.start_time(), now);
                if best_status.variant == ClaudeVariant::None
                    || best_status.variant == ClaudeVariant::DesktopApp
                {
                    best_status = ClaudeStatus {
                        is_running: true,
                        session_duration_secs: duration,
                        variant: ClaudeVariant::NodeBased,
                    };
                }
            }
        }
    }

    best_status
}

/// Check if a node.exe process is running Claude Code by inspecting command line arguments.
fn is_claude_node_process(cmd: &[String]) -> bool {
    for arg in cmd {
        let arg_str = arg.to_lowercase();
        // Claude Code typically has paths like ".../claude-code/..." or "@anthropic-ai/claude-code"
        // or the binary is invoked as "claude" via npx/node
        if arg_str.contains("claude-code")
            || arg_str.contains("claude_code")
            || arg_str.contains("@anthropic-ai")
            || (arg_str.contains("claude") && arg_str.contains("cli"))
        {
            return true;
        }
    }
    false
}

/// Calculate process duration from start time.
fn process_duration(start_time: u64, now: u64) -> Option<u64> {
    if start_time > 0 && now >= start_time {
        Some(now - start_time)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_claude_node_process_positive() {
        let cmd: Vec<String> = vec![
            "node".to_string(),
            "/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js".to_string(),
        ];
        assert!(is_claude_node_process(&cmd));
    }

    #[test]
    fn test_is_claude_node_process_npx() {
        let cmd: Vec<String> = vec![
            "node".to_string(),
            "C:\\Users\\user\\AppData\\Roaming\\npm\\node_modules\\claude-code\\dist\\cli.js".to_string(),
        ];
        assert!(is_claude_node_process(&cmd));
    }

    #[test]
    fn test_is_claude_node_process_negative() {
        let cmd: Vec<String> = vec![
            "node".to_string(),
            "/usr/local/lib/node_modules/express/index.js".to_string(),
        ];
        assert!(!is_claude_node_process(&cmd));
    }

    #[test]
    fn test_is_claude_node_process_empty() {
        let cmd: Vec<String> = vec![];
        assert!(!is_claude_node_process(&cmd));
    }

    #[test]
    fn test_process_duration() {
        assert_eq!(process_duration(1000, 1500), Some(500));
        assert_eq!(process_duration(0, 1500), None);
        assert_eq!(process_duration(2000, 1500), None); // future start time
    }

    #[test]
    fn test_claude_status_default() {
        let status = ClaudeStatus {
            is_running: false,
            session_duration_secs: None,
            variant: ClaudeVariant::None,
        };
        assert!(!status.is_running);
        assert_eq!(status.variant, ClaudeVariant::None);
    }
}
