import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PieChart, Pie, Cell, Legend, ResponsiveContainer } from "recharts";

interface CategoryBreakdown {
  category: string;
  total_minutes: number;
  percentage: number;
}

const CATEGORY_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  productive: { label: "Uretken", color: "#22c55e" },
  distracting: { label: "Dikkat Dagitici", color: "#ef4444" },
  neutral: { label: "Notr", color: "#555577" },
};

function getCategoryLabel(cat: string): string {
  return CATEGORY_CONFIG[cat]?.label ?? cat;
}

function getCategoryColor(cat: string): string {
  return CATEGORY_CONFIG[cat]?.color ?? "#555577";
}

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}dk`;
  return m > 0 ? `${h}s ${m}dk` : `${h}s`;
}

export default function CategoryDonutChart() {
  const [data, setData] = useState<CategoryBreakdown[]>([]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    invoke<CategoryBreakdown[]>("get_category_breakdown", { date: today })
      .then(setData)
      .catch(() => setData([]));
  }, []);

  const totalMinutes = data.reduce((sum, d) => sum + d.total_minutes, 0);

  const chartData = data.map((d) => ({
    name: getCategoryLabel(d.category),
    value: d.total_minutes,
    color: getCategoryColor(d.category),
  }));

  // Show placeholder if no data
  if (chartData.length === 0) {
    chartData.push({
      name: "Veri yok",
      value: 1,
      color: "#161638",
    });
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 280,
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="45%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value: string) => (
              <span style={{ color: "#e8e8f0", fontSize: 12 }}>
                {value}
              </span>
            )}
            iconType="circle"
            iconSize={8}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Center text */}
      <div
        style={{
          position: "absolute",
          top: "40%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#e8e8f0",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {formatHours(totalMinutes)}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#8888aa",
            marginTop: 2,
          }}
        >
          bugun toplam
        </div>
      </div>
    </div>
  );
}
