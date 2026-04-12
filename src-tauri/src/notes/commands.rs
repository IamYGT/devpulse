use rusqlite::params;
use serde::{Deserialize, Serialize};

// ── Structs ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: i64,
    pub title: String,
    pub content: String,
    pub note_type: String,
    pub language: Option<String>,
    pub project_id: Option<i64>,
    pub color: Option<String>,
    pub is_pinned: bool,
    pub is_archived: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: i64,
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Todo {
    pub id: i64,
    pub note_id: Option<i64>,
    pub text: String,
    pub is_done: bool,
    pub priority: i32,
    pub due_date: Option<String>,
    pub project_id: Option<i64>,
    pub sort_order: i32,
    pub created_at: String,
    pub completed_at: Option<String>,
}

// ── Table Setup ──────────────────────────────────────────────────────────────

fn ensure_tables(conn: &rusqlite::Connection) {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            note_type TEXT NOT NULL DEFAULT 'scratch',
            language TEXT,
            project_id INTEGER,
            color TEXT,
            is_pinned INTEGER DEFAULT 0,
            is_archived INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now','localtime')),
            updated_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            color TEXT
        );

        CREATE TABLE IF NOT EXISTS note_tags (
            note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
            tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
            PRIMARY KEY (note_id, tag_id)
        );

        CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            note_id INTEGER,
            text TEXT NOT NULL,
            is_done INTEGER DEFAULT 0,
            priority INTEGER DEFAULT 3,
            due_date TEXT,
            project_id INTEGER,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now','localtime')),
            completed_at TEXT
        );",
    )
    .ok();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn get_note_by_id(conn: &rusqlite::Connection, id: i64) -> Option<Note> {
    conn.query_row(
        "SELECT id, title, content, note_type, language, project_id, color, is_pinned, is_archived, created_at, updated_at FROM notes WHERE id = ?1",
        params![id],
        |row| {
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                note_type: row.get(3)?,
                language: row.get(4)?,
                project_id: row.get(5)?,
                color: row.get(6)?,
                is_pinned: row.get::<_, i32>(7)? != 0,
                is_archived: row.get::<_, i32>(8)? != 0,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        },
    )
    .ok()
}

fn get_todo_by_id(conn: &rusqlite::Connection, id: i64) -> Option<Todo> {
    conn.query_row(
        "SELECT id, note_id, text, is_done, priority, due_date, project_id, sort_order, created_at, completed_at FROM todos WHERE id = ?1",
        params![id],
        |row| {
            Ok(Todo {
                id: row.get(0)?,
                note_id: row.get(1)?,
                text: row.get(2)?,
                is_done: row.get::<_, i32>(3)? != 0,
                priority: row.get(4)?,
                due_date: row.get(5)?,
                project_id: row.get(6)?,
                sort_order: row.get(7)?,
                created_at: row.get(8)?,
                completed_at: row.get(9)?,
            })
        },
    )
    .ok()
}

fn row_to_note(row: &rusqlite::Row) -> rusqlite::Result<Note> {
    Ok(Note {
        id: row.get(0)?,
        title: row.get(1)?,
        content: row.get(2)?,
        note_type: row.get(3)?,
        language: row.get(4)?,
        project_id: row.get(5)?,
        color: row.get(6)?,
        is_pinned: row.get::<_, i32>(7)? != 0,
        is_archived: row.get::<_, i32>(8)? != 0,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

fn row_to_todo(row: &rusqlite::Row) -> rusqlite::Result<Todo> {
    Ok(Todo {
        id: row.get(0)?,
        note_id: row.get(1)?,
        text: row.get(2)?,
        is_done: row.get::<_, i32>(3)? != 0,
        priority: row.get(4)?,
        due_date: row.get(5)?,
        project_id: row.get(6)?,
        sort_order: row.get(7)?,
        created_at: row.get(8)?,
        completed_at: row.get(9)?,
    })
}

// ── Note Commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn create_note(
    state: tauri::State<'_, crate::commands::AppState>,
    title: String,
    content: String,
    note_type: String,
    language: Option<String>,
    project_id: Option<i64>,
    color: Option<String>,
) -> Option<Note> {
    let conn = rusqlite::Connection::open(&state.db_path).ok()?;
    ensure_tables(&conn);
    conn.execute(
        "INSERT INTO notes (title, content, note_type, language, project_id, color) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![title, content, note_type, language, project_id, color],
    )
    .ok()?;
    let id = conn.last_insert_rowid();
    get_note_by_id(&conn, id)
}

#[tauri::command]
pub fn update_note(
    state: tauri::State<'_, crate::commands::AppState>,
    id: i64,
    title: Option<String>,
    content: Option<String>,
    color: Option<String>,
    is_pinned: Option<bool>,
) -> bool {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return false,
    };
    ensure_tables(&conn);

    let mut sets: Vec<String> = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref t) = title {
        sets.push("title = ?".to_string());
        values.push(Box::new(t.clone()));
    }
    if let Some(ref c) = content {
        sets.push("content = ?".to_string());
        values.push(Box::new(c.clone()));
    }
    if let Some(ref col) = color {
        sets.push("color = ?".to_string());
        values.push(Box::new(col.clone()));
    }
    if let Some(p) = is_pinned {
        sets.push("is_pinned = ?".to_string());
        values.push(Box::new(p as i32));
    }

    if sets.is_empty() {
        return false;
    }

    sets.push("updated_at = datetime('now','localtime')".to_string());
    values.push(Box::new(id));

    let sql = format!(
        "UPDATE notes SET {} WHERE id = ?",
        sets.join(", ")
    );

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice()).is_ok()
}

#[tauri::command]
pub fn delete_note(
    state: tauri::State<'_, crate::commands::AppState>,
    id: i64,
) -> bool {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return false,
    };
    ensure_tables(&conn);
    conn.execute("DELETE FROM notes WHERE id = ?1", params![id]).is_ok()
}

#[tauri::command]
pub fn get_notes(
    state: tauri::State<'_, crate::commands::AppState>,
    note_type: Option<String>,
    project_id: Option<i64>,
    search_query: Option<String>,
    tag_id: Option<i64>,
) -> Vec<Note> {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    ensure_tables(&conn);

    let mut conditions: Vec<String> = vec!["n.is_archived = 0".to_string()];
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut use_join = false;

    if let Some(ref nt) = note_type {
        conditions.push("n.note_type = ?".to_string());
        values.push(Box::new(nt.clone()));
    }
    if let Some(pid) = project_id {
        conditions.push("n.project_id = ?".to_string());
        values.push(Box::new(pid));
    }
    if let Some(ref q) = search_query {
        let like = format!("%{}%", q);
        conditions.push("(n.title LIKE ? OR n.content LIKE ?)".to_string());
        values.push(Box::new(like.clone()));
        values.push(Box::new(like));
    }
    if let Some(tid) = tag_id {
        use_join = true;
        conditions.push("nt.tag_id = ?".to_string());
        values.push(Box::new(tid));
    }

    let join_clause = if use_join {
        "JOIN note_tags nt ON nt.note_id = n.id"
    } else {
        ""
    };

    let sql = format!(
        "SELECT n.id, n.title, n.content, n.note_type, n.language, n.project_id, n.color, n.is_pinned, n.is_archived, n.created_at, n.updated_at FROM notes n {} WHERE {} ORDER BY n.is_pinned DESC, n.updated_at DESC",
        join_clause,
        conditions.join(" AND ")
    );

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    stmt.query_map(param_refs.as_slice(), row_to_note)
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
}

#[tauri::command]
pub fn get_note(
    state: tauri::State<'_, crate::commands::AppState>,
    id: i64,
) -> Option<Note> {
    let conn = rusqlite::Connection::open(&state.db_path).ok()?;
    ensure_tables(&conn);
    get_note_by_id(&conn, id)
}

#[tauri::command]
pub fn archive_note(
    state: tauri::State<'_, crate::commands::AppState>,
    id: i64,
) -> bool {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return false,
    };
    ensure_tables(&conn);
    conn.execute(
        "UPDATE notes SET is_archived = 1, updated_at = datetime('now','localtime') WHERE id = ?1",
        params![id],
    )
    .is_ok()
}

#[tauri::command]
pub fn pin_note(
    state: tauri::State<'_, crate::commands::AppState>,
    id: i64,
    is_pinned: bool,
) -> bool {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return false,
    };
    ensure_tables(&conn);
    conn.execute(
        "UPDATE notes SET is_pinned = ?1, updated_at = datetime('now','localtime') WHERE id = ?2",
        params![is_pinned as i32, id],
    )
    .is_ok()
}

#[tauri::command]
pub fn search_notes(
    state: tauri::State<'_, crate::commands::AppState>,
    query: String,
) -> Vec<Note> {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    ensure_tables(&conn);

    let like = format!("%{}%", query);
    let mut stmt = match conn.prepare(
        "SELECT id, title, content, note_type, language, project_id, color, is_pinned, is_archived, created_at, updated_at FROM notes WHERE is_archived = 0 AND (title LIKE ?1 OR content LIKE ?2) ORDER BY is_pinned DESC, updated_at DESC",
    ) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    stmt.query_map(params![like, like], row_to_note)
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
}

// ── Tag Commands ─────────────────────────────────────────────────────────────

#[tauri::command]
pub fn create_tag(
    state: tauri::State<'_, crate::commands::AppState>,
    name: String,
    color: Option<String>,
) -> Option<Tag> {
    let conn = rusqlite::Connection::open(&state.db_path).ok()?;
    ensure_tables(&conn);
    conn.execute(
        "INSERT INTO tags (name, color) VALUES (?1, ?2)",
        params![name, color],
    )
    .ok()?;
    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, name, color FROM tags WHERE id = ?1",
        params![id],
        |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
            })
        },
    )
    .ok()
}

#[tauri::command]
pub fn get_tags(
    state: tauri::State<'_, crate::commands::AppState>,
) -> Vec<Tag> {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    ensure_tables(&conn);

    let mut stmt = match conn.prepare("SELECT id, name, color FROM tags ORDER BY name") {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    stmt.query_map([], |row| {
        Ok(Tag {
            id: row.get(0)?,
            name: row.get(1)?,
            color: row.get(2)?,
        })
    })
    .map(|rows| rows.filter_map(|r| r.ok()).collect())
    .unwrap_or_default()
}

#[tauri::command]
pub fn tag_note(
    state: tauri::State<'_, crate::commands::AppState>,
    note_id: i64,
    tag_id: i64,
) -> bool {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return false,
    };
    ensure_tables(&conn);
    conn.execute(
        "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?1, ?2)",
        params![note_id, tag_id],
    )
    .is_ok()
}

#[tauri::command]
pub fn untag_note(
    state: tauri::State<'_, crate::commands::AppState>,
    note_id: i64,
    tag_id: i64,
) -> bool {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return false,
    };
    ensure_tables(&conn);
    conn.execute(
        "DELETE FROM note_tags WHERE note_id = ?1 AND tag_id = ?2",
        params![note_id, tag_id],
    )
    .is_ok()
}

// ── Todo Commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn create_todo(
    state: tauri::State<'_, crate::commands::AppState>,
    text: String,
    priority: Option<i32>,
    due_date: Option<String>,
    project_id: Option<i64>,
    note_id: Option<i64>,
) -> Option<Todo> {
    let conn = rusqlite::Connection::open(&state.db_path).ok()?;
    ensure_tables(&conn);

    let prio = priority.unwrap_or(3);
    conn.execute(
        "INSERT INTO todos (text, priority, due_date, project_id, note_id) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![text, prio, due_date, project_id, note_id],
    )
    .ok()?;
    let id = conn.last_insert_rowid();
    get_todo_by_id(&conn, id)
}

#[tauri::command]
pub fn update_todo(
    state: tauri::State<'_, crate::commands::AppState>,
    id: i64,
    text: Option<String>,
    is_done: Option<bool>,
    priority: Option<i32>,
    due_date: Option<String>,
) -> bool {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return false,
    };
    ensure_tables(&conn);

    let mut sets: Vec<String> = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref t) = text {
        sets.push("text = ?".to_string());
        values.push(Box::new(t.clone()));
    }
    if let Some(done) = is_done {
        sets.push("is_done = ?".to_string());
        values.push(Box::new(done as i32));
        if done {
            sets.push("completed_at = datetime('now','localtime')".to_string());
        } else {
            sets.push("completed_at = NULL".to_string());
        }
    }
    if let Some(p) = priority {
        sets.push("priority = ?".to_string());
        values.push(Box::new(p));
    }
    if let Some(ref d) = due_date {
        sets.push("due_date = ?".to_string());
        values.push(Box::new(d.clone()));
    }

    if sets.is_empty() {
        return false;
    }

    values.push(Box::new(id));
    let sql = format!("UPDATE todos SET {} WHERE id = ?", sets.join(", "));
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice()).is_ok()
}

#[tauri::command]
pub fn delete_todo(
    state: tauri::State<'_, crate::commands::AppState>,
    id: i64,
) -> bool {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return false,
    };
    ensure_tables(&conn);
    conn.execute("DELETE FROM todos WHERE id = ?1", params![id]).is_ok()
}

#[tauri::command]
pub fn get_todos(
    state: tauri::State<'_, crate::commands::AppState>,
    project_id: Option<i64>,
    is_done: Option<bool>,
) -> Vec<Todo> {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    ensure_tables(&conn);

    let mut conditions: Vec<String> = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(pid) = project_id {
        conditions.push("project_id = ?".to_string());
        values.push(Box::new(pid));
    }
    if let Some(done) = is_done {
        conditions.push("is_done = ?".to_string());
        values.push(Box::new(done as i32));
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let sql = format!(
        "SELECT id, note_id, text, is_done, priority, due_date, project_id, sort_order, created_at, completed_at FROM todos {} ORDER BY sort_order ASC, priority ASC, created_at ASC",
        where_clause
    );

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    stmt.query_map(param_refs.as_slice(), row_to_todo)
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
}

#[tauri::command]
pub fn reorder_todos(
    state: tauri::State<'_, crate::commands::AppState>,
    ids: Vec<i64>,
) -> bool {
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(_) => return false,
    };
    ensure_tables(&conn);

    let tx = match conn.unchecked_transaction() {
        Ok(t) => t,
        Err(_) => return false,
    };

    for (i, id) in ids.iter().enumerate() {
        if tx
            .execute(
                "UPDATE todos SET sort_order = ?1 WHERE id = ?2",
                params![i as i32, id],
            )
            .is_err()
        {
            return false;
        }
    }

    tx.commit().is_ok()
}

// ── Journal Command ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_today_journal(
    state: tauri::State<'_, crate::commands::AppState>,
    date: String,
) -> Option<Note> {
    let conn = rusqlite::Connection::open(&state.db_path).ok()?;
    ensure_tables(&conn);

    // Check if a journal note exists for this date
    let existing: Option<Note> = conn
        .query_row(
            "SELECT id, title, content, note_type, language, project_id, color, is_pinned, is_archived, created_at, updated_at FROM notes WHERE note_type = 'journal' AND date(created_at) = ?1 LIMIT 1",
            params![date],
            row_to_note,
        )
        .ok();

    if let Some(note) = existing {
        return Some(note);
    }

    // Generate daily summary content from activity data
    let total_time: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(duration), 0) FROM activity_periods WHERE date(start_time) = ?1",
            params![date],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let hours = (total_time / 3600.0) as i32;
    let minutes = ((total_time % 3600.0) / 60.0) as i32;

    let todo_done: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM todos WHERE date(completed_at) = ?1",
            params![date],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let content = format!(
        "# Daily Journal - {}\n\n## Summary\n- Active time: {}h {}m\n- Todos completed: {}\n\n## Notes\n\n",
        date, hours, minutes, todo_done
    );

    let title = format!("Journal - {}", date);
    conn.execute(
        "INSERT INTO notes (title, content, note_type) VALUES (?1, ?2, 'journal')",
        params![title, content],
    )
    .ok()?;
    let id = conn.last_insert_rowid();
    get_note_by_id(&conn, id)
}
