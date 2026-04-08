import { invoke } from "@tauri-apps/api/core";
import type { PomodoroState } from "../../hooks/usePomodoroState";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function modeLabel(mode: PomodoroState["mode"]): string {
  switch (mode) {
    case "work":
      return "CALIS";
    case "short_break":
      return "KISA MOLA";
    case "long_break":
      return "UZUN MOLA";
    case "idle":
      return "HAZIR";
  }
}

function modeColor(mode: PomodoroState["mode"]): string {
  switch (mode) {
    case "work":
      return "var(--accent-green)";
    case "short_break":
      return "var(--accent-blue)";
    case "long_break":
      return "var(--accent-purple)";
    case "idle":
      return "var(--text-muted)";
  }
}

function totalDuration(state: PomodoroState): number {
  switch (state.mode) {
    case "work":
      return state.work_duration;
    case "short_break":
      return state.short_break_duration;
    case "long_break":
      return state.long_break_duration;
    case "idle":
      return 1; // avoid division by zero
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface PomodoroTimerProps {
  state: PomodoroState;
  notification: string | null;
}

export function PomodoroTimer({ state, notification }: PomodoroTimerProps) {
  const color = modeColor(state.mode);
  const label = modeLabel(state.mode);
  const total = totalDuration(state);
  const progress = state.mode === "idle" ? 0 : state.remaining_seconds / total;

  // SVG circle parameters
  const size = 240;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  async function handleStart() {
    try {
      await invoke("start_pomodoro");
    } catch (err) {
      console.error("start_pomodoro failed:", err);
    }
  }

  async function handlePause() {
    try {
      await invoke("pause_pomodoro");
    } catch (err) {
      console.error("pause_pomodoro failed:", err);
    }
  }

  async function handleSkip() {
    try {
      await invoke("skip_pomodoro");
    } catch (err) {
      console.error("skip_pomodoro failed:", err);
    }
  }

  async function handleStop() {
    try {
      await invoke("stop_pomodoro");
    } catch (err) {
      console.error("stop_pomodoro failed:", err);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
      {/* Notification banner */}
      {notification && (
        <div
          style={{
            background: "rgba(99, 102, 241, 0.15)",
            border: "1px solid var(--accent-blue)",
            borderRadius: "var(--radius)",
            padding: "10px 20px",
            color: "var(--text-primary)",
            fontSize: "14px",
            fontWeight: 500,
            textAlign: "center",
            width: "100%",
            maxWidth: "360px",
          }}
        >
          {notification}
        </div>
      )}

      {/* Circular timer */}
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              transition: "stroke-dashoffset 0.5s ease, stroke 0.3s ease",
              filter: state.is_running ? `drop-shadow(0 0 8px ${color})` : "none",
            }}
          />
        </svg>

        {/* Center text */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            className="mono"
            style={{
              fontSize: "48px",
              fontWeight: 700,
              color: color,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {formatTime(state.remaining_seconds)}
          </span>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-secondary)",
              letterSpacing: "2px",
              marginTop: "8px",
            }}
          >
            {label}
          </span>
        </div>
      </div>

      {/* Session counter */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          color: "var(--text-secondary)",
          fontSize: "14px",
          fontWeight: 500,
        }}
      >
        <span>Oturum:</span>
        <span className="mono" style={{ color: "var(--text-primary)", fontWeight: 700 }}>
          {state.sessions_completed}
        </span>
        <span>/</span>
        <span className="mono">{state.long_break_interval}</span>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "10px" }}>
        {state.mode === "idle" ? (
          <button className="btn btn-primary" onClick={handleStart}>
            Baslat
          </button>
        ) : (
          <button className="btn btn-primary" onClick={handlePause}>
            {state.is_running ? "Duraklat" : "Devam Et"}
          </button>
        )}
        <button
          className="btn"
          onClick={handleSkip}
          disabled={state.mode === "idle"}
          style={{ opacity: state.mode === "idle" ? 0.4 : 1 }}
        >
          Atla
        </button>
        <button
          className="btn btn-danger"
          onClick={handleStop}
          disabled={state.mode === "idle"}
          style={{ opacity: state.mode === "idle" ? 0.4 : 1 }}
        >
          Durdur
        </button>
      </div>
    </div>
  );
}
