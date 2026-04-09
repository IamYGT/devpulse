pub fn validate_date(date: &str) -> Result<(), String> {
    // Must match YYYY-MM-DD format
    if date.len() != 10 {
        return Err("Gecersiz tarih formati".to_string());
    }
    chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map_err(|_| "Gecersiz tarih".to_string())?;
    Ok(())
}

pub fn validate_time(time: &str) -> Result<(), String> {
    // Must match HH:MM format
    if time.len() != 5 {
        return Err("Gecersiz saat formati".to_string());
    }
    let parts: Vec<&str> = time.split(':').collect();
    if parts.len() != 2 {
        return Err("Gecersiz saat formati".to_string());
    }
    let h: u32 = parts[0].parse().map_err(|_| "Gecersiz saat".to_string())?;
    let m: u32 = parts[1].parse().map_err(|_| "Gecersiz dakika".to_string())?;
    if h > 23 || m > 59 {
        return Err("Saat 00:00-23:59 araliginda olmali".to_string());
    }
    Ok(())
}

pub fn validate_project_id(id: i64) -> Result<(), String> {
    if id <= 0 {
        return Err("Gecersiz proje ID".to_string());
    }
    Ok(())
}

pub fn validate_budget_minutes(minutes: i64) -> Result<(), String> {
    if minutes < 0 || minutes > 1440 {
        return Err("Butce 0-1440 dakika araliginda olmali".to_string());
    }
    Ok(())
}

pub fn validate_string_length(s: &str, max: usize, field_name: &str) -> Result<(), String> {
    if s.len() > max {
        return Err(format!(
            "{} en fazla {} karakter olabilir",
            field_name, max
        ));
    }
    Ok(())
}

pub fn validate_priority(priority: &str) -> Result<(), String> {
    match priority {
        "P0" | "P1" | "P2" => Ok(()),
        _ => Err("Oncelik P0, P1 veya P2 olmali".to_string()),
    }
}
