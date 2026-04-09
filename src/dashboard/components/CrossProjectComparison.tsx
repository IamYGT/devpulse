import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { Project, DailySummary } from "../../types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getWeekRange(weeksAgo: number): { start: string; end: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() + mondayOffset - weeksAgo * 7);

  const thisSunday = new Date(thisMonday);
  thisSunday.setDate(thisMonday.getDate() + 6);

  return {
    start: thisMonday.toISOString().slice(0, 10),
    end: thisSunday.toISOString().slice(0, 10),
  };
}

function formatHours(minutes: number): string {
  const h = Math.round((minutes / 60) * 10) / 10;
  return `${h}s`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface CrossProjectComparisonProps {
  projects: Project[];
}

interface WeekData {
  projectId: number;
  projectName: string;
  thisWeekMinutes: number;
  lastWeekMinutes: number;
}

export default function CrossProjectComparison({
  projects,
}: CrossProjectComparisonProps) {
  const [weekData, setWeekData] = useState<WeekData[]>([]);

  useEffect(() => {
    const fetchWeekData = async () => {
      try {
        const thisWeekRange = getWeekRange(0);
        const lastWeekRange = getWeekRange(1);

        // Fetch summaries for both weeks
        // Using get_today_summary as a proxy - in production, this would use
        // a weekly range query. We'll aggregate from available data.
        const [thisWeekSummaries, lastWeekSummaries] = await Promise.all([
          invoke<DailySummary[]>("get_weekly_summaries", {
            startDate: thisWeekRange.start,
            endDate: thisWeekRange.end,
          }).catch(() => [] as DailySummary[]),
          invoke<DailySummary[]>("get_weekly_summaries", {
            startDate: lastWeekRange.start,
            endDate: lastWeekRange.end,
          }).catch(() => [] as DailySummary[]),
        ]);

        const data: WeekData[] = projects.map((p) => {
          const thisWeekMin = thisWeekSummaries
            .filter((s) => s.project_id === p.id)
            .reduce((acc, s) => acc + s.total_minutes, 0);
          const lastWeekMin = lastWeekSummaries
            .filter((s) => s.project_id === p.id)
            .reduce((acc, s) => acc + s.total_minutes, 0);

          return {
            projectId: p.id,
            projectName: p.name,
            thisWeekMinutes: thisWeekMin,
            lastWeekMinutes: lastWeekMin,
          };
        });

        // Sort by total (this + last) descending, filter out zeros
        const sorted = data
          .filter((d) => d.thisWeekMinutes > 0 || d.lastWeekMinutes > 0)
          .sort(
            (a, b) =>
              b.thisWeekMinutes +
              b.lastWeekMinutes -
              (a.thisWeekMinutes + a.lastWeekMinutes),
          );

        setWeekData(sorted);
      } catch (err) {
        console.error("Haftalik karsilastirma verisi alinamadi:", err);
        setWeekData([]);
      }
    };

    if (projects.length > 0) {
      fetchWeekData();
    }
  }, [projects]);

  // Build chart data
  const chartData = weekData.map((d) => ({
    name: d.projectName.length > 12 ? d.projectName.slice(0, 12) + "..." : d.projectName,
    "Bu Hafta": Math.round((d.thisWeekMinutes / 60) * 10) / 10,
    "Gecen Hafta": Math.round((d.lastWeekMinutes / 60) * 10) / 10,
  }));

  if (chartData.length === 0) {
    return (
      <div
        style={{
          color: "var(--text-muted)",
          fontSize: 13,
          padding: "24px 0",
          textAlign: "center",
        }}
      >
        Karsilastirma icin yeterli veri yok
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 50)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 20, bottom: 4, left: 8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#222244"
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fill: "#8888aa", fontSize: 11 }}
            axisLine={{ stroke: "#222244" }}
            tickLine={false}
            unit="s"
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "#e8e8f0", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={110}
          />
          <Tooltip
            contentStyle={{
              background: "#1e1e4a",
              border: "1px solid #222244",
              borderRadius: 6,
              fontSize: 12,
              color: "#e8e8f0",
            }}
            formatter={(value: number) => [`${value} saat`, undefined]}
          />
          <Legend
            formatter={(value: string) => (
              <span style={{ color: "#e8e8f0", fontSize: 11 }}>{value}</span>
            )}
            iconType="circle"
            iconSize={8}
          />
          <Bar
            dataKey="Bu Hafta"
            fill="#6366f1"
            radius={[0, 4, 4, 0]}
            barSize={16}
          />
          <Bar
            dataKey="Gecen Hafta"
            fill="#22c55e"
            radius={[0, 4, 4, 0]}
            barSize={16}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Summary line */}
      <div
        style={{
          display: "flex",
          gap: 16,
          justifyContent: "center",
          marginTop: 8,
          fontSize: 11,
          color: "var(--text-muted)",
        }}
      >
        <span>
          Bu hafta toplam:{" "}
          <span className="mono" style={{ color: "var(--accent-blue)", fontWeight: 600 }}>
            {formatHours(weekData.reduce((a, d) => a + d.thisWeekMinutes, 0))}
          </span>
        </span>
        <span>
          Gecen hafta toplam:{" "}
          <span className="mono" style={{ color: "var(--accent-green)", fontWeight: 600 }}>
            {formatHours(weekData.reduce((a, d) => a + d.lastWeekMinutes, 0))}
          </span>
        </span>
      </div>
    </div>
  );
}
