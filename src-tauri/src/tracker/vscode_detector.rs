use std::path::Path;

/// Information parsed from VS Code window title.
#[derive(Debug, Clone)]
pub struct VsCodeInfo {
    pub file: String,
    pub workspace: String,
    pub workspace_path: Option<String>,
    /// File extension (e.g. "rs", "ts", "py") for language detection.
    pub file_extension: Option<String>,
    /// Whether this is VS Code Insiders edition.
    pub is_insiders: bool,
    /// Git branch name if shown in title (some extensions add it).
    pub git_branch: Option<String>,
}

/// Parse VS Code or VS Code Insiders window title.
///
/// Handles these patterns:
/// - `{file} - {workspace} - Visual Studio Code - Insiders`
/// - `{workspace} - Visual Studio Code - Insiders`
/// - `Welcome - {workspace} - Visual Studio Code - Insiders`
/// - `{file} - {workspace} [Git: branch] - Visual Studio Code - Insiders`
/// - Same patterns without "- Insiders" for regular VS Code
/// - `Get Started - {workspace} - Visual Studio Code`
/// - `Settings - {workspace} - Visual Studio Code`
/// - `{file} (Working Tree) - {workspace} - Visual Studio Code`
pub fn parse_vscode_title(title: &str) -> Option<VsCodeInfo> {
    if !title.contains("Visual Studio Code") {
        return None;
    }

    let is_insiders = title.contains("Insiders");
    let suffix = if is_insiders {
        " - Visual Studio Code - Insiders"
    } else {
        " - Visual Studio Code"
    };

    let prefix = title.strip_suffix(suffix)?;

    // Check for git branch pattern: "workspace [Git: branch]" or "file - workspace [Git: branch]"
    let (prefix_clean, git_branch) = extract_git_branch(prefix);

    let parts: Vec<&str> = prefix_clean.splitn(2, " - ").collect();

    match parts.len() {
        2 => {
            let raw_file = parts[0].trim();
            let workspace = parts[1].trim();

            // Clean up file name: remove markers like "(Working Tree)", "(Deleted)", etc.
            let file = clean_file_name(raw_file);
            let file_extension = extract_extension(&file);

            // Check if "file" part is actually a special tab
            let is_special_tab = is_special_tab_name(&file);

            Some(VsCodeInfo {
                file: if is_special_tab { String::new() } else { file },
                workspace: workspace.to_string(),
                workspace_path: try_resolve_workspace_path(workspace),
                file_extension: if is_special_tab { None } else { file_extension },
                is_insiders,
                git_branch,
            })
        }
        1 => Some(VsCodeInfo {
            file: String::new(),
            workspace: parts[0].trim().to_string(),
            workspace_path: try_resolve_workspace_path(parts[0].trim()),
            file_extension: None,
            is_insiders,
            git_branch,
        }),
        _ => None,
    }
}

/// Extract git branch from title segment like "workspace [Git: main]".
/// Returns the cleaned prefix and optional branch name.
fn extract_git_branch(prefix: &str) -> (String, Option<String>) {
    // Pattern: "... [Git: branch_name]"
    if let Some(bracket_start) = prefix.rfind(" [Git: ") {
        if let Some(bracket_end) = prefix[bracket_start..].rfind(']') {
            let branch = &prefix[bracket_start + 7..bracket_start + bracket_end];
            let clean = prefix[..bracket_start].to_string();
            return (clean, Some(branch.trim().to_string()));
        }
    }
    // Also handle "[branch]" pattern without "Git:" prefix (some extensions)
    if let Some(bracket_start) = prefix.rfind(" [") {
        if let Some(bracket_end) = prefix[bracket_start..].rfind(']') {
            let inner = &prefix[bracket_start + 2..bracket_start + bracket_end];
            // Only treat as branch if it looks like a branch name (no spaces, reasonable chars)
            if !inner.is_empty()
                && !inner.contains(' ')
                && inner.len() < 64
                && inner.chars().all(|c| c.is_alphanumeric() || "-_./".contains(c))
            {
                let clean = prefix[..bracket_start].to_string();
                return (clean, Some(inner.to_string()));
            }
        }
    }
    (prefix.to_string(), None)
}

/// Clean up VS Code file name by removing annotations.
fn clean_file_name(raw: &str) -> String {
    let mut name = raw.to_string();
    // Remove common VS Code annotations
    for suffix in &[
        " (Working Tree)",
        " (Deleted)",
        " (Modified)",
        " (Untracked)",
        " (Index)",
    ] {
        if let Some(stripped) = name.strip_suffix(suffix) {
            name = stripped.to_string();
        }
    }
    // Remove leading dot-prefix markers like "U " or "M " (git status indicators some themes show)
    name.trim().to_string()
}

/// Check if a name is a special VS Code tab (not a real file).
fn is_special_tab_name(name: &str) -> bool {
    let special_tabs = [
        "Welcome",
        "Get Started",
        "Settings",
        "Keyboard Shortcuts",
        "Extensions",
        "Release Notes",
        "Interactive Playground",
        "Walkthrough",
        "Output",
        "Terminal",
        "Debug Console",
        "Problems",
    ];
    special_tabs.iter().any(|t| name.eq_ignore_ascii_case(t))
}

/// Extract file extension from a filename.
fn extract_extension(filename: &str) -> Option<String> {
    if filename.is_empty() {
        return None;
    }
    Path::new(filename)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase())
}

/// Try to resolve workspace path from VS Code recent storage.
/// This checks common VS Code storage locations on Windows.
fn try_resolve_workspace_path(workspace_name: &str) -> Option<String> {
    if workspace_name.is_empty() {
        return None;
    }

    // Check if workspace name is already a path
    if workspace_name.contains('/') || workspace_name.contains('\\') {
        return Some(workspace_name.to_string());
    }

    // Try common locations
    if let Ok(user_profile) = std::env::var("USERPROFILE") {
        let candidates = [
            format!("{}\\Desktop\\{}", user_profile, workspace_name),
            format!("{}\\Documents\\{}", user_profile, workspace_name),
            format!("{}\\projects\\{}", user_profile, workspace_name),
            format!("{}\\repos\\{}", user_profile, workspace_name),
            format!("{}\\source\\repos\\{}", user_profile, workspace_name),
            format!("{}\\OneDrive\\Desktop\\{}", user_profile, workspace_name),
            format!("{}\\OneDrive\\Documents\\{}", user_profile, workspace_name),
        ];

        for candidate in &candidates {
            if Path::new(candidate).is_dir() {
                return Some(candidate.clone());
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_insiders_title() {
        let title = "main.rs - devpulse - Visual Studio Code - Insiders";
        let info = parse_vscode_title(title).unwrap();
        assert_eq!(info.file, "main.rs");
        assert_eq!(info.workspace, "devpulse");
        assert!(info.is_insiders);
        assert_eq!(info.file_extension, Some("rs".to_string()));
    }

    #[test]
    fn test_parse_workspace_only() {
        let title = "devpulse - Visual Studio Code - Insiders";
        let info = parse_vscode_title(title).unwrap();
        assert_eq!(info.file, "");
        assert_eq!(info.workspace, "devpulse");
        assert!(info.is_insiders);
        assert!(info.file_extension.is_none());
    }

    #[test]
    fn test_non_vscode() {
        assert!(parse_vscode_title("Some other window").is_none());
    }

    #[test]
    fn test_regular_vscode() {
        let title = "index.ts - my-project - Visual Studio Code";
        let info = parse_vscode_title(title).unwrap();
        assert_eq!(info.file, "index.ts");
        assert_eq!(info.workspace, "my-project");
        assert!(!info.is_insiders);
        assert_eq!(info.file_extension, Some("ts".to_string()));
    }

    #[test]
    fn test_welcome_tab() {
        let title = "Welcome - devpulse - Visual Studio Code - Insiders";
        let info = parse_vscode_title(title).unwrap();
        assert_eq!(info.file, ""); // Welcome is a special tab
        assert_eq!(info.workspace, "devpulse");
    }

    #[test]
    fn test_get_started_tab() {
        let title = "Get Started - my-app - Visual Studio Code";
        let info = parse_vscode_title(title).unwrap();
        assert_eq!(info.file, "");
        assert_eq!(info.workspace, "my-app");
    }

    #[test]
    fn test_settings_tab() {
        let title = "Settings - my-app - Visual Studio Code - Insiders";
        let info = parse_vscode_title(title).unwrap();
        assert_eq!(info.file, "");
        assert_eq!(info.workspace, "my-app");
    }

    #[test]
    fn test_git_branch_in_title() {
        let title = "main.rs - devpulse [Git: feature/new-ui] - Visual Studio Code - Insiders";
        let info = parse_vscode_title(title).unwrap();
        assert_eq!(info.file, "main.rs");
        assert_eq!(info.workspace, "devpulse");
        assert_eq!(info.git_branch, Some("feature/new-ui".to_string()));
    }

    #[test]
    fn test_simple_branch_bracket() {
        let title = "lib.rs - myproject [main] - Visual Studio Code";
        let info = parse_vscode_title(title).unwrap();
        assert_eq!(info.file, "lib.rs");
        assert_eq!(info.workspace, "myproject");
        assert_eq!(info.git_branch, Some("main".to_string()));
    }

    #[test]
    fn test_working_tree_suffix() {
        let title = "main.rs (Working Tree) - devpulse - Visual Studio Code - Insiders";
        let info = parse_vscode_title(title).unwrap();
        assert_eq!(info.file, "main.rs");
        assert_eq!(info.workspace, "devpulse");
        assert_eq!(info.file_extension, Some("rs".to_string()));
    }

    #[test]
    fn test_python_file_extension() {
        let title = "app.py - backend - Visual Studio Code";
        let info = parse_vscode_title(title).unwrap();
        assert_eq!(info.file_extension, Some("py".to_string()));
    }

    #[test]
    fn test_tsx_file_extension() {
        let title = "Component.tsx - frontend - Visual Studio Code - Insiders";
        let info = parse_vscode_title(title).unwrap();
        assert_eq!(info.file_extension, Some("tsx".to_string()));
    }

    #[test]
    fn test_no_extension_file() {
        let title = "Dockerfile - my-app - Visual Studio Code";
        let info = parse_vscode_title(title).unwrap();
        assert_eq!(info.file, "Dockerfile");
        assert!(info.file_extension.is_none());
    }

    #[test]
    fn test_workspace_only_regular_vscode() {
        let title = "my-project - Visual Studio Code";
        let info = parse_vscode_title(title).unwrap();
        assert_eq!(info.file, "");
        assert_eq!(info.workspace, "my-project");
        assert!(!info.is_insiders);
    }

    #[test]
    fn test_extract_git_branch_helper() {
        let (clean, branch) = extract_git_branch("devpulse [Git: main]");
        assert_eq!(clean, "devpulse");
        assert_eq!(branch, Some("main".to_string()));

        let (clean, branch) = extract_git_branch("devpulse [develop]");
        assert_eq!(clean, "devpulse");
        assert_eq!(branch, Some("develop".to_string()));

        let (clean, branch) = extract_git_branch("devpulse");
        assert_eq!(clean, "devpulse");
        assert!(branch.is_none());
    }

    #[test]
    fn test_extract_extension_helper() {
        assert_eq!(extract_extension("main.rs"), Some("rs".to_string()));
        assert_eq!(extract_extension("app.test.tsx"), Some("tsx".to_string()));
        assert_eq!(extract_extension("Dockerfile"), None);
        assert_eq!(extract_extension(""), None);
        // .gitignore has no extension per std::path::Path rules (leading dot = stem, not extension)
        assert_eq!(extract_extension(".gitignore"), None);
    }
}
