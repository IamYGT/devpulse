use rusqlite::Connection;
use crate::db::queries;

/// Categorize a process as "productive", "distracting", or "neutral".
/// First checks the database, then falls back to heuristics.
pub fn categorize_process(conn: &Connection, process_name: &str, window_title: &str) -> String {
    // 1. Check database for explicit categorization
    if let Ok(cat) = queries::get_category_for_process(conn, process_name) {
        if cat != "neutral" {
            return cat;
        }
    }

    // 2. Heuristic: VS Code is always productive
    if window_title.contains("Visual Studio Code") {
        return "productive".to_string();
    }

    // 3. Heuristic: Browser window title analysis
    let lower_title = window_title.to_lowercase();
    if is_browser_process(process_name) {
        return categorize_browser_title(&lower_title);
    }

    // 4. Heuristic: Terminal/dev tools
    let lower_process = process_name.to_lowercase();
    if is_dev_tool(&lower_process) {
        return "productive".to_string();
    }

    "neutral".to_string()
}

fn is_browser_process(process_name: &str) -> bool {
    let lower = process_name.to_lowercase();
    lower.contains("chrome")
        || lower.contains("msedge")
        || lower.contains("firefox")
        || lower.contains("brave")
        || lower.contains("opera")
        || lower.contains("vivaldi")
        || lower.contains("arc")
}

fn categorize_browser_title(title: &str) -> String {
    // DevTools is always productive regardless of what site is open
    if title.contains("devtools") || title.contains("developer tools") {
        return "productive".to_string();
    }

    // Localhost / development servers are always productive
    if is_local_dev_url(title) {
        return "productive".to_string();
    }

    // Extract domain from browser title for better matching
    let domain = extract_domain_from_title(title);
    let check_target = domain.as_deref().unwrap_or(title);

    // Distracting sites
    if is_distracting_site(title, check_target) {
        return "distracting".to_string();
    }

    // Productive sites
    if is_productive_site(title, check_target) {
        return "productive".to_string();
    }

    "neutral".to_string()
}

/// Check if the browser title indicates a local development server.
fn is_local_dev_url(title: &str) -> bool {
    title.contains("localhost")
        || title.contains("127.0.0.1")
        || title.contains("0.0.0.0")
        // Match port patterns like ":3000", ":8080", ":5173", etc.
        || has_port_number(title)
}

/// Check if title contains a port number pattern (common dev server ports).
fn has_port_number(title: &str) -> bool {
    let dev_ports = [
        ":3000", ":3001", ":3002", ":4000", ":4200", ":4321",
        ":5000", ":5173", ":5174", ":5500", ":5501",
        ":8000", ":8080", ":8081", ":8443", ":8888", ":8890",
        ":9000", ":9090", ":9229",
    ];
    dev_ports.iter().any(|port| title.contains(port))
}

/// Try to extract domain from browser title.
/// Common patterns:
/// - "Page Title - Domain.com - Google Chrome"
/// - "Page Title - Domain.com - Mozilla Firefox"
/// - "Domain.com - Google Chrome"
fn extract_domain_from_title(title: &str) -> Option<String> {
    // Browser suffixes to strip
    let browser_suffixes = [
        " - google chrome",
        " - mozilla firefox",
        " - microsoft edge",
        " - brave",
        " - opera",
        " - vivaldi",
        " - arc",
        " - chromium",
    ];

    let mut cleaned = title.to_string();
    for suffix in &browser_suffixes {
        if let Some(stripped) = cleaned.strip_suffix(suffix) {
            cleaned = stripped.to_string();
            break;
        }
    }

    // After stripping browser name, the last " - " separated segment is often the domain
    if let Some(last_dash) = cleaned.rfind(" - ") {
        let candidate = cleaned[last_dash + 3..].trim();
        // Basic check: does it look like a domain?
        if candidate.contains('.') && !candidate.contains(' ') {
            return Some(candidate.to_lowercase());
        }
    }

    // The whole remaining string might be a domain
    let trimmed = cleaned.trim();
    if trimmed.contains('.') && !trimmed.contains(' ') && trimmed.len() < 100 {
        return Some(trimmed.to_lowercase());
    }

    None
}

fn is_distracting_site(title: &str, domain: &str) -> bool {
    let distracting_patterns = [
        // Social media
        "youtube",
        "twitter",
        "x.com",
        "reddit",
        "instagram",
        "facebook",
        "tiktok",
        "twitch",
        "pinterest",
        "tumblr",
        "snapchat",
        "threads.net",
        // LinkedIn is social when browsing feed, but could be productive for job-related work.
        // Categorize as distracting since most usage is social scrolling.
        "linkedin",
        // Entertainment / streaming
        "netflix",
        "hulu",
        "disney+",
        "disneyplus",
        "primevideo",
        "spotify",
        "soundcloud",
        "twitch.tv",
        "crunchyroll",
        // News / media (Turkish "haber" sites + general)
        "haber",
        "9gag",
        "buzzfeed",
        "boredpanda",
        // Gaming
        "store.steampowered",
        "epicgames",
        // Shopping (note: "amazon.com" without qualifier to avoid matching aws.amazon)
        "amazon.com/",
        "amazon.com.tr",
        "www.amazon",
        "trendyol",
        "hepsiburada",
        "aliexpress",
    ];

    for pattern in &distracting_patterns {
        if title.contains(pattern) || domain.contains(pattern) {
            return true;
        }
    }
    false
}

fn is_productive_site(title: &str, domain: &str) -> bool {
    let productive_patterns = [
        // Code hosting / version control
        "github",
        "gitlab",
        "bitbucket",
        "codeberg",
        // Q&A / knowledge
        "stackoverflow",
        "stack overflow",
        "stackexchange",
        "serverfault",
        "superuser",
        "askubuntu",
        // Documentation
        "docs.",
        "documentation",
        "docs/",
        "wiki",
        "mdn web docs",
        "devdocs.io",
        "man page",
        // Package registries
        "npm",
        "crates.io",
        "pypi.org",
        "pkg.go.dev",
        "pub.dev",
        "nuget",
        "maven",
        "rubygems",
        // Language / framework docs
        "rust",
        "react",
        "nextjs.org",
        "vuejs.org",
        "angular.io",
        "svelte.dev",
        "tailwindcss",
        "typescriptlang",
        "python.org",
        "go.dev",
        "kotlinlang",
        "dart.dev",
        "learn.microsoft",
        // Cloud / infrastructure
        "aws.amazon",
        "console.aws",
        "azure.com",
        "portal.azure",
        "cloud.google",
        "console.cloud.google",
        "digitalocean",
        "cloudflare",
        "vercel",
        "netlify",
        "render.com",
        "railway.app",
        "fly.io",
        "heroku",
        // Database / backend services
        "supabase",
        "firebase",
        "prisma",
        "planetscale",
        "neon.tech",
        "mongodb.com",
        // AI / coding tools
        "claude.ai",
        "chatgpt",
        "v0.dev",
        "cursor.com",
        "copilot",
        "anthropic",
        "openai.com",
        // Project management / productivity
        "linear",
        "jira",
        "notion",
        "figma",
        "miro",
        "asana",
        "trello",
        "clickup",
        "confluence",
        // API / testing
        "postman",
        "swagger",
        "insomnia",
        "graphql",
        // Design
        "dribbble",
        "canva.com",
        // CI/CD
        "actions", // GitHub Actions
        "circleci",
        "travis",
        "jenkins",
        // Container / orchestration
        "docker",
        "kubernetes",
        "hub.docker",
    ];

    for pattern in &productive_patterns {
        if title.contains(pattern) || domain.contains(pattern) {
            return true;
        }
    }

    // Additional heuristic: if title contains "API", "SDK", "docs" it is likely productive
    if title.contains(" api ") || title.contains(" sdk ") || title.ends_with(" api") {
        return true;
    }

    false
}

fn is_dev_tool(process_name: &str) -> bool {
    let dev_tools = [
        // Runtimes / compilers
        "node",
        "python",
        "cargo",
        "rustc",
        "go",
        "java",
        "javac",
        "dotnet",
        "ruby",
        "php",
        "deno",
        "bun",
        // Version control
        "git",
        // Package managers
        "npm",
        "yarn",
        "pnpm",
        // Containers
        "docker",
        "kubectl",
        "terraform",
        "podman",
        // Terminals
        "windowsterminal",
        "cmd",
        "powershell",
        "pwsh",
        "wt", // Windows Terminal
        "alacritty",
        "wezterm",
        "hyper",
        // Editors / IDEs
        "sublime_text",
        "notepad++",
        "vim",
        "nvim",
        "emacs",
        "idea64", // IntelliJ
        "webstorm",
        "pycharm",
        "goland",
        "rider",
        "clion",
        "datagrip",
        // Dev tools
        "postman",
        "navicat",
        "claude",
        "dbeaver",
        "pgadmin",
        "redis-cli",
        "mongosh",
        // Design
        "figma",
        // Misc
        "wsl",
        "ssh",
        "tmux",
    ];

    for tool in &dev_tools {
        if process_name.contains(tool) {
            return true;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- Browser detection ---
    #[test]
    fn test_browser_detection() {
        assert!(is_browser_process("chrome.exe"));
        assert!(is_browser_process("msedge.exe"));
        assert!(is_browser_process("brave.exe"));
        assert!(is_browser_process("firefox.exe"));
        assert!(is_browser_process("opera.exe"));
        assert!(!is_browser_process("notepad.exe"));
    }

    // --- Domain extraction ---
    #[test]
    fn test_extract_domain_chrome() {
        let domain = extract_domain_from_title("DevPulse Tracker - github.com - google chrome");
        assert_eq!(domain, Some("github.com".to_string()));
    }

    #[test]
    fn test_extract_domain_edge() {
        let domain = extract_domain_from_title("AWS Console - console.aws.amazon.com - microsoft edge");
        assert_eq!(domain, Some("console.aws.amazon.com".to_string()));
    }

    #[test]
    fn test_extract_domain_no_browser_suffix() {
        // When no browser suffix matches, try last segment
        let domain = extract_domain_from_title("My Page - example.com");
        assert_eq!(domain, Some("example.com".to_string()));
    }

    // --- Distracting sites ---
    #[test]
    fn test_youtube_distracting() {
        assert_eq!(
            categorize_browser_title("funny video - youtube - google chrome"),
            "distracting"
        );
    }

    #[test]
    fn test_twitter_distracting() {
        assert_eq!(
            categorize_browser_title("home / x.com - google chrome"),
            "distracting"
        );
    }

    #[test]
    fn test_reddit_distracting() {
        assert_eq!(
            categorize_browser_title("r/rust - reddit - google chrome"),
            "distracting"
        );
    }

    #[test]
    fn test_twitch_distracting() {
        assert_eq!(
            categorize_browser_title("some stream - twitch - google chrome"),
            "distracting"
        );
    }

    #[test]
    fn test_tiktok_distracting() {
        assert_eq!(
            categorize_browser_title("for you - tiktok - google chrome"),
            "distracting"
        );
    }

    #[test]
    fn test_pinterest_distracting() {
        assert_eq!(
            categorize_browser_title("home - pinterest - google chrome"),
            "distracting"
        );
    }

    #[test]
    fn test_linkedin_distracting() {
        assert_eq!(
            categorize_browser_title("feed | linkedin - google chrome"),
            "distracting"
        );
    }

    #[test]
    fn test_haber_distracting() {
        assert_eq!(
            categorize_browser_title("son dakika haber - ntv - google chrome"),
            "distracting"
        );
    }

    // --- Productive sites ---
    #[test]
    fn test_github_productive() {
        assert_eq!(
            categorize_browser_title("devpulse - github - google chrome"),
            "productive"
        );
    }

    #[test]
    fn test_stackoverflow_productive() {
        assert_eq!(
            categorize_browser_title("how to parse string - stackoverflow - google chrome"),
            "productive"
        );
    }

    #[test]
    fn test_aws_productive() {
        assert_eq!(
            categorize_browser_title("s3 buckets - console.aws.amazon.com - google chrome"),
            "productive"
        );
    }

    #[test]
    fn test_azure_productive() {
        assert_eq!(
            categorize_browser_title("resource groups - portal.azure.com - microsoft edge"),
            "productive"
        );
    }

    #[test]
    fn test_supabase_productive() {
        assert_eq!(
            categorize_browser_title("my project - supabase - google chrome"),
            "productive"
        );
    }

    #[test]
    fn test_tailwindcss_productive() {
        assert_eq!(
            categorize_browser_title("flex - tailwindcss docs - google chrome"),
            "productive"
        );
    }

    #[test]
    fn test_nextjs_productive() {
        assert_eq!(
            categorize_browser_title("routing - nextjs.org - google chrome"),
            "productive"
        );
    }

    #[test]
    fn test_prisma_productive() {
        assert_eq!(
            categorize_browser_title("schema - prisma docs - google chrome"),
            "productive"
        );
    }

    #[test]
    fn test_cloudflare_productive() {
        assert_eq!(
            categorize_browser_title("workers - cloudflare dashboard - google chrome"),
            "productive"
        );
    }

    #[test]
    fn test_digitalocean_productive() {
        assert_eq!(
            categorize_browser_title("droplets - digitalocean - google chrome"),
            "productive"
        );
    }

    // --- DevTools / localhost ---
    #[test]
    fn test_devtools_productive() {
        assert_eq!(
            categorize_browser_title("devtools - localhost:3000 - google chrome"),
            "productive"
        );
    }

    #[test]
    fn test_localhost_productive() {
        assert_eq!(
            categorize_browser_title("my app - localhost:3000 - google chrome"),
            "productive"
        );
    }

    #[test]
    fn test_127_productive() {
        assert_eq!(
            categorize_browser_title("api test - 127.0.0.1:8080 - google chrome"),
            "productive"
        );
    }

    #[test]
    fn test_port_number_productive() {
        assert_eq!(
            categorize_browser_title("vite app - http://192.168.1.5:5173 - google chrome"),
            "productive"
        );
    }

    // --- Dev tools process detection ---
    #[test]
    fn test_dev_tool_processes() {
        assert!(is_dev_tool("node"));
        assert!(is_dev_tool("python3"));
        assert!(is_dev_tool("cargo"));
        assert!(is_dev_tool("docker"));
        assert!(is_dev_tool("kubectl"));
        assert!(is_dev_tool("claude"));
        assert!(is_dev_tool("wt")); // Windows Terminal
        assert!(!is_dev_tool("notepad"));
        assert!(!is_dev_tool("spotify"));
    }

    // --- Neutral ---
    #[test]
    fn test_neutral_site() {
        assert_eq!(
            categorize_browser_title("some random page - google chrome"),
            "neutral"
        );
    }
}
