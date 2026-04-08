import { useTrackerState } from "../../hooks/useTrackerState";

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}dk`;
  return m > 0 ? `${h}s ${m}dk` : `${h}s`;
}

interface PillProps {
  icon: string;
  label: string;
  value: string;
  color?: string;
}

function StatPill({ icon, label, value, color }: PillProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 12px",
        borderRadius: 100,
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        fontSize: 12,
        whiteSpace: "nowrap",
        transition: "border-color 0.2s ease",
      }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>
        {label}
      </span>
      <span
        className="mono"
        style={{
          fontWeight: 700,
          color: color || "var(--text-primary)",
          fontSize: 12,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function QuickStats() {
  const state = useTrackerState(3000);

  if (!state) {
    return null;
  }

  // Calculate session count from today_total_minutes and elapsed
  // We approximate sessions as a count - using today_commits as a proxy indicator
  const sessionCount = Math.max(
    1,
    Math.ceil(state.today_total_minutes / 25),
  ); // rough estimate: 1 session per 25min block

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        padding: "10px 0",
      }}
    >
      {/* Streak - using commits as proxy */}
      {state.today_commits > 0 && (
        <StatPill
          icon="&#128293;"
          label="Commit"
          value={`${state.today_commits}`}
          color="var(--accent-orange)"
        />
      )}

      {/* Today's productive hours */}
      <StatPill
        icon="&#9989;"
        label="Uretken"
        value={formatHours(state.today_productive_minutes)}
        color="var(--accent-green)"
      />

      {/* Active project */}
      {state.current_project && (
        <StatPill
          icon="&#128194;"
          label="Proje"
          value={state.current_project}
          color="var(--accent-blue)"
        />
      )}

      {/* Session count */}
      <StatPill
        icon="&#9201;"
        label="Oturum"
        value={`${sessionCount}`}
        color="var(--accent-purple)"
      />

      {/* Productivity percentage */}
      <StatPill
        icon="&#128200;"
        label="Verimlilik"
        value={`%${state.productivity_percentage.toFixed(0)}`}
        color={
          state.productivity_percentage >= 70
            ? "var(--accent-green)"
            : state.productivity_percentage >= 40
              ? "var(--accent-yellow)"
              : "var(--accent-red)"
        }
      />
    </div>
  );
}
