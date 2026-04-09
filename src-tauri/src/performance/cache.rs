use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

pub struct QueryCache {
    entries: Mutex<HashMap<String, CacheEntry>>,
    default_ttl: Duration,
}

struct CacheEntry {
    data: String, // JSON string
    created: Instant,
    ttl: Duration,
}

impl QueryCache {
    pub fn new(ttl_secs: u64) -> Self {
        Self {
            entries: Mutex::new(HashMap::new()),
            default_ttl: Duration::from_secs(ttl_secs),
        }
    }

    pub fn get(&self, key: &str) -> Option<String> {
        let entries = self.entries.lock().ok()?;
        let entry = entries.get(key)?;
        if entry.created.elapsed() < entry.ttl {
            Some(entry.data.clone())
        } else {
            None
        }
    }

    pub fn set(&self, key: &str, data: String) {
        if let Ok(mut entries) = self.entries.lock() {
            entries.insert(key.to_string(), CacheEntry {
                data,
                created: Instant::now(),
                ttl: self.default_ttl,
            });
        }
    }

    pub fn invalidate(&self, key: &str) {
        if let Ok(mut entries) = self.entries.lock() {
            entries.remove(key);
        }
    }

    pub fn clear(&self) {
        if let Ok(mut entries) = self.entries.lock() {
            entries.clear();
        }
    }

    /// Remove expired entries
    pub fn cleanup(&self) {
        if let Ok(mut entries) = self.entries.lock() {
            entries.retain(|_, v| v.created.elapsed() < v.ttl);
        }
    }
}
