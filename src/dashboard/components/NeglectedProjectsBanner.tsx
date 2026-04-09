import { useState, useEffect } from "react";
import type { Project } from "../../types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface NeglectedProject {
  project: Project;
  lastActive: string | null;
  daysSinceActive: number;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface NeglectedProjectsBannerProps {
  neglectedProjects: NeglectedProject[];
  onProjectClick?: (projectId: number) => void;
}

export default function NeglectedProjectsBanner({
  neglectedProjects,
  onProjectClick,
}: NeglectedProjectsBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissal each day
  useEffect(() => {
    const stored = localStorage.getItem("devpulse_neglect_dismissed_date");
    const today = new Date().toISOString().slice(0, 10);
    if (stored !== today) {
      setDismissed(false);
    }
  }, []);

  // Only show projects with budgets that haven't been touched in >2 days
  const filtered = neglectedProjects.filter(
    (np) => np.project.daily_budget_minutes > 0 && np.daysSinceActive > 2,
  );

  if (filtered.length === 0 || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem("devpulse_neglect_dismissed_date", today);
  };

  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(249, 115, 22, 0.12) 100%)",
        border: "1px solid rgba(239, 68, 68, 0.25)",
        borderRadius: "var(--radius)",
        padding: "14px 20px",
        marginBottom: 20,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* Warning icon */}
      <span style={{ fontSize: 18, flexShrink: 0 }}>&#9888;&#65039;</span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--accent-red)",
            marginBottom: 4,
          }}
        >
          Bu projelere dikkat etmelisin:
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {filtered.map((np) => (
            <button
              key={np.project.id}
              onClick={() => onProjectClick?.(np.project.id)}
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                borderRadius: 100,
                padding: "3px 12px",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--accent-red)",
                cursor: "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(239, 68, 68, 0.2)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(239, 68, 68, 0.1)";
              }}
            >
              {np.project.name}
              <span
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  fontWeight: 400,
                }}
              >
                ({np.daysSinceActive} gun)
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        style={{
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          fontSize: 16,
          padding: "4px 8px",
          flexShrink: 0,
          transition: "color 0.2s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
        }}
        title="Bugunku icin kapat"
      >
        &#10005;
      </button>
    </div>
  );
}
