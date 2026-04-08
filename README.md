# DevPulse

**Developer Productivity Tracker for Windows**

DevPulse is a native Windows desktop application that tracks your coding activity in real-time. It monitors which applications you use, what you're working on in VS Code, which browser tabs are active, and gives you detailed productivity analytics - all while keeping your data 100% local.

Built with **Tauri v2** (Rust backend + React/TypeScript frontend) for minimal resource usage (~30MB RAM, 16MB binary).

## Features

### Real-Time Tracking
- **Window Monitoring** - Tracks active window title and process name every 2 seconds
- **VS Code Integration** - Detects workspace, active file, language, git branch, debug state
- **Chrome Tab Tracking** - Monitors active tab URL and domain via Chrome Extension
- **Git Activity** - Tracks commits, branches, lines added/removed per project
- **Claude Code Detection** - Monitors Claude Code sessions and duration
- **Idle Detection** - Detects AFK periods using Windows `GetLastInputInfo` API
- **App Categorization** - Classifies apps as productive, distracting, or neutral (100+ site patterns)

### MiniBar Widget
Always-on-top transparent overlay at the top of your screen showing:
- Current project name and category (color-coded)
- Git branch and active file
- Live timer (HH:MM:SS)
- Today's commit count, productivity %, and total time
- Budget warnings (80% orange, 100% red pulsing)
- Auto-hide mode (collapses to 4px after 3 seconds)
- Resizable and draggable

### Dashboard (8 Pages)
- **Today** - Daily summary with stats cards, activity timeline, and project breakdown
- **Week** - 7-day trends with stacked bar charts, productivity line chart, and commit history
- **Git** - Per-project commit list with hash, branch, message, and diff stats
- **Budget** - Project time budgets with progress bars and inline editing
- **Settings** - Tracking control, idle threshold, app categories, autostart, OTA updates
- **Pomodoro** - 25/5 timer with circular progress, focus mode, session counter
- **Monthly** - GitHub-style heatmap calendar with productivity color coding
- **Export** - CSV/JSON data export and daily markdown reports

### Smart Features
- **Project Time Budgets** - Set daily limits per project, get Windows notifications at 80% and 100%
- **Pomodoro Timer** - Built-in 25min work / 5min break cycles with notifications
- **Streak Tracking** - Track consecutive productive days
- **Daily Goals** - Set targets for productive hours, commits, or productivity score
- **OTA Updates** - Auto-update via GitHub Releases (signed with Ed25519)

### Extensions
- **Chrome Extension** - Tracks active tab URL/domain, sends to DevPulse via localhost HTTP
- **VS Code Extension** - Tracks file, language, branch, debug state, terminal activity

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
├── src-tauri/src/           # Rust backend
│   ├── tracker/             # Window, idle, VS Code, git, Claude detection
│   ├── db/                  # SQLite schema + queries
│   ├── budget/              # Project time budget manager
│   ├── pomodoro/            # Pomodoro timer engine
│   ├── export/              # CSV/JSON export + daily reports
│   ├── charts/              # Heatmap, category breakdown queries
│   ├── goals/               # Streaks + daily goals
│   ├── commands.rs          # Tauri IPC commands
│   ├── models.rs            # Shared data structures
│   └── lib.rs               # App setup, plugins, background threads
├── src/                     # React frontend
│   ├── minibar/             # Always-on-top widget
│   ├── dashboard/           # Main dashboard with 8 pages
│   ├── hooks/               # useTrackerState, useInterval, usePomodoroState
│   └── types.ts             # TypeScript interfaces
├── extensions/
│   ├── chrome/              # Chrome tab tracker extension
│   └── vscode/              # VS Code activity tracker extension
└── .github/workflows/       # CI/CD for auto-releases
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

## Privacy

- All data stays on your machine - no cloud, no telemetry
- SQLite database in `%APPDATA%`
- Extensions communicate only via `localhost:19876`
- No keylogging - only window titles and process names
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

**YGT Labs AI** - Built by [Ercan Yigit](https://github.com/IamYGT) with Claude Code
