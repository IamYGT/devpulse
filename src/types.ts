export interface Project {
  id: number;
  name: string;
  path: string | null;
  daily_budget_minutes: number;
  category: string;
  created_at: string;
}

export interface TrackerState {
  is_tracking: boolean;
  is_idle: boolean;
  current_window_title: string;
  current_process_name: string;
  current_project: string | null;
  current_project_id: number | null;
  current_file: string | null;
  current_branch: string | null;
  current_category: string;
  session_start: string;
  elapsed_seconds: number;
  today_commits: number;
  today_productive_minutes: number;
  today_total_minutes: number;
  productivity_percentage: number;
  budget_used_minutes: number;
  budget_limit_minutes: number;
}

export interface TimelineEntry {
  timestamp: string;
  duration_seconds: number;
  process_name: string;
  window_title: string;
  project_name: string | null;
  category: string;
  is_idle: boolean;
}

export interface DailySummary {
  date: string;
  project_id: number | null;
  project_name: string | null;
  total_minutes: number;
  productive_minutes: number;
  distracting_minutes: number;
  idle_minutes: number;
  commit_count: number;
  productivity_score: number;
}

export interface GitEvent {
  id: number;
  timestamp: string;
  project_id: number | null;
  commit_hash: string | null;
  branch: string | null;
  message: string | null;
  lines_added: number;
  lines_removed: number;
}

export interface WeeklyTrends {
  days: DayTrend[];
}

export interface DayTrend {
  date: string;
  total_minutes: number;
  productive_minutes: number;
  distracting_minutes: number;
  commit_count: number;
  productivity_score: number;
}

export interface ProjectStats {
  project: Project;
  today_minutes: number;
  today_commits: number;
  current_branch: string | null;
  budget_percentage: number;
}
