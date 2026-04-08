import { useState, useEffect, useRef, useCallback } from "react";
import { useTrackerState } from "../hooks/useTrackerState";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import "./minibar.css";

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function extractProjectName(raw: string | null, processName: string): string {
  if (!raw) return processName || "---";
  // If it looks like a path, take the last segment
  if (raw.includes("/") || raw.includes("\\")) {
    const segments = raw.split(/[/\\]/).filter(Boolean);
    return segments[segments.length - 1] || raw;
  }
  return raw;
}

function extractFileName(raw: string | null): string | null {
  if (!raw) return null;
  const segments = raw.split(/[/\\]/).filter(Boolean);
  return segments[segments.length - 1] || null;
}

async function openDashboard() {
  try {
    const thisWindow = getCurrentWindow();
    const label = thisWindow.label;
    // Try to show the dashboard window (sibling)
    const dashboardLabel = label === "minibar" ? "dashboard" : "dashboard";
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const dashboard = await WebviewWindow.getByLabel(dashboardLabel);
    if (dashboard) {
      await dashboard.show();
      await dashboard.setFocus();
    }
  } catch {
    // silently fail
  }
}

const AUTO_HIDE_DELAY = 3000;

export default function MiniBar() {
  const state = useTrackerState(1000);

  // Auto-hide state
  const [autoHide, setAutoHide] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load autoHide setting on mount
  useEffect(() => {
    invoke<string | null>("get_setting", { key: "minibar_auto_hide" }).then((val) => {
      if (val === "true") setAutoHide(true);
    }).catch(() => {});
  }, []);

  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setCollapsed(false);
    if (autoHide) {
      hideTimerRef.current = setTimeout(() => {
        setCollapsed(true);
      }, AUTO_HIDE_DELAY);
    }
  }, [autoHide]);

  // Start/stop auto-hide timer when autoHide changes
  useEffect(() => {
    if (autoHide) {
      resetHideTimer();
    } else {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      setCollapsed(false);
    }
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [autoHide, resetHideTimer]);

  const handleMouseEnter = () => {
    if (autoHide) {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      setCollapsed(false);
    }
  };

  const handleMouseLeave = () => {
    if (autoHide) {
      resetHideTimer();
    }
  };

  const handleMouseMove = () => {
    if (autoHide && !collapsed) {
      resetHideTimer();
    }
  };

  // Pause/Resume handler
  const handleToggleTracking = async () => {
    if (!state) return;
    try {
      if (state.is_tracking) {
        await invoke("pause_tracking");
      } else {
        await invoke("resume_tracking");
      }
    } catch {
      // silently fail
    }
  };

  if (!state) {
    return (
      <div
        className={`minibar${collapsed ? " collapsed" : ""}`}
        data-category="neutral"
        data-idle="false"
        data-tauri-drag-region
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
      >
        <div className="minibar-left">
          <span className="minibar-project neutral">DevPulse</span>
        </div>
        <div className="minibar-center">
          <span className="minibar-timer">00:00:00</span>
        </div>
        <div className="minibar-right">
          <span className="minibar-stat">
            <span className="stat-value">--</span>
          </span>
        </div>
        <div className="minibar-resize-handle" />
      </div>
    );
  }

  const budgetPct =
    state.budget_limit_minutes > 0
      ? (state.budget_used_minutes / state.budget_limit_minutes) * 100
      : 0;

  const projectDisplay = extractProjectName(state.current_project, state.current_process_name);
  const fileDisplay = extractFileName(state.current_file);
  const branchDisplay = state.current_branch;
  const showBudgetWarning = budgetPct >= 80 && budgetPct < 100;
  const showBudgetDanger = budgetPct >= 100;

  return (
    <div
      className={`minibar${collapsed ? " collapsed" : ""}`}
      data-category={state.current_category}
      data-idle={state.is_idle ? "true" : "false"}
      data-tauri-drag-region
      onDoubleClick={openDashboard}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      {/* Left: Project + Branch + File + Badges */}
      <div className="minibar-left">
        <span className={`minibar-project ${state.current_category}`}>
          {projectDisplay}
        </span>

        {(branchDisplay || fileDisplay) && (
          <div className="minibar-meta">
            {branchDisplay && (
              <>
                <span className="minibar-separator">/</span>
                <span className="minibar-branch">{branchDisplay}</span>
              </>
            )}
            {fileDisplay && (
              <>
                <span className="minibar-separator">/</span>
                <span className="minibar-file">{fileDisplay}</span>
              </>
            )}
          </div>
        )}

        {state.is_idle && <span className="minibar-badge idle">IDLE</span>}
        {!state.is_tracking && <span className="minibar-badge paused">PAUSED</span>}
      </div>

      {/* Drag spacer */}
      <div className="drag-spacer" data-tauri-drag-region />

      {/* Center: Timer */}
      <div className="minibar-center" data-tauri-drag-region>
        <span className="minibar-timer">{formatTime(state.elapsed_seconds)}</span>
      </div>

      {/* Drag spacer */}
      <div className="drag-spacer" data-tauri-drag-region />

      {/* Right: Budget + Stats */}
      <div className="minibar-right">
        {/* Budget warning */}
        {showBudgetDanger && (
          <div className="minibar-budget danger">
            <span>OVER</span>
            <div className="budget-bar">
              <div className="budget-fill" style={{ width: "100%" }} />
            </div>
          </div>
        )}
        {showBudgetWarning && (
          <div className="minibar-budget warning">
            <span>{budgetPct.toFixed(0)}%</span>
            <div className="budget-bar">
              <div className="budget-fill" style={{ width: `${Math.min(budgetPct, 100)}%` }} />
            </div>
          </div>
        )}

        {(showBudgetWarning || showBudgetDanger) && (
          <div className="minibar-stat-divider" />
        )}

        {/* Commits */}
        <span className="minibar-stat">
          <span className="stat-icon">C</span>
          <span className="stat-value">{state.today_commits}</span>
        </span>

        <div className="minibar-stat-divider" />

        {/* Productivity */}
        <span className="minibar-stat">
          <span className="stat-value">{state.productivity_percentage.toFixed(0)}%</span>
        </span>

        <div className="minibar-stat-divider" />

        {/* Total time */}
        <span className="minibar-stat">
          <span className="stat-value">{formatMinutes(state.today_total_minutes)}</span>
        </span>
      </div>

      {/* Quick Action Buttons */}
      <div className="minibar-actions">
        <button
          className="minibar-action-btn"
          onClick={handleToggleTracking}
          title={state.is_tracking ? "Pause tracking" : "Resume tracking"}
        >
          {state.is_tracking ? "\u23F8" : "\u25B6"}
        </button>
        <button
          className="minibar-action-btn"
          onClick={openDashboard}
          title="Open Dashboard"
        >
          {"\uD83D\uDCCA"}
        </button>
      </div>

      {/* Resize handle */}
      <div className="minibar-resize-handle" />
    </div>
  );
}
