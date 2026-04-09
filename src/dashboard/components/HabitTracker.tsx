import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DayData {
  date: string;
  status: "good" | "partial" | "bad" | "none";
  productiveMinutes: number;
}

interface DailyReportCard {
  date: string;
  grade: string;
  score: number;
  metrics: {
    schedule_adherence: number;
    productivity_score: number;
    break_compliance: number;
    commit_frequency: number;
    focus_score: number;
    overtime_penalty: number;
  };
  highlights: string[];
  improvements: string[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getLastNDays(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

function statusColor(status: string): string {
  switch (status) {
    case "good":
      return "var(--accent-green)";
    case "partial":
      return "var(--accent-yellow)";
    case "bad":
      return "var(--accent-red)";
    default:
      return "var(--bg-secondary)";
  }
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const labels = ["Pz", "Pt", "Sa", "Ca", "Pe", "Cu", "Ct"];
  return labels[d.getDay()];
}

function shortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/* ------------------------------------------------------------------ */
/*  SVG Icons                                                          */
/* ------------------------------------------------------------------ */

const IconFire = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </svg>
);

const IconTrophy = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-yellow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function HabitTracker() {
  const [dayDataMap, setDayDataMap] = useState<Record<string, DayData>>({});
  const [loading, setLoading] = useState(true);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const last30Days = useMemo(() => getLastNDays(30), []);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const map: Record<string, DayData> = {};

      // Fetch report cards for each day in parallel batches
      const batchSize = 10;
      for (let i = 0; i < last30Days.length; i += batchSize) {
        const batch = last30Days.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map((date) =>
            invoke<DailyReportCard>("get_daily_report_card", { date })
          )
        );

        if (cancelled) return;

        results.forEach((result, idx) => {
          const date = batch[idx];
          if (result.status === "fulfilled" && result.value) {
            const rc = result.value;
            let status: DayData["status"] = "none";
            if (rc.score >= 70) status = "good";
            else if (rc.score >= 40) status = "partial";
            else if (rc.score > 0) status = "bad";

            map[date] = {
              date,
              status,
              productiveMinutes: Math.round(
                (rc.metrics.productivity_score / 100) * 480
              ),
            };
          } else {
            map[date] = {
              date,
              status: "none",
              productiveMinutes: 0,
            };
          }
        });
      }

      if (!cancelled) {
        setDayDataMap(map);
        setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [last30Days]);

  // Calculate streaks
  const { currentStreak, longestStreak } = useMemo(() => {
    let current = 0;
    let longest = 0;
    let tempStreak = 0;

    // Go from most recent to oldest for current streak
    for (let i = last30Days.length - 1; i >= 0; i--) {
      const day = dayDataMap[last30Days[i]];
      if (day && (day.status === "good" || day.status === "partial")) {
        current++;
      } else {
        break;
      }
    }

    // Calculate longest streak
    for (let i = 0; i < last30Days.length; i++) {
      const day = dayDataMap[last30Days[i]];
      if (day && (day.status === "good" || day.status === "partial")) {
        tempStreak++;
        if (tempStreak > longest) longest = tempStreak;
      } else {
        tempStreak = 0;
      }
    }

    return { currentStreak: current, longestStreak: longest };
  }, [dayDataMap, last30Days]);

  if (loading) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <div className="card-title">Aliskanlik Takibi</div>
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Yukleniyor...
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div className="card-title" style={{ margin: 0 }}>
          Aliskanlik Takibi
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {/* Current streak */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--accent-orange)",
            }}
          >
            <IconFire />
            {currentStreak} gun
          </div>
          {/* Longest streak */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              color: "var(--text-muted)",
            }}
            title="En uzun seri"
          >
            <IconTrophy />
            Rekor: {longestStreak}
          </div>
        </div>
      </div>

      {/* Grid of 30 days */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(10, 1fr)",
          gap: 4,
        }}
      >
        {last30Days.map((date) => {
          const day = dayDataMap[date] || { status: "none", productiveMinutes: 0 };
          const isToday = date === new Date().toISOString().split("T")[0];
          const isHovered = hoveredDay === date;

          return (
            <div
              key={date}
              onMouseEnter={() => setHoveredDay(date)}
              onMouseLeave={() => setHoveredDay(null)}
              style={{
                position: "relative",
                aspectRatio: "1",
                borderRadius: 4,
                background: statusColor(day.status),
                opacity: day.status === "none" ? 0.3 : 0.8,
                border: isToday
                  ? "2px solid var(--text-primary)"
                  : "1px solid transparent",
                cursor: "pointer",
                transition: "opacity 0.15s ease, transform 0.15s ease",
                transform: isHovered ? "scale(1.15)" : "scale(1)",
              }}
            >
              {/* Tooltip on hover */}
              {isHovered && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 6px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    padding: "4px 8px",
                    borderRadius: 4,
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border)",
                    fontSize: 11,
                    whiteSpace: "nowrap",
                    zIndex: 10,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    color: "var(--text-primary)",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {shortDate(date)} {dayLabel(date)}
                  </div>
                  {day.status !== "none" && (
                    <div style={{ color: "var(--text-muted)" }}>
                      ~{day.productiveMinutes}dk uretken
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 10,
          justifyContent: "center",
        }}
      >
        {[
          { label: "Iyi", color: "var(--accent-green)" },
          { label: "Kismi", color: "var(--accent-yellow)" },
          { label: "Dusuk", color: "var(--accent-red)" },
          { label: "Veri yok", color: "var(--bg-secondary)" },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10,
              color: "var(--text-muted)",
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: item.color,
                opacity: item.label === "Veri yok" ? 0.3 : 0.8,
              }}
            />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
