/// Sanitize text input - remove control characters, trim
pub fn sanitize_text(input: &str) -> String {
    input
        .chars()
        .filter(|c| !c.is_control() || *c == '\n' || *c == '\r' || *c == '\t')
        .collect::<String>()
        .trim()
        .to_string()
}

/// Sanitize URL - basic validation
pub fn sanitize_url(url: &str) -> Option<String> {
    let trimmed = url.trim();
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        Some(trimmed.to_string())
    } else {
        None
    }
}

/// Sanitize process name
pub fn sanitize_process_name(name: &str) -> String {
    name.chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '-' || *c == '_' || *c == ' ')
        .collect::<String>()
        .trim()
        .to_string()
}

/// Truncate window title to reasonable length
pub fn truncate_title(title: &str, max_len: usize) -> String {
    if title.len() > max_len {
        format!("{}...", &title[..max_len.saturating_sub(3)])
    } else {
        title.to_string()
    }
}
