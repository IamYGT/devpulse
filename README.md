# DevPulse

**Intelligent Developer Productivity Tracker for Windows**

DevPulse is a native Windows desktop application that tracks your coding activity, analyzes productivity patterns, and helps you stay focused with smart scheduling, enforcement, and automation. It monitors applications, VS Code, Chrome tabs, git activity, and Claude Code sessions -- all while keeping your data 100% local.

Built with **Tauri v2** (Rust backend + React/TypeScript frontend) for minimal resource usage (~30MB RAM, 16MB binary).

> **v0.9.0** -- 175 files, 37,977 lines of code, 19 pages, 71 components, 28 Rust modules, 70+ Tauri commands.

## Features

### Activity Tracking
- **Window Monitoring** -- Tracks active window title and process name every 2 seconds
- **VS Code Integration** -- Detects workspace, active file, language, git branch, debug state
- **Chrome Tab Tracking** -- Monitors active tab URL and domain via Chrome Extension
- **Git Activity** -- Tracks commits, branches, lines added/removed per project
- **Claude Code Detection** -- Monitors Claude Code sessions and duration
- **Idle Detection** -- Detects AFK periods using Windows `GetLastInputInfo` API
- **App Categorization** -- Classifies apps as productive, distracting, or neutral (100+ site patterns)

### MiniBar Widget
Taskbar-docked, always-on-top compact widget showing:
- Current project name and category (color-coded)
- Git branch and active file
- Live timer (HH:MM:SS)
- Today's commit count, productivity %, and total time
- Budget warnings (80% orange, 100% red pulsing)
- Auto-hide mode (collapses to 4px after 3 seconds)
- Resizable and draggable

### Dashboard (19 Pages)

| Page | Description |
|------|-------------|
| **Today** | Daily summary with stat cards, activity timeline, project breakdown |
| **Week** | 7-day trends with stacked bar charts, productivity line chart, commit history |
| **Monthly** | GitHub-style heatmap calendar with productivity color coding |
| **Git** | Per-project commit list with hash, branch, message, diff stats |
| **Budget** | Project time budgets with progress bars and inline editing |
| **Pomodoro** | 25/5 timer with circular progress, focus mode, session counter |
| **Activity** | Detailed activity log and session history |
| **Insights** | AI-powered pattern detection and productivity analysis |
| **Scheduler** | Smart auto-planning with time block suggestions |
| **Enforcement** | 4-level escalating warning system for budget overruns |
| **Projects** | Project management with paths, budgets, and category assignment |
| **Morning Brief** | Auto-show daily briefing with yesterday's summary and today's plan |
| **Automation** | Rules engine for automated actions based on triggers and conditions |
| **Notes** | Full-featured note-taking system (see below) |
| **Export** | CSV/JSON data export and daily markdown reports |
| **Extensions** | Chrome Extension and VS Code Extension setup and status |
| **Data Health** | Data integrity checker and database diagnostics |
| **Settings** | Tracking control, themes, idle threshold, categories, autostart, OTA updates |
| **Welcome** | Onboarding and first-run setup |

### Notes System
A Notion + Sublime Text + Todoist hybrid built into the dashboard:
- Markdown editor with live preview
- Code snippet support with syntax highlighting
- Todo lists with checkboxes and progress tracking
- Tags and categories for organization
- Journal mode for daily entries
- Quick capture for fast note creation

### Smart Features
- **Smart Scheduler** -- Auto-plans your day based on project priorities and historical patterns
- **Enforcement System** -- 4-level escalating warnings (gentle reminder, strong warning, block suggestion, forced break) when exceeding time budgets
- **Morning Brief** -- Automatically shows a daily briefing on app launch with previous day summary and suggested plan
- **End-of-Day Summary** -- Generates a wrap-up of what you accomplished
- **AI Insights** -- Pattern detection across your work sessions to surface trends and recommendations
- **Automation Rules Engine** -- Create trigger-based rules (e.g., "if coding >3h without break, show notification")
- **Project Time Budgets** -- Set daily limits per project, get Windows notifications at 80% and 100%
- **Pomodoro Timer** -- 25min work / 5min break cycles with notifications
- **Streak Tracking** -- Consecutive productive days counter
- **5 Theme Options** -- Customizable UI themes
- **OTA Auto-Update** -- Signed updates via GitHub Releases (Ed25519)
- **Data Integrity Checker** -- Validates database consistency and repairs issues

### Extensions
- **Chrome Extension** -- Tracks active tab URL/domain, sends to DevPulse via localhost HTTP
- **VS Code Extension** -- Tracks file, language, branch, debug state, terminal activity

### UI Components
71 reusable components including shared utilities: StatCard, SkipLink, Toast, Tooltip, Modal, ProgressRing, SearchInput, TabGroup, StatusBadge, ErrorBoundary, LoadingSpinner, EmptyState, and PageTransition.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Rust (Tauri v2) |
| Frontend | React 19 + TypeScript |
| Build | Vite 6 |
| Database | SQLite (rusqlite, WAL mode) |
| Charts | Recharts |
| Windows API | `windows` crate (GetForegroundWindow, GetLastInputInfo) |
| Git | `git2` crate (libgit2) |
| Updates | tauri-plugin-updater + GitHub Releases |
| Notifications | tauri-plugin-notification |
| Icons | Lucide React |

## Installation

### From GitHub Releases (Recommended)
1. Go to [Releases](https://github.com/IamYGT/devpulse/releases)
2. Download `DevPulse_x.x.x_x64-setup.exe`
3. Run the installer

### Build from Source

**Prerequisites:**
- [Rust](https://rustup.rs/) (1.88+)
- [Node.js](https://nodejs.org/) (18+)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/) (C++ workload)

```bash
git clone https://github.com/IamYGT/devpulse.git
cd devpulse
npm install
npm run tauri build
```

The installer will be at `src-tauri/target/release/bundle/nsis/DevPulse_x.x.x_x64-setup.exe`

### Extensions Setup

**Chrome Extension:**
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `extensions/chrome/` folder

**VS Code Extension:**
```bash
cd extensions/vscode
npm install
npm run compile
```
Then in VS Code: `Developer: Install Extension from Location...` > select `extensions/vscode/`

## Architecture

```
devpulse/
├── src-tauri/src/              # Rust backend (28 modules)
│   ├── tracker/                # Window, idle, VS Code, git, Claude detection
│   ├── db/                     # SQLite schema + queries
│   ├── budget/                 # Project time budget manager
│   ├── pomodoro/               # Pomodoro timer engine
│   ├── export/                 # CSV/JSON export + daily reports
│   ├── charts/                 # Heatmap, category breakdown queries
│   ├── goals/                  # Streaks + daily goals
│   ├── scheduler/              # Smart auto-planning engine
│   ├── enforcement/            # 4-level escalating warning system
│   ├── intelligence/           # AI insights and pattern detection
│   ├── automation/             # Rules engine (triggers, conditions, actions)
│   ├── notes/                  # Notes system backend
│   ├── notifications/          # Windows notification manager
│   ├── security/               # App security utilities
│   ├── performance/            # Performance monitoring
│   ├── backup/                 # Database backup management
│   ├── commands.rs             # 70+ Tauri IPC commands
│   ├── models.rs               # Shared data structures
│   └── lib.rs                  # App setup, plugins, background threads
├── src/                        # React frontend (71 components)
│   ├── minibar/                # Taskbar-docked widget
│   ├── dashboard/
│   │   ├── pages/              # 19 dashboard pages
│   │   ├── notes/              # Notes subsystem UI
│   │   └── components/         # Dashboard-specific components
│   ├── components/             # Shared UI components
│   ├── hooks/                  # Custom React hooks
│   └── types.ts                # TypeScript interfaces
├── extensions/
│   ├── chrome/                 # Chrome tab tracker extension
│   └── vscode/                 # VS Code activity tracker extension
└── .github/workflows/          # CI/CD for auto-releases
```

## Database

All data is stored locally in SQLite at `%APPDATA%/com.ygtlabs.devpulse/devpulse.db`:

| Table | Purpose |
|-------|---------|
| `activity_logs` | Window/app usage with timestamps and durations |
| `git_events` | Commits with hash, branch, message, diff stats |
| `projects` | Tracked projects with paths and daily budgets |
| `app_categories` | Process name to category mapping |
| `browser_tabs` | Chrome tab URLs and domains |
| `vscode_events` | VS Code file, language, branch activity |
| `daily_summaries` | Aggregated daily stats per project |
| `pomodoro_sessions` | Pomodoro timer history |
| `streaks` | Consecutive productive day tracking |
| `daily_goals` | Configurable daily targets |
| `settings` | App configuration key-value store |
| `notes` | Notes, todos, journal entries |
| `automation_rules` | Trigger-based automation definitions |
| `scheduler_blocks` | Scheduled time blocks |

## Privacy

- All data stays on your machine -- no cloud, no telemetry
- SQLite database in `%APPDATA%`
- Extensions communicate only via `localhost:19876`
- No keylogging -- only window titles and process names
- You can pause tracking at any time

## Development

```bash
# Start dev server (hot-reload)
npm run tauri dev

# Run Rust tests
cd src-tauri && cargo test

# TypeScript check
npx tsc --noEmit

# Production build
npm run tauri build
```

## Releasing

```bash
# Bump version in package.json, Cargo.toml, tauri.conf.json
git add -A && git commit -m "feat: v0.x.0 - description"
git tag v0.x.0 && git push origin main --tags
# GitHub Actions builds + creates signed release automatically
```

## License

MIT

## Author

**YGT Labs AI** -- Built by [Ercan Yigit](https://github.com/IamYGT) with Claude Code
