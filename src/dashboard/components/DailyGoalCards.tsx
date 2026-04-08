import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface DailyGoal {
  id: string;
  label: string;
  goal_type: string;      // "productive_hours" | "commits" | "productivity"
  current: number;
  target: number;
}

function goalIcon(goalType: string): React.ReactElement {
  switch (goalType) {
    case "productive_hours":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "commits":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="18" r="3" />
          <circle cx="12" cy="6" r="3" />
          <line x1="12" y1="9" x2="12" y2="15" />
        </svg>
      );
    case "productivity":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-yellow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="5" x2="5" y2="19" />
          <circle cx="6.5" cy="6.5" r="2.5" />
          <circle cx="17.5" cy="17.5" r="2.5" />
        </svg>
      );
    default:
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
  }
}

function goalTypeLabel(goalType: string): string {
  switch (goalType) {
    case "productive_hours":
      return "Uretken Saat";
    case "commits":
      return "Commit";
    case "productivity":
      return "Verimlilik";
    default:
      return goalType;
  }
}

function formatValue(goalType: string, value: number): string {
  switch (goalType) {
    case "productive_hours":
      return `${value.toFixed(1)}s`;
    case "commits":
      return `${Math.round(value)}`;
    case "productivity":
      return `%${Math.round(value)}`;
    default:
      return `${value}`;
  }
}

export default function DailyGoalCards() {
  const [goals, setGoals] = useState<DailyGoal[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    invoke<DailyGoal[]>("get_daily_goals")
      .then(setGoals)
      .catch(() => {
        setError(true);
        setGoals([]);
      });
  }, []);

  // No goals set - show link to budget page
  if (error || goals.length === 0) {
    return (
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "20px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            marginBottom: 8,
          }}
        >
          Henuz gunluk hedef belirlenmemis
        </div>
        <a
          href="#"
          style={{
            fontSize: 12,
            color: "var(--accent-blue)",
            textDecoration: "none",
          }}
        >
          Hedef belirlemek icin Butce sayfasina git
        </a>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
      }}
    >
      {goals.map((goal) => {
        const progress = goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
        const clampedProgress = Math.min(progress, 100);
        const isCompleted = goal.current >= goal.target;

        return (
          <div
            key={goal.id}
            style={{
              background: "var(--bg-card)",
              border: `1px solid ${isCompleted ? "var(--accent-green)" : "var(--border)"}`,
              borderRadius: "var(--radius)",
              padding: "16px",
              transition: "border-color 0.3s ease",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Completed glow */}
            {isCompleted && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background:
                    "linear-gradient(135deg, rgba(34, 197, 94, 0.06) 0%, transparent 60%)",
                  pointerEvents: "none",
                }}
              />
            )}

            {/* Header row: icon + label + check */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
              }}
            >
              {goalIcon(goal.goal_type)}
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  fontWeight: 600,
                  flex: 1,
                }}
              >
                {goal.label || goalTypeLabel(goal.goal_type)}
              </span>

              {/* Celebratory check mark */}
              {isCompleted && (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--accent-green)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>

            {/* Progress bar */}
            <div className="progress-bar" style={{ height: 8, marginBottom: 8 }}>
              <div
                className={`progress-bar-fill ${isCompleted ? "green" : "blue"}`}
                style={{
                  width: `${clampedProgress}%`,
                  background: isCompleted
                    ? "var(--accent-green)"
                    : "var(--accent-blue)",
                }}
              />
            </div>

            {/* Current / target text */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: isCompleted
                    ? "var(--accent-green)"
                    : "var(--accent-blue)",
                }}
              >
                {formatValue(goal.goal_type, goal.current)}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                / {formatValue(goal.goal_type, goal.target)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
