use std::sync::{Arc, Mutex};
use crate::models::TrackerState;
use crate::tracker::categorizer;

#[derive(serde::Deserialize, Debug)]
struct TabUpdatePayload {
    url: Option<String>,
    title: Option<String>,
    domain: Option<String>,
    #[serde(default)]
    #[allow(dead_code)]
    tab_count: i32,
    timestamp: Option<String>,
}

#[derive(serde::Deserialize, Debug)]
struct VscodeUpdatePayload {
    workspace: Option<String>,
    workspace_path: Option<String>,
    active_file: Option<String>,
    language: Option<String>,
    branch: Option<String>,
    #[serde(default)]
    dirty_files: i32,
    #[serde(default)]
    open_tabs: i32,
    #[serde(default)]
    is_debugging: bool,
    #[serde(default)]
    terminal_active: bool,
    timestamp: Option<String>,
}

pub struct HttpReceiver {
    state: Arc<Mutex<TrackerState>>,
    db_path: String,
}

impl HttpReceiver {
    pub fn new(state: Arc<Mutex<TrackerState>>, db_path: String) -> Self {
        Self { state, db_path }
    }

    /// Start the HTTP server on a background thread. Call this once.
    pub fn start(self) {
        std::thread::spawn(move || {
            let server = match tiny_http::Server::http("127.0.0.1:19876") {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("[DevPulse] Failed to start HTTP receiver: {:?}", e);
                    return;
                }
            };

            println!("[DevPulse] HTTP receiver listening on 127.0.0.1:19876");

            for mut request in server.incoming_requests() {
                let url = request.url().to_string();
                let method = request.method().to_string();

                // CORS headers for Chrome extension
                let cors_headers = vec![
                    tiny_http::Header::from_bytes("Access-Control-Allow-Origin", "*").unwrap(),
                    tiny_http::Header::from_bytes(
                        "Access-Control-Allow-Methods",
                        "POST, GET, OPTIONS",
                    )
                    .unwrap(),
                    tiny_http::Header::from_bytes("Access-Control-Allow-Headers", "Content-Type")
                        .unwrap(),
                ];

                // Handle OPTIONS preflight
                if method == "OPTIONS" {
                    let mut resp =
                        tiny_http::Response::from_string("").with_status_code(200);
                    for h in &cors_headers {
                        resp = resp.with_header(h.clone());
                    }
                    let _ = request.respond(resp);
                    continue;
                }

                match (method.as_str(), url.as_str()) {
                    ("POST", "/tab-update") => {
                        let mut body = String::new();
                        if std::io::Read::read_to_string(&mut request.as_reader(), &mut body).is_ok() {
                            self.handle_tab_update(&body);
                        }
                        let mut resp = tiny_http::Response::from_string("{\"ok\":true}")
                            .with_header(
                                tiny_http::Header::from_bytes(
                                    "Content-Type",
                                    "application/json",
                                )
                                .unwrap(),
                            );
                        for h in &cors_headers {
                            resp = resp.with_header(h.clone());
                        }
                        let _ = request.respond(resp);
                    }
                    ("POST", "/vscode-update") => {
                        let mut body = String::new();
                        if std::io::Read::read_to_string(&mut request.as_reader(), &mut body).is_ok() {
                            self.handle_vscode_update(&body);
                        }
                        let mut resp = tiny_http::Response::from_string("{\"ok\":true}")
                            .with_header(
                                tiny_http::Header::from_bytes(
                                    "Content-Type",
                                    "application/json",
                                )
                                .unwrap(),
                            );
                        for h in &cors_headers {
                            resp = resp.with_header(h.clone());
                        }
                        let _ = request.respond(resp);
                    }
                    ("GET", "/status") => {
                        let state = self.state.lock().unwrap();
                        let status = serde_json::json!({
                            "running": true,
                            "tracking": state.is_tracking,
                            "version": env!("CARGO_PKG_VERSION")
                        });
                        let mut resp =
                            tiny_http::Response::from_string(status.to_string()).with_header(
                                tiny_http::Header::from_bytes(
                                    "Content-Type",
                                    "application/json",
                                )
                                .unwrap(),
                            );
                        for h in &cors_headers {
                            resp = resp.with_header(h.clone());
                        }
                        let _ = request.respond(resp);
                    }
                    _ => {
                        let _ = request.respond(
                            tiny_http::Response::from_string("Not Found").with_status_code(404),
                        );
                    }
                }
            }
        });
    }

    fn handle_tab_update(&self, body: &str) {
        let payload: TabUpdatePayload = match serde_json::from_str(body) {
            Ok(p) => p,
            Err(e) => {
                eprintln!("[DevPulse] Failed to parse tab-update payload: {:?}", e);
                return;
            }
        };

        let timestamp = payload
            .timestamp
            .unwrap_or_else(|| chrono::Local::now().to_rfc3339());
        let url = payload.url.unwrap_or_default();
        let title = payload.title.unwrap_or_default();
        let domain = payload.domain.unwrap_or_default();

        // Determine category using the categorizer with a temporary connection
        let category = match rusqlite::Connection::open(&self.db_path) {
            Ok(conn) => {
                // Use domain/title to categorize like a browser window
                let fake_title = if title.is_empty() {
                    format!("{} - {}", domain, url)
                } else {
                    title.clone()
                };
                categorizer::categorize_process(&conn, "chrome.exe", &fake_title)
            }
            Err(_) => "neutral".to_string(),
        };

        // Update TrackerState
        if let Ok(mut state) = self.state.lock() {
            state.current_url = if url.is_empty() {
                None
            } else {
                Some(url.clone())
            };
            state.current_domain = if domain.is_empty() {
                None
            } else {
                Some(domain.clone())
            };
        }

        // Insert into browser_tabs table
        match rusqlite::Connection::open(&self.db_path) {
            Ok(conn) => {
                if let Err(e) = conn.execute(
                    "INSERT INTO browser_tabs (timestamp, url, domain, title, duration_seconds, category) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    rusqlite::params![
                        timestamp,
                        url,
                        domain,
                        title,
                        0,
                        category,
                    ],
                ) {
                    eprintln!("[DevPulse] Failed to insert browser tab: {:?}", e);
                }
            }
            Err(e) => {
                eprintln!("[DevPulse] Failed to open DB for tab insert: {:?}", e);
            }
        }
    }

    fn handle_vscode_update(&self, body: &str) {
        let payload: VscodeUpdatePayload = match serde_json::from_str(body) {
            Ok(p) => p,
            Err(e) => {
                eprintln!("[DevPulse] Failed to parse vscode-update payload: {:?}", e);
                return;
            }
        };

        let timestamp = payload
            .timestamp
            .unwrap_or_else(|| chrono::Local::now().to_rfc3339());

        // Update TrackerState
        if let Ok(mut state) = self.state.lock() {
            state.current_language = payload.language.clone();
            state.vscode_open_tabs = payload.open_tabs;
            state.vscode_dirty_files = payload.dirty_files;
            state.vscode_is_debugging = payload.is_debugging;
            state.vscode_terminal_active = payload.terminal_active;

            if let Some(ref file) = payload.active_file {
                state.current_file = Some(file.clone());
            }
            if let Some(ref branch) = payload.branch {
                state.current_branch = Some(branch.clone());
            }
        }

        // Insert into vscode_events table
        match rusqlite::Connection::open(&self.db_path) {
            Ok(conn) => {
                if let Err(e) = conn.execute(
                    "INSERT INTO vscode_events (timestamp, workspace, workspace_path, active_file, language, branch, dirty_files, open_tabs, is_debugging, terminal_active, duration_seconds) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                    rusqlite::params![
                        timestamp,
                        payload.workspace.unwrap_or_default(),
                        payload.workspace_path.unwrap_or_default(),
                        payload.active_file.unwrap_or_default(),
                        payload.language.unwrap_or_default(),
                        payload.branch.unwrap_or_default(),
                        payload.dirty_files,
                        payload.open_tabs,
                        payload.is_debugging as i32,
                        payload.terminal_active as i32,
                        0,
                    ],
                ) {
                    eprintln!("[DevPulse] Failed to insert vscode event: {:?}", e);
                }
            }
            Err(e) => {
                eprintln!("[DevPulse] Failed to open DB for vscode insert: {:?}", e);
            }
        }
    }
}
