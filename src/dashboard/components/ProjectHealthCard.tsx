import type { Project, DailySummary } from "../../types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type HealthStatus = "on_track" | "behind" | "neglected" | "no_budget";

export interface ProjectHealthData {
  project: Project;
  todaySummary: DailySummary | null;
  lastActive: string | null; // ISO date string
  weekCommits: number;
}

/* ------------------------------------------------------------------ */
/*  Health Calculation                                                  */
/* ------------------------------------------------------------------ */

export function getProjectHealth(
  project: Project,
  todaySummary: DailySummary | null,
  lastActive: string | null,
): HealthStatus {
  if (project.daily_budget_minutes === 0) return "no_budget";

  if (lastActive) {
    const lastDate = new Date(lastActive);
    const now = new Date();
    const diffMs = now.getTime() - lastDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays > 2) return "neglected";
  }

  if (todaySummary) {
    const usedMinutes = todaySummary.total_minutes;
    const budget = project.daily_budget_minutes;
    const currentHour = new Date().getHours();
    if (usedMinutes < budget * 0.3 && currentHour >= 14) return "behind";
  }

  return "on_track";
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h > 0) return `${h}s ${m}dk`;
  return `${m}dk`;
}

function formatBudget(used: number, budget: number): string {
  return `${formatMinutes(used)} / ${formatMinutes(budget)} butce`;
}

function formatLastActive(lastActive: string | null): {
  text: string;
  isWarning: boolean;
} {
  if (!lastActive) return { text: "Hic aktif degil", isWarning: true };

  const last = new Date(lastActive);
  const now = new Date();
  const diffMs = now.getTime() - last.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 60) return { text: `${diffMinutes} dk once`, isWarning: false };
  if (diffHours < 24) return { text: `${diffHours} saat once`, isWarning: false };
  return { text: `${diffDays} gun once`, isWarning: diffDays > 2 };
}

const healthConfig: Record<
  HealthStatus,
  { emoji: string; label: string; color: string; borderColor: string }
> = {
  on_track: {
    emoji: "\uD83D\uDFE2",
    label: "Yolunda",
    color: "var(--accent-green)",
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  behind: {
    emoji: "\uD83D\uDFE1",
    label: "Geride",
    color: "var(--accent-yellow)",
    borderColor: "rgba(234, 179, 8, 0.3)",
  },
  neglected: {
    emoji: "\uD83D\uDD34",
    label: "Ihmal Edilmis",
    color: "var(--accent-red)",
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  no_budget: {
    emoji: "\u26AA",
    label: "Butce Yok",
    color: "var(--text-muted)",
    borderColor: "var(--border)",
  },
};

function getPriorityBadge(budget: number): {
  label: string;
  bg: string;
  color: string;
} | null {
  if (budget >= 180) return { label: "P0", bg: "rgba(239, 68, 68, 0.15)", color: "var(--accent-red)" };
  if (budget >= 60) return { label: "P1", bg: "rgba(234, 179, 8, 0.15)", color: "var(--accent-yellow)" };
  if (budget > 0) return { label: "P2", bg: "rgba(85, 85, 119, 0.2)", color: "var(--text-secondary)" };
  return null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface ProjectHealthCardProps {
  data: ProjectHealthData;
  onSwitchProject: (projectId: number) => void;
  onNavigate?: (path: string) => void;
}

export default function ProjectHealthCard({
  data,
  onSwitchProject,
  onNavigate,
}: ProjectHealthCardProps) {
  const { project, todaySummary, lastActive, weekCommits } = data;
  const health = getProjectHealth(project, todaySummary, lastActive);
  const config = healthConfig[health];
  const priority = getPriorityBadge(project.daily_budget_minutes);
  const lastActiveInfo = formatLastActive(lastActive);

  const usedMinutes = todaySummary?.total_minutes ?? 0;
  const budgetMinutes = project.daily_budget_minutes;
  const budgetPercent =
    budgetMinutes > 0 ? Math.min((usedMinutes / budgetMinutes) * 100, 100) : 0;
  const barColor =
    budgetPercent >= 80
      ? "green"
      : budgetPercent >= 50
        ? "yellow"
        : budgetPercent >= 20
          ? "orange"
          : "red";

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${config.borderColor}`,
        borderRadius: "var(--radius)",
        padding: 20,
        transition: "border-color 0.25s ease, transform 0.2s ease",
        cursor: "default",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLElement).style.borderColor = config.color;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLElement).style.borderColor = config.borderColor;
      }}
    >
      {/* Header: name + badges */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 16, fontWeight: 700, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {project.name}
        </span>

        {priority && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 100,
              background: priority.bg,
              color: priority.color,
              letterSpacing: 0.5,
            }}
          >
            {priority.label}
          </span>
        )}

        <span style={{ fontSize: 13 }} title={config.label}>
          {config.emoji}
        </span>
      </div>

      {/* Health label */}
      <div style={{ fontSize: 11, color: config.color, fontWeight: 600, letterSpacing: 0.3 }}>
        {config.label}
      </div>

      {/* Stats */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
        {/* Today's time */}
        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)" }}>
          <span>Bugun</span>
          <span className="mono" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
            {budgetMinutes > 0 ? formatBudget(usedMinutes, budgetMinutes) : formatMinutes(usedMinutes)}
          </span>
        </div>

        {/* Week commits */}
        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)" }}>
          <span>Bu hafta commit</span>
          <span className="mono" style={{ fontWeight: 600, color: "var(--accent-purple)" }}>
            {weekCommits}
          </span>
        </div>

        {/* Last active */}
        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)" }}>
          <span>Son aktif</span>
          <span
            className="mono"
            style={{
              fontWeight: 600,
              color: lastActiveInfo.isWarning ? "var(--accent-red)" : "var(--text-primary)",
            }}
          >
            {lastActiveInfo.text}
          </span>
        </div>
      </div>

      {/* Budget progress bar */}
      {budgetMinutes > 0 && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: "var(--text-muted)",
              marginBottom: 4,
            }}
          >
            <span>Butce kullanimi</span>
            <span className="mono">%{budgetPercent.toFixed(0)}</span>
          </div>
          <div className="progress-bar">
            <div
              className={`progress-bar-fill ${barColor}`}
              style={{ width: `${budgetPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button
          className="btn btn-primary"
          style={{ flex: 1, fontSize: 12, padding: "6px 12px" }}
          onClick={() => onSwitchProject(project.id)}
        >
          Calis
        </button>
        <button
          className="btn"
          style={{ flex: 1, fontSize: 12, padding: "6px 12px" }}
          onClick={() => onNavigate?.("/budget")}
        >
          Planla
        </button>
      </div>
    </div>
  );
}
