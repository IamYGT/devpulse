import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface OvertimeInfo {
  project_name: string;
  budget_minutes: number;
  actual_minutes: number;
  overtime_minutes: number;
  percentage: number;
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return `${h}s ${m}dk`;
  return `${m}dk`;
}

/**
 * OvertimeReport - Card showing overtime status per project.
 * Displays budget bars, overtime amounts in red, and burnout risk indicator.
 */
export default function OvertimeReport() {
  const [overtimeData, setOvertimeData] = useState<OvertimeInfo[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const data = await invoke<OvertimeInfo[]>("get_overtime_report");
      setOvertimeData(data);
    } catch (err) {
      console.error("Overtime report fetch failed:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [fetchData]);

  if (overtimeData.length === 0) {
    return null;
  }

  const totalOvertime = overtimeData.reduce((sum, p) => sum + p.overtime_minutes, 0);
  const projectsOverBudget = overtimeData.filter((p) => p.overtime_minutes > 0).length;

  // Burnout risk calculation based on overtime percentage
  const avgPercentage =
    overtimeData.reduce((sum, p) => sum + p.percentage, 0) / overtimeData.length;
  const burnoutLevel =
    avgPercentage > 180
      ? "Yuksek"
      : avgPercentage > 130
        ? "Orta"
        : avgPercentage > 100
          ? "Dusuk"
          : "Normal";
  const burnoutColor =
    avgPercentage > 180
      ? "#ef4444"
      : avgPercentage > 130
        ? "#f97316"
        : avgPercentage > 100
          ? "#eab308"
          : "#22c55e";

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12,6 12,12 16,14" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Fazla Mesai Raporu</span>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {totalOvertime > 0 && (
            <span
              className="mono"
              style={{ fontSize: 13, color: "var(--accent-red)", fontWeight: 600 }}
            >
              +{formatMinutes(totalOvertime)} toplam
            </span>
          )}
          <div
            style={{
              padding: "4px 10px",
              borderRadius: "var(--radius)",
              background: `${burnoutColor}20`,
              color: burnoutColor,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            Burnout Riski: {burnoutLevel}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      {projectsOverBudget > 0 && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            borderRadius: "var(--radius)",
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 13,
            color: "var(--accent-red)",
          }}
        >
          {projectsOverBudget} proje butcesini asti. Toplam fazla mesai: {formatMinutes(totalOvertime)}
        </div>
      )}

      {/* Per-project bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {overtimeData.map((project) => {
          const pct = Math.min(project.percentage, 200);
          const isOver = project.overtime_minutes > 0;
          const barColor = isOver
            ? "var(--accent-red)"
            : project.percentage >= 80
              ? "var(--accent-yellow)"
              : "var(--accent-green)";

          return (
            <div key={project.project_name}>
              {/* Project row */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {project.project_name}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    className="mono"
                    style={{ fontSize: 13, color: "var(--text-secondary)" }}
                  >
                    {formatMinutes(project.actual_minutes)} / {formatMinutes(project.budget_minutes)}
                  </span>
                  {isOver && (
                    <span
                      className="mono"
                      style={{
                        fontSize: 12,
                        color: "var(--accent-red)",
                        fontWeight: 700,
                        background: "rgba(239, 68, 68, 0.1)",
                        padding: "2px 8px",
                        borderRadius: 4,
                      }}
                    >
                      ASILDI +{formatMinutes(project.overtime_minutes)}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div
                style={{
                  width: "100%",
                  height: 8,
                  background: "var(--bg-primary)",
                  borderRadius: 4,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                {/* Budget mark at 100% */}
                <div
                  style={{
                    position: "absolute",
                    left: "50%", // 100% mark when max is 200%
                    top: 0,
                    bottom: 0,
                    width: 2,
                    background: "var(--text-muted)",
                    zIndex: 1,
                    opacity: 0.5,
                  }}
                />
                <div
                  style={{
                    height: "100%",
                    width: `${(pct / 200) * 100}%`,
                    background: barColor,
                    borderRadius: 4,
                    transition: "width 0.5s ease",
                  }}
                />
              </div>

              {/* Percentage */}
              <div
                style={{
                  fontSize: 11,
                  color: isOver ? "var(--accent-red)" : "var(--text-muted)",
                  textAlign: "right",
                  marginTop: 2,
                }}
              >
                %{project.percentage.toFixed(0)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
