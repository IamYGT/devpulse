use rusqlite::Connection;

pub fn initialize_database(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    conn.execute_batch("PRAGMA foreign_keys=ON;")?;

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            path TEXT,
            daily_budget_minutes INTEGER DEFAULT 0,
            category TEXT DEFAULT 'development',
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS app_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            process_name TEXT NOT NULL UNIQUE,
            category TEXT NOT NULL DEFAULT 'neutral',
            display_name TEXT
        );

        CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            window_title TEXT,
            process_name TEXT,
            project_id INTEGER REFERENCES projects(id),
            category TEXT DEFAULT 'neutral',
            duration_seconds INTEGER DEFAULT 0,
            is_idle INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS git_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            project_id INTEGER REFERENCES projects(id),
            commit_hash TEXT,
            branch TEXT,
            message TEXT,
            lines_added INTEGER DEFAULT 0,
            lines_removed INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS daily_summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            project_id INTEGER REFERENCES projects(id),
            total_minutes INTEGER DEFAULT 0,
            productive_minutes INTEGER DEFAULT 0,
            distracting_minutes INTEGER DEFAULT 0,
            idle_minutes INTEGER DEFAULT 0,
            commit_count INTEGER DEFAULT 0,
            productivity_score REAL DEFAULT 0.0,
            UNIQUE(date, project_id)
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_activity_logs_project ON activity_logs(project_id);
        CREATE INDEX IF NOT EXISTS idx_git_events_timestamp ON git_events(timestamp);
        CREATE INDEX IF NOT EXISTS idx_git_events_project ON git_events(project_id);
        CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_summaries(date);

        CREATE TABLE IF NOT EXISTS browser_tabs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            url TEXT,
            domain TEXT,
            title TEXT,
            duration_seconds INTEGER DEFAULT 0,
            category TEXT DEFAULT 'neutral'
        );
        CREATE INDEX IF NOT EXISTS idx_browser_tabs_timestamp ON browser_tabs(timestamp);

        CREATE TABLE IF NOT EXISTS vscode_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            workspace TEXT,
            workspace_path TEXT,
            active_file TEXT,
            language TEXT,
            branch TEXT,
            dirty_files INTEGER DEFAULT 0,
            open_tabs INTEGER DEFAULT 0,
            is_debugging INTEGER DEFAULT 0,
            terminal_active INTEGER DEFAULT 0,
            duration_seconds INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_vscode_events_timestamp ON vscode_events(timestamp);

        CREATE TABLE IF NOT EXISTS schedule_blocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            project_id INTEGER REFERENCES projects(id),
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            priority TEXT DEFAULT 'P1',
            status TEXT DEFAULT 'planned',
            actual_minutes INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_schedule_blocks_date ON schedule_blocks(date);

        CREATE TABLE IF NOT EXISTS schedule_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            blocks_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS enforcement_overrides (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER,
            reason TEXT NOT NULL,
            extra_minutes INTEGER DEFAULT 30,
            timestamp TEXT DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS enforcement_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER,
            level TEXT NOT NULL,
            message TEXT,
            timestamp TEXT DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS project_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            timestamp TEXT DEFAULT (datetime('now', 'localtime'))
        );
        ",
    )?;

    seed_default_categories(conn)?;

    Ok(())
}

fn seed_default_categories(conn: &Connection) -> rusqlite::Result<()> {
    let defaults = vec![
        // Productive
        ("Code - Insiders", "productive", "VS Code Insiders"),
        ("Code.exe", "productive", "VS Code"),
        ("WindowsTerminal.exe", "productive", "Windows Terminal"),
        ("cmd.exe", "productive", "Command Prompt"),
        ("powershell.exe", "productive", "PowerShell"),
        ("pwsh.exe", "productive", "PowerShell 7"),
        ("node.exe", "productive", "Node.js"),
        ("python.exe", "productive", "Python"),
        ("python3.exe", "productive", "Python 3"),
        ("git.exe", "productive", "Git"),
        ("Postman.exe", "productive", "Postman"),
        ("navicat.exe", "productive", "Navicat"),
        ("claude.exe", "productive", "Claude Code"),
        ("sublime_text.exe", "productive", "Sublime Text"),
        // Distracting
        ("discord.exe", "distracting", "Discord"),
        ("Spotify.exe", "distracting", "Spotify"),
        ("WhatsApp.exe", "distracting", "WhatsApp"),
        // Neutral
        ("explorer.exe", "neutral", "File Explorer"),
        ("SystemSettings.exe", "neutral", "Settings"),
        ("Taskmgr.exe", "neutral", "Task Manager"),
    ];

    let mut stmt = conn.prepare(
        "INSERT OR IGNORE INTO app_categories (process_name, category, display_name) VALUES (?1, ?2, ?3)",
    )?;

    for (process, category, display) in defaults {
        stmt.execute(rusqlite::params![process, category, display])?;
    }

    Ok(())
}
