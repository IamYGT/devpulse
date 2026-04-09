import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface Props {
  projectId: number;
  budgetMinutes: number;
}

interface SessionEntry {
  start_time: string;
  end_time: string;
  duration_minutes: number;
}

interface ChartPoint {
  hour: string;
  hourNum: number;
  ideal: number;
  actual: number;
}

function buildChartData(
  sessions: SessionEntry[],
  budgetMinutes: number
): ChartPoint[] {
  // Build hourly data points from 0:00 to 23:00
  const points: ChartPoint[] = [];
  let consumed = 0;

  // Sort sessions by start time
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  for (let h = 0; h <= 23; h++) {
    const hourStart = h * 60;
    const hourEnd = (h + 1) * 60;

    // Sum minutes consumed during this hour
    for (const s of sorted) {
      const sStart = new Date(s.start_time);
      const sEnd = new Date(s.end_time);
      const sStartMin = sStart.getHours() * 60 + sStart.getMinutes();
      const sEndMin = sEnd.getHours() * 60 + sEnd.getMinutes();

      const overlapStart = Math.max(sStartMin, hourStart);
      const overlapEnd = Math.min(sEndMin, hourEnd);

      if (overlapEnd > overlapStart) {
        consumed += overlapEnd - overlapStart;
      }
    }

    const ideal = Math.max(budgetMinutes - (budgetMinutes / 24) * (h + 1), 0);
    const actual = Math.max(budgetMinutes - consumed, 0);

    points.push({
      hour: `${String(h).padStart(2, "0")}:00`,
      hourNum: h,
      ideal: Math.round(ideal),
      actual: Math.round(actual),
    });
  }

  return points;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload as ChartPoint | undefined;
  if (!data) return null;

  const diff = data.actual - data.ideal;
  const ahead = diff > 0;

  return (
    <div
      style={{
        background: "rgba(15,15,40,0.95)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 6,
        padding: "8px 12px",
        fontSize: 11,
      }}
    >
      <div style={{ color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>
        {data.hour}
      </div>
      <div style={{ color: "#fff" }}>
        Kalan: <strong>{data.actual}</strong> dk
      </div>
      <div style={{ color: "rgba(255,255,255,0.5)" }}>
        Ideal: {data.ideal} dk
      </div>
      <div style={{ color: ahead ? "#22c55e" : "#ef4444", marginTop: 2 }}>
        {ahead ? `${diff} dk ileride` : `${Math.abs(diff)} dk geride`}
      </div>
    </div>
  );
}

export default function BurndownChart({ projectId, budgetMinutes }: Props) {
  const [data, setData] = useState<ChartPoint[]>([]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    invoke<SessionEntry[]>("get_project_sessions", {
      projectId,
      date: today,
    })
      .then((sessions) => {
        setData(buildChartData(sessions, budgetMinutes));
      })
      .catch(() => {
        // No data: show ideal line only
        setData(buildChartData([], budgetMinutes));
      });
  }, [projectId, budgetMinutes]);

  // Current hour marker
  const currentHour = new Date().getHours();

  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 12, bottom: 4, left: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.06)"
          />
          <XAxis
            dataKey="hour"
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            interval={3}
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            tickFormatter={(v: number) => `${v}dk`}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Current time reference line */}
          <ReferenceLine
            x={`${String(currentHour).padStart(2, "0")}:00`}
            stroke="rgba(255,255,255,0.25)"
            strokeDasharray="4 4"
            label={{
              value: "Simdi",
              fill: "rgba(255,255,255,0.4)",
              fontSize: 9,
              position: "top",
            }}
          />

          {/* Ideal line */}
          <Line
            type="linear"
            dataKey="ideal"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            dot={false}
            name="Ideal"
          />

          {/* Actual line */}
          <Line
            type="stepAfter"
            dataKey="actual"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            name="Gercek"
            activeDot={{
              r: 4,
              fill: "#3b82f6",
              stroke: "#1e3a5f",
              strokeWidth: 2,
            }}
          />

          <defs>
            <linearGradient id="burndown-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
