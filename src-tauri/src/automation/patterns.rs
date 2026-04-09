use rusqlite::params;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct WorkPattern {
    pub pattern_type: String,
    pub description: String,
    pub confidence: f64,
    pub data: serde_json::Value,
}

pub fn detect_patterns(db_path: &str) -> Vec<WorkPattern> {
    let mut patterns = Vec::new();
    let conn = match rusqlite::Connection::open(db_path) {
        Ok(c) => c,
        Err(_) => return patterns,
    };

    // Pattern 1: Most productive hours
    // Query activity_logs grouped by hour, find peak productive hours
    if let Some(pattern) = detect_productive_hours(&conn) {
        patterns.push(pattern);
    }

    // Pattern 2: Distracting app triggers
    // Find what apps user switches to after productive work (fatigue indicator)
    if let Some(pattern) = detect_distraction_triggers(&conn) {
        patterns.push(pattern);
    }

    // Pattern 3: Context switching frequency
    // Count window switches per hour, find high-switching periods
    if let Some(pattern) = detect_context_switching(&conn) {
        patterns.push(pattern);
    }

    // Pattern 4: Weekly rhythm
    // Which days of week are most productive?
    if let Some(pattern) = detect_weekly_rhythm(&conn) {
        patterns.push(pattern);
    }

    // Pattern 5: Session length sweet spot
    // What's the optimal continuous work duration before productivity drops?
    if let Some(pattern) = detect_session_sweet_spot(&conn) {
        patterns.push(pattern);
    }

    patterns
}

/// Pattern 1: Find peak productive hours over the last 30 days
fn detect_productive_hours(conn: &rusqlite::Connection) -> Option<WorkPattern> {
    let mut stmt = conn
        .prepare(
            "SELECT CAST(substr(timestamp, 12, 2) AS INTEGER) as hour,
                    SUM(CASE WHEN category = 'productive' THEN duration_seconds ELSE 0 END) as prod_secs,
                    SUM(duration_seconds) as total_secs
             FROM activity_logs
             WHERE timestamp >= date('now', '-30 days')
               AND is_idle = 0
             GROUP BY hour
             HAVING total_secs > 0
             ORDER BY hour",
        )
        .ok()?;

    let rows: Vec<(i32, i64, i64)> = stmt
        .query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .ok()?
        .filter_map(|r| r.ok())
        .collect();

    if rows.is_empty() {
        return None;
    }

    // Find the peak productive hour
    let mut best_hour = 0;
    let mut best_prod = 0i64;
    let mut hour_data = serde_json::Map::new();

    for (hour, prod_secs, total_secs) in &rows {
        let ratio = if *total_secs > 0 {
            (*prod_secs as f64) / (*total_secs as f64) * 100.0
        } else {
            0.0
        };
        hour_data.insert(
            format!("{:02}:00", hour),
            serde_json::json!({
                "productive_minutes": prod_secs / 60,
                "total_minutes": total_secs / 60,
                "productivity_pct": (ratio * 10.0).round() / 10.0
            }),
        );
        if *prod_secs > best_prod {
            best_prod = *prod_secs;
            best_hour = *hour;
        }
    }

    // Find worst hour too
    let mut worst_hour = 0;
    let mut worst_ratio = 100.0f64;
    for (hour, prod_secs, total_secs) in &rows {
        if *total_secs > 300 {
            // at least 5 min data
            let ratio = (*prod_secs as f64) / (*total_secs as f64) * 100.0;
            if ratio < worst_ratio {
                worst_ratio = ratio;
                worst_hour = *hour;
            }
        }
    }

    let confidence = if rows.len() >= 8 { 0.85 } else { 0.55 };

    Some(WorkPattern {
        pattern_type: "productive_hours".to_string(),
        description: format!(
            "En verimli saatin {:02}:00 civari. {:02}:00 civarinda verimlilik dusuyor.",
            best_hour, worst_hour
        ),
        confidence,
        data: serde_json::json!({
            "best_hour": best_hour,
            "worst_hour": worst_hour,
            "hourly_breakdown": hour_data
        }),
    })
}

/// Pattern 2: Detect distraction triggers - apps users switch to after productive work
fn detect_distraction_triggers(conn: &rusqlite::Connection) -> Option<WorkPattern> {
    // Find distracting apps that appear right after productive sessions
    let mut stmt = conn
        .prepare(
            "WITH ordered_logs AS (
                SELECT
                    process_name,
                    category,
                    duration_seconds,
                    LAG(category) OVER (ORDER BY timestamp) as prev_category,
                    LAG(process_name) OVER (ORDER BY timestamp) as prev_process
                FROM activity_logs
                WHERE timestamp >= date('now', '-14 days')
                  AND is_idle = 0
                  AND process_name IS NOT NULL
            )
            SELECT process_name,
                   COUNT(*) as switch_count,
                   SUM(duration_seconds) / 60 as total_minutes
            FROM ordered_logs
            WHERE category = 'distracting'
              AND prev_category = 'productive'
            GROUP BY process_name
            ORDER BY switch_count DESC
            LIMIT 5",
        )
        .ok()?;

    let rows: Vec<(String, i64, i64)> = stmt
        .query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .ok()?
        .filter_map(|r| r.ok())
        .collect();

    if rows.is_empty() {
        return None;
    }

    let top_distractors: Vec<serde_json::Value> = rows
        .iter()
        .map(|(name, count, mins)| {
            serde_json::json!({
                "app": name,
                "times_triggered": count,
                "total_minutes_lost": mins
            })
        })
        .collect();

    let total_triggers: i64 = rows.iter().map(|(_, c, _)| c).sum();
    let top_app = &rows[0].0;

    let confidence = if total_triggers > 20 {
        0.80
    } else if total_triggers > 5 {
        0.60
    } else {
        0.40
    };

    Some(WorkPattern {
        pattern_type: "distraction_triggers".to_string(),
        description: format!(
            "Verimli calismadan sonra en cok {} uygulamasina geciyorsun ({} kez). Bu yorgunluk gostergesi olabilir.",
            top_app, rows[0].1
        ),
        confidence,
        data: serde_json::json!({
            "top_distractors": top_distractors,
            "total_switches": total_triggers
        }),
    })
}

/// Pattern 3: Context switching frequency per hour
fn detect_context_switching(conn: &rusqlite::Connection) -> Option<WorkPattern> {
    let mut stmt = conn
        .prepare(
            "SELECT CAST(substr(timestamp, 12, 2) AS INTEGER) as hour,
                    COUNT(DISTINCT process_name) as unique_apps,
                    COUNT(*) as total_entries
             FROM activity_logs
             WHERE timestamp >= date('now', '-14 days')
               AND is_idle = 0
               AND process_name IS NOT NULL
             GROUP BY substr(timestamp, 1, 10), hour
             HAVING total_entries > 3",
        )
        .ok()?;

    let rows: Vec<(i32, i64, i64)> = stmt
        .query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .ok()?
        .filter_map(|r| r.ok())
        .collect();

    if rows.is_empty() {
        return None;
    }

    // Group by hour and average the switching
    let mut hour_switches: std::collections::HashMap<i32, Vec<i64>> = std::collections::HashMap::new();
    for (hour, unique_apps, _) in &rows {
        hour_switches.entry(*hour).or_default().push(*unique_apps);
    }

    let mut hour_averages: Vec<(i32, f64)> = hour_switches
        .iter()
        .map(|(hour, vals)| {
            let avg = vals.iter().sum::<i64>() as f64 / vals.len() as f64;
            (*hour, avg)
        })
        .collect();
    hour_averages.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let high_switch_hour = hour_averages.first().map(|(h, _)| *h).unwrap_or(14);
    let low_switch_hour = hour_averages.last().map(|(h, _)| *h).unwrap_or(10);
    let avg_overall: f64 = hour_averages.iter().map(|(_, v)| v).sum::<f64>()
        / hour_averages.len().max(1) as f64;

    let confidence = if hour_averages.len() >= 6 {
        0.75
    } else {
        0.45
    };

    Some(WorkPattern {
        pattern_type: "context_switching".to_string(),
        description: format!(
            "Saatte ortalama {:.1} uygulama degisimi yapiyorsun. {:02}:00'da en cok, {:02}:00'da en az gecis var.",
            avg_overall, high_switch_hour, low_switch_hour
        ),
        confidence,
        data: serde_json::json!({
            "avg_switches_per_hour": (avg_overall * 10.0).round() / 10.0,
            "highest_switching_hour": high_switch_hour,
            "lowest_switching_hour": low_switch_hour,
            "hourly_averages": hour_averages.iter()
                .map(|(h, v)| serde_json::json!({"hour": h, "avg_switches": (v * 10.0).round() / 10.0}))
                .collect::<Vec<_>>()
        }),
    })
}

/// Pattern 4: Weekly rhythm - which days are most productive
fn detect_weekly_rhythm(conn: &rusqlite::Connection) -> Option<WorkPattern> {
    let mut stmt = conn
        .prepare(
            "SELECT CAST(strftime('%w', substr(timestamp, 1, 10)) AS INTEGER) as dow,
                    SUM(CASE WHEN category = 'productive' THEN duration_seconds ELSE 0 END) / 60 as prod_min,
                    SUM(duration_seconds) / 60 as total_min,
                    COUNT(DISTINCT substr(timestamp, 1, 10)) as day_count
             FROM activity_logs
             WHERE timestamp >= date('now', '-30 days')
               AND is_idle = 0
             GROUP BY dow
             ORDER BY dow",
        )
        .ok()?;

    let rows: Vec<(i32, i64, i64, i64)> = stmt
        .query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .ok()?
        .filter_map(|r| r.ok())
        .collect();

    if rows.is_empty() {
        return None;
    }

    let day_names = ["Pazar", "Pazartesi", "Sali", "Carsamba", "Persembe", "Cuma", "Cumartesi"];

    let mut best_day = 0usize;
    let mut best_avg = 0.0f64;
    let mut worst_day = 0usize;
    let mut worst_avg = f64::MAX;

    let mut day_data = Vec::new();

    for (dow, prod_min, total_min, day_count) in &rows {
        let idx = *dow as usize;
        let avg_prod = if *day_count > 0 {
            *prod_min as f64 / *day_count as f64
        } else {
            0.0
        };
        let avg_total = if *day_count > 0 {
            *total_min as f64 / *day_count as f64
        } else {
            0.0
        };
        let pct = if avg_total > 0.0 {
            avg_prod / avg_total * 100.0
        } else {
            0.0
        };

        if avg_prod > best_avg {
            best_avg = avg_prod;
            best_day = idx;
        }
        if avg_prod < worst_avg && *day_count > 0 {
            worst_avg = avg_prod;
            worst_day = idx;
        }

        day_data.push(serde_json::json!({
            "day": day_names.get(idx).unwrap_or(&"?"),
            "avg_productive_min": (avg_prod * 10.0).round() / 10.0,
            "avg_total_min": (avg_total * 10.0).round() / 10.0,
            "productivity_pct": (pct * 10.0).round() / 10.0,
            "sample_days": day_count
        }));
    }

    let confidence = if rows.len() >= 5 { 0.80 } else { 0.50 };

    Some(WorkPattern {
        pattern_type: "weekly_rhythm".to_string(),
        description: format!(
            "En verimli gunun {}. {} gunleri verimlilik dusuyor.",
            day_names.get(best_day).unwrap_or(&"?"),
            day_names.get(worst_day).unwrap_or(&"?")
        ),
        confidence,
        data: serde_json::json!({
            "best_day": day_names.get(best_day).unwrap_or(&"?"),
            "worst_day": day_names.get(worst_day).unwrap_or(&"?"),
            "daily_breakdown": day_data
        }),
    })
}

/// Pattern 5: Session length sweet spot - optimal work duration before productivity drops
fn detect_session_sweet_spot(conn: &rusqlite::Connection) -> Option<WorkPattern> {
    // Look at continuous productive sessions and their durations
    // Group into buckets: <30min, 30-60min, 60-90min, 90-120min, 120+min
    // See which bucket has the highest productivity ratio afterward

    let mut stmt = conn
        .prepare(
            "WITH sessions AS (
                SELECT
                    duration_seconds,
                    category,
                    CASE
                        WHEN duration_seconds < 1800 THEN '0-30dk'
                        WHEN duration_seconds < 3600 THEN '30-60dk'
                        WHEN duration_seconds < 5400 THEN '60-90dk'
                        WHEN duration_seconds < 7200 THEN '90-120dk'
                        ELSE '120+dk'
                    END as bucket,
                    LEAD(category) OVER (ORDER BY timestamp) as next_category
                FROM activity_logs
                WHERE timestamp >= date('now', '-30 days')
                  AND is_idle = 0
                  AND category = 'productive'
                  AND duration_seconds > 60
            )
            SELECT bucket,
                   COUNT(*) as session_count,
                   AVG(duration_seconds) / 60 as avg_duration_min,
                   SUM(CASE WHEN next_category = 'productive' THEN 1 ELSE 0 END) as continued_count,
                   SUM(CASE WHEN next_category = 'distracting' THEN 1 ELSE 0 END) as distracted_count
            FROM sessions
            GROUP BY bucket
            ORDER BY bucket",
        )
        .ok()?;

    let rows: Vec<(String, i64, f64, i64, i64)> = stmt
        .query_map([], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
            ))
        })
        .ok()?
        .filter_map(|r| r.ok())
        .collect();

    if rows.is_empty() {
        return None;
    }

    // Find the bucket where users most often continue being productive (highest continuation rate)
    let mut best_bucket = String::new();
    let mut best_continuation = 0.0f64;
    let mut bucket_data = Vec::new();

    for (bucket, count, avg_dur, continued, distracted) in &rows {
        let continuation_rate = if *count > 0 {
            *continued as f64 / *count as f64 * 100.0
        } else {
            0.0
        };
        let distraction_rate = if *count > 0 {
            *distracted as f64 / *count as f64 * 100.0
        } else {
            0.0
        };

        if continuation_rate > best_continuation && *count >= 3 {
            best_continuation = continuation_rate;
            best_bucket = bucket.clone();
        }

        bucket_data.push(serde_json::json!({
            "range": bucket,
            "session_count": count,
            "avg_duration_min": (avg_dur * 10.0).round() / 10.0,
            "continuation_rate": (continuation_rate * 10.0).round() / 10.0,
            "distraction_rate": (distraction_rate * 10.0).round() / 10.0
        }));
    }

    if best_bucket.is_empty() {
        best_bucket = "30-60dk".to_string();
    }

    let total_sessions: i64 = rows.iter().map(|(_, c, _, _, _)| c).sum();
    let confidence = if total_sessions > 50 {
        0.82
    } else if total_sessions > 15 {
        0.60
    } else {
        0.35
    };

    Some(WorkPattern {
        pattern_type: "session_sweet_spot".to_string(),
        description: format!(
            "Optimal calisma suresi {} arasi. Bu sureden sonra odaklanma %{:.0} oraninda devam ediyor.",
            best_bucket, best_continuation
        ),
        confidence,
        data: serde_json::json!({
            "optimal_range": best_bucket,
            "continuation_rate": (best_continuation * 10.0).round() / 10.0,
            "bucket_breakdown": bucket_data,
            "total_sessions_analyzed": total_sessions
        }),
    })
}
