use std::collections::HashMap;
use chrono::Local;
use git2::{Repository, Sort};

use crate::db::queries;
use crate::models::GitEvent;

pub struct GitMonitor {
    /// Map from project path to the last known commit OID (hex string)
    last_known_commits: HashMap<String, String>,
    db_path: String,
}

impl GitMonitor {
    pub fn new(db_path: String) -> Self {
        Self {
            last_known_commits: HashMap::new(),
            db_path,
        }
    }

    /// Check all known project paths for new commits.
    pub fn check_projects(&mut self) {
        let conn = match rusqlite::Connection::open(&self.db_path) {
            Ok(c) => c,
            Err(_) => return,
        };

        let projects = match queries::get_all_projects(&conn) {
            Ok(p) => p,
            Err(_) => return,
        };

        for project in projects {
            let path = match &project.path {
                Some(p) => p.clone(),
                None => continue,
            };

            self.check_project_commits(&conn, &path, project.id);
        }
    }

    fn check_project_commits(&mut self, conn: &rusqlite::Connection, path: &str, project_id: i64) {
        let repo = match Repository::open(path) {
            Ok(r) => r,
            Err(_) => return,
        };

        // Get current branch
        let branch = repo.head()
            .ok()
            .and_then(|h| h.shorthand().map(|s| s.to_string()));

        // Get HEAD commit
        let head_oid = match repo.head().ok().and_then(|h| h.target()) {
            Some(oid) => oid,
            None => return,
        };

        let head_hex = head_oid.to_string();
        let last_known = self.last_known_commits.get(path).cloned();

        // If we haven't seen this project before, just record the HEAD
        if last_known.is_none() {
            self.last_known_commits.insert(path.to_string(), head_hex);
            return;
        }

        let last_hex = last_known.unwrap();
        if last_hex == head_hex {
            return; // No new commits
        }

        // Walk from HEAD back to last known commit
        let mut revwalk = match repo.revwalk() {
            Ok(rw) => rw,
            Err(_) => return,
        };

        revwalk.set_sorting(Sort::TIME).ok();
        if revwalk.push(head_oid).is_err() {
            return;
        }

        let last_oid = match git2::Oid::from_str(&last_hex) {
            Ok(oid) => oid,
            Err(_) => return,
        };

        let mut new_commits = Vec::new();

        for oid_result in revwalk {
            let oid = match oid_result {
                Ok(o) => o,
                Err(_) => break,
            };

            if oid == last_oid {
                break;
            }

            let commit = match repo.find_commit(oid) {
                Ok(c) => c,
                Err(_) => continue,
            };

            let message = commit.message().unwrap_or("").to_string();
            let (lines_added, lines_removed) = get_commit_diff_stats(&repo, &commit);

            new_commits.push(GitEvent {
                id: 0,
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                project_id: Some(project_id),
                commit_hash: Some(oid.to_string()),
                branch: branch.clone(),
                message: Some(message),
                lines_added,
                lines_removed,
            });

            // Only process last 50 commits max to avoid huge backlogs
            if new_commits.len() >= 50 {
                break;
            }
        }

        // Save new commits to DB
        for event in &new_commits {
            let _ = queries::insert_git_event(conn, event);
        }

        // Update last known
        self.last_known_commits.insert(path.to_string(), head_hex);
    }
}

fn get_commit_diff_stats(repo: &Repository, commit: &git2::Commit) -> (i64, i64) {
    let tree = match commit.tree() {
        Ok(t) => t,
        Err(_) => return (0, 0),
    };

    let parent_tree = commit.parent(0).ok().and_then(|p| p.tree().ok());

    let diff = match repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), None) {
        Ok(d) => d,
        Err(_) => return (0, 0),
    };

    let stats = match diff.stats() {
        Ok(s) => s,
        Err(_) => return (0, 0),
    };

    (stats.insertions() as i64, stats.deletions() as i64)
}

/// Get the current branch name for a given path.
pub fn get_current_branch(path: &str) -> Option<String> {
    Repository::open(path)
        .ok()?
        .head()
        .ok()?
        .shorthand()
        .map(|s| s.to_string())
}
