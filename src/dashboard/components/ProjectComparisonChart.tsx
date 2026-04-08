import { useEffect, useState } from "react";
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

interface DailySummary {
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

interface Project {
  id: number;
  name: string;
  path: string | null;
  daily_budget_minutes: number;
  category: string;
  created_at: string;
}

const PROJECT_COLORS = [
  "#6366f1",
  "#22c55e",
  "#f97316",
  "#a855f7",
  "#eab308",
  "#ef4444",
];

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function formatDayLabel(date: string): string {
  const d = new Date(date + "T00:00:00");
  const days = ["Paz", "Pzt", "Sal", "Car", "Per", "Cum", "Cmt"];
  return days[d.getDay()];
}

export default function ProjectComparisonChart() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [summaryData, setSummaryData] = useState<DailySummary[]>([]);

  useEffect(() => {
    invoke<Project[]>("get_projects")
      .then((p) => {
        setProjects(p);
        // Auto-select first 3 projects
        const initial = new Set(p.slice(0, 3).map((proj) => proj.id));
        setSelected(initial);
      })
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    invoke<DailySummary[]>("get_today_summary")
      .then(setSummaryData)
      .catch(() => setSummaryData([]));
  }, []);

  const toggleProject = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 3) {
        next.add(id);
      }
      return next;
    });
  };

  const days = getLast7Days();
  const selectedProjects = projects.filter((p) => selected.has(p.id));

  // Build chart data: one entry per day, each selected project as a key
  const chartData = days.map((day) => {
    const entry: Record<string, string | number> = {
      day: formatDayLabel(day),
      date: day,
    };
    selectedProjects.forEach((proj) => {
      const match = summaryData.find(
        (s) => s.date === day && s.project_id === proj.id
      );
      entry[proj.name] = match ? Math.round(match.total_minutes / 60 * 10) / 10 : 0;
    });
    return entry;
  });

  return (
    <div>
      {/* Project checkboxes */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {projects.map((proj) => {
          const isSelected = selected.has(proj.id);
          const colorIdx = selectedProjects.findIndex(
            (p) => p.id === proj.id
          );
          const color =
            colorIdx >= 0
              ? PROJECT_COLORS[colorIdx % PROJECT_COLORS.length]
              : "#555577";

          return (
            <label
              key={proj.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                fontSize: 12,
                color: isSelected ? "#e8e8f0" : "#555577",
                opacity: !isSelected && selected.size >= 3 ? 0.4 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={!isSelected && selected.size >= 3}
                onChange={() => toggleProject(proj.id)}
                style={{ accentColor: color }}
              />
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: color,
                  display: "inline-block",
                }}
              />
              {proj.name}
            </label>
          );
        })}
      </div>

      {/* Chart */}
      {selectedProjects.length === 0 ? (
        <div
          style={{ color: "#555577", fontSize: 13, padding: "24px 0" }}
        >
          Karsilastirmak icin proje secin (en fazla 3)
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 4, bottom: 4, left: -16 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#222244"
              vertical={false}
            />
            <XAxis
              dataKey="day"
              tick={{ fill: "#8888aa", fontSize: 11 }}
              axisLine={{ stroke: "#222244" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#8888aa", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              unit="s"
            />
            <Tooltip
              contentStyle={{
                background: "#1e1e4a",
                border: "1px solid #222244",
                borderRadius: 6,
                fontSize: 12,
                color: "#e8e8f0",
              }}
              formatter={(value: number) => [
                `${value} saat`,
                undefined,
              ]}
              labelFormatter={(label: string) => label}
            />
            <Legend
              formatter={(value: string) => (
                <span style={{ color: "#e8e8f0", fontSize: 11 }}>
                  {value}
                </span>
              )}
              iconType="circle"
              iconSize={8}
            />
            {selectedProjects.map((proj, idx) => (
              <Bar
                key={proj.id}
                dataKey={proj.name}
                fill={PROJECT_COLORS[idx % PROJECT_COLORS.length]}
                radius={[4, 4, 0, 0]}
                barSize={18}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
