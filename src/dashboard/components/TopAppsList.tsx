import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface AppUsage {
  process_name: string;
  display_name: string | null;
  total_minutes: number;
  category: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  productive: "#22c55e",
  distracting: "#ef4444",
  neutral: "#555577",
};

function getCategoryDotColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? "#555577";
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}dk`;
  return m > 0 ? `${h}s ${m}dk` : `${h}s`;
}

export default function TopAppsList() {
  const [apps, setApps] = useState<AppUsage[]>([]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    invoke<AppUsage[]>("get_top_apps", { date: today, limit: 10 })
      .then(setApps)
      .catch(() => setApps([]));
  }, []);

  const maxMinutes = apps.length > 0 ? apps[0].total_minutes : 1;

  if (apps.length === 0) {
    return (
      <div style={{ color: "#555577", fontSize: 13, padding: "12px 0" }}>
        Henuz uygulama verisi yok
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {apps.map((app) => {
        const barWidth =
          maxMinutes > 0
            ? Math.max((app.total_minutes / maxMinutes) * 100, 2)
            : 0;
        const label = app.display_name || app.process_name;

        return (
          <div
            key={app.process_name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "5px 0",
            }}
          >
            {/* Category dot */}
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: getCategoryDotColor(app.category),
                flexShrink: 0,
              }}
            />

            {/* App name */}
            <div
              style={{
                flex: "0 0 140px",
                fontSize: 13,
                color: "#e8e8f0",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={label}
            >
              {label}
            </div>

            {/* Progress bar */}
            <div
              style={{
                flex: 1,
                height: 6,
                backgroundColor: "#161638",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${barWidth}%`,
                  height: "100%",
                  backgroundColor: getCategoryDotColor(app.category),
                  borderRadius: 3,
                  transition: "width 0.3s ease",
                }}
              />
            </div>

            {/* Time */}
            <div
              style={{
                flex: "0 0 72px",
                fontSize: 12,
                color: "#8888aa",
                textAlign: "right",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {formatTime(app.total_minutes)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
