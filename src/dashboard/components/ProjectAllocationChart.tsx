import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { Project, DailySummary } from "../../types";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const COLORS = [
  "#6366f1",
  "#22c55e",
  "#f97316",
  "#a855f7",
  "#eab308",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h > 0) return `${h}s ${m}dk`;
  return `${m}dk`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface ProjectAllocationChartProps {
  projects: Project[];
  summaries: DailySummary[];
}

export default function ProjectAllocationChart({
  projects,
  summaries,
}: ProjectAllocationChartProps) {
  // Build actual time data from summaries
  const actualData = summaries
    .filter((s) => s.project_name && s.total_minutes > 0)
    .map((s) => ({
      name: s.project_name || "Diger",
      value: Math.round(s.total_minutes),
      projectId: s.project_id,
    }));

  // Build planned (budget) data from projects
  const plannedData = projects
    .filter((p) => p.daily_budget_minutes > 0)
    .map((p) => ({
      name: p.name,
      value: p.daily_budget_minutes,
    }));

  const hasActual = actualData.length > 0;
  const hasPlanned = plannedData.length > 0;

  if (!hasActual && !hasPlanned) {
    return (
      <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "24px 0", textAlign: "center" }}>
        Henuz zaman verisi yok
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          {/* Outer ring: Planned budgets */}
          {hasPlanned && (
            <Pie
              data={plannedData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={110}
              innerRadius={85}
              paddingAngle={2}
              opacity={0.35}
            >
              {plannedData.map((_entry, index) => (
                <Cell
                  key={`planned-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  stroke="none"
                />
              ))}
            </Pie>
          )}

          {/* Inner ring: Actual time */}
          {hasActual && (
            <Pie
              data={actualData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={hasPlanned ? 80 : 110}
              innerRadius={hasPlanned ? 45 : 60}
              paddingAngle={2}
            >
              {actualData.map((_entry, index) => (
                <Cell
                  key={`actual-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  stroke="none"
                />
              ))}
            </Pie>
          )}

          <Tooltip
            contentStyle={{
              background: "#1e1e4a",
              border: "1px solid #222244",
              borderRadius: 6,
              fontSize: 12,
              color: "#e8e8f0",
            }}
            formatter={(value: number) => [formatMinutes(value), undefined]}
          />
          <Legend
            formatter={(value: string) => (
              <span style={{ color: "#e8e8f0", fontSize: 11 }}>{value}</span>
            )}
            iconType="circle"
            iconSize={8}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Ring legend */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 24,
          fontSize: 11,
          color: "var(--text-muted)",
          marginTop: 4,
        }}
      >
        {hasPlanned && (
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 20,
                height: 6,
                borderRadius: 3,
                background: "var(--accent-blue)",
                opacity: 0.35,
                display: "inline-block",
              }}
            />
            Planlanan (Dis halka)
          </span>
        )}
        {hasActual && (
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 20,
                height: 6,
                borderRadius: 3,
                background: "var(--accent-blue)",
                display: "inline-block",
              }}
            />
            Gerceklesen (Ic halka)
          </span>
        )}
      </div>
    </div>
  );
}
