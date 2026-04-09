import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { WeeklyTrends } from "../../types";
import HeatmapChart from "../components/HeatmapChart";
import RadarChart from "../components/RadarChart";
import StreamGraph from "../components/StreamGraph";

const tooltipStyle = {
  background: "#1a1a2e",
  border: "1px solid #2a2a3e",
  borderRadius: 8,
  fontSize: 12,
};

const axisProps = {
  stroke: "#6b7280",
  fontSize: 11,
  tickLine: false,
  axisLine: { stroke: "#2a2a3e" },
};

export default function WeekPage() {
  const [trends, setTrends] = useState<WeeklyTrends | null>(null);

  useEffect(() => {
    invoke<WeeklyTrends>("get_weekly_trends")
      .then(setTrends)
      .catch(console.error);
  }, []);

  const chartData =
    trends?.days.map((d) => ({
      date: d.date.substring(5),
      productive: Math.round((d.productive_minutes / 60) * 10) / 10,
      distracting: Math.round((d.distracting_minutes / 60) * 10) / 10,
      total: Math.round((d.total_minutes / 60) * 10) / 10,
      commits: d.commit_count,
      productivity: Math.round(d.productivity_score),
    })) || [];

  // Build StreamGraph data from weekly trends
  const streamData = useMemo(() => {
    if (!trends?.days) return [];
    return trends.days.map((d) => ({
      date: d.date.substring(5),
      projects: [
        { name: "Verimli", hours: Math.round((d.productive_minutes / 60) * 10) / 10 },
        { name: "Dikkat Dagitici", hours: Math.round((d.distracting_minutes / 60) * 10) / 10 },
        {
          name: "Notral",
          hours: Math.max(
            0,
            Math.round(((d.total_minutes - d.productive_minutes - d.distracting_minutes) / 60) * 10) / 10
          ),
        },
      ],
    }));
  }, [trends]);

  if (chartData.length === 0) {
    return (
      <div>
        <h1 className="page-title">Weekly Trends</h1>
        <div className="empty-state">
          <h3>No weekly data yet</h3>
          <p>Trends will appear here after a few days of tracking.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Weekly Trends</h1>

      {/* Heatmap - yearly overview */}
      <HeatmapChart year={new Date().getFullYear()} />

      {/* Daily Working Hours - Stacked Bar */}
      <div className="card">
        <div className="card-title">Daily Working Hours</div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} barGap={2}>
            <XAxis dataKey="date" {...axisProps} />
            <YAxis {...axisProps} unit="h" />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: "#e0e0e0" }}
              formatter={(value: number, name: string) => [
                `${value}h`,
                name,
              ]}
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
            />
            <Bar
              dataKey="productive"
              stackId="hours"
              fill="#22c55e"
              name="Productive"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="distracting"
              stackId="hours"
              fill="#ef4444"
              name="Distracting"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Productivity Trend - Line */}
      <div className="card">
        <div className="card-title">Productivity Trend</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <XAxis dataKey="date" {...axisProps} />
            <YAxis {...axisProps} unit="%" domain={[0, 100]} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: "#e0e0e0" }}
              formatter={(value: number) => [`${value}%`, "Productivity"]}
              cursor={{ stroke: "rgba(255,255,255,0.1)" }}
            />
            <Line
              type="monotone"
              dataKey="productivity"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: "#3b82f6", r: 4, strokeWidth: 0 }}
              activeDot={{ fill: "#3b82f6", r: 6, strokeWidth: 2, stroke: "#fff" }}
              name="Productivity %"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Daily Commits - Bar */}
      <div className="card">
        <div className="card-title">Daily Commits</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <XAxis dataKey="date" {...axisProps} />
            <YAxis {...axisProps} allowDecimals={false} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: "#e0e0e0" }}
              formatter={(value: number) => [value, "Commits"]}
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
            />
            <Bar
              dataKey="commits"
              fill="#a855f7"
              name="Commits"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Haftalik Performans Radari */}
      <div className="card">
        <div className="card-title">Haftalik Performans Radari</div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <RadarChart
            current={[75, 80, 60, 70, 85, 65]}
            previous={[65, 70, 55, 60, 75, 60]}
            labels={["Odaklanma", "Verimlilik", "Tutarlilik", "Commit", "Mola Uyumu", "Zaman Yonetimi"]}
          />
        </div>
      </div>

      {/* Stream Graph - Haftalik Proje Dagilimi */}
      {streamData.length > 0 && (
        <div className="card">
          <div className="card-title">Haftalik Aktivite Akisi</div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <StreamGraph data={streamData} />
          </div>
        </div>
      )}
    </div>
  );
}
