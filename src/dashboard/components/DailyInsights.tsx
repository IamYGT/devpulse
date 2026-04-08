import { useState, useMemo } from "react";
import type { DailySummary, TimelineEntry, TrackerState } from "../../types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Insight {
  type: "tip" | "stat" | "achievement" | "warning";
  message: string;
}

interface DailyInsightsProps {
  summaries: DailySummary[];
  timeline: TimelineEntry[];
  state: TrackerState | null;
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

const IconLightbulb = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-yellow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
  </svg>
);

const IconChart = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const IconTrophy = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

const IconWarning = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Insight generation                                                 */
/* ------------------------------------------------------------------ */

function generateInsights(
  summaries: DailySummary[],
  timeline: TimelineEntry[],
  state: TrackerState | null,
): Insight[] {
  const insights: Insight[] = [];

  const totalMinutes = summaries.reduce((a, s) => a + s.total_minutes, 0);
  const productiveMinutes = summaries.reduce((a, s) => a + s.productive_minutes, 0);
  const distractingMinutes = summaries.reduce((a, s) => a + s.distracting_minutes, 0);
  const totalCommits = summaries.reduce((a, s) => a + s.commit_count, 0);
  const productivity = totalMinutes > 0 ? (productiveMinutes / totalMinutes) * 100 : 0;

  // High productivity
  if (state && state.productivity_percentage >= 80) {
    insights.push({
      type: "achievement",
      message: `Verimlilik %${state.productivity_percentage.toFixed(0)} - Muhtesem!`,
    });
  }

  // Too much context switching
  const uniqueProjects = new Set(
    summaries.map((s) => s.project_name).filter(Boolean),
  );
  if (uniqueProjects.size > 4) {
    insights.push({
      type: "warning",
      message: `Bugun ${uniqueProjects.size} farkli projede calistin. Odaklanmayi dene.`,
    });
  }

  // Distracting time alert
  if (distractingMinutes > 30) {
    insights.push({
      type: "warning",
      message: `Dikkat dagitici uygulamalarda ${Math.round(distractingMinutes)}dk gecirdin.`,
    });
  }

  // Long session without break
  if (state && state.elapsed_seconds > 5400 && !state.is_idle) {
    insights.push({
      type: "tip",
      message: `${Math.floor(state.elapsed_seconds / 60)}dk'dir ara vermeden calisiyorsun. Mola zamani!`,
    });
  }

  // Productive milestone
  const productiveHours = Math.floor(productiveMinutes / 60);
  if (productiveHours >= 1) {
    insights.push({
      type: "stat",
      message: `Bugun ${productiveHours} saat uretken calistin.`,
    });
  }

  // No commits warning
  if (totalCommits === 0 && productiveMinutes > 120) {
    insights.push({
      type: "tip",
      message: `2 saatten fazla calistin ama henuz commit yok. Degisiklikleri kaydetmeyi unutma!`,
    });
  }

  // Most productive hour from timeline
  if (timeline.length > 5) {
    const hourBuckets: Record<number, number> = {};
    for (const entry of timeline) {
      if (entry.category === "productive") {
        const hour = new Date(entry.timestamp).getHours();
        hourBuckets[hour] = (hourBuckets[hour] || 0) + entry.duration_seconds;
      }
    }
    const bestHour = Object.entries(hourBuckets).sort(
      ([, a], [, b]) => b - a,
    )[0];
    if (bestHour && Number(bestHour[1]) > 300) {
      const h = Number(bestHour[0]);
      insights.push({
        type: "stat",
        message: `Bugun en verimli saatin ${h.toString().padStart(2, "0")}:00-${(h + 1).toString().padStart(2, "0")}:00 arasi oldu.`,
      });
    }
  }

  // Idle detection
  if (state && state.is_idle && state.elapsed_seconds > 300) {
    insights.push({
      type: "tip",
      message: `${Math.floor(state.elapsed_seconds / 60)}dk'dir bosta gorunuyorsun. Mola mi aliyorsun?`,
    });
  }

  // Good commit ratio
  if (totalCommits >= 5) {
    insights.push({
      type: "achievement",
      message: `Bugun ${totalCommits} commit attin, harika tempo!`,
    });
  }

  // Low productivity alert
  if (productivity > 0 && productivity < 30 && totalMinutes > 60) {
    insights.push({
      type: "warning",
      message: `Verimlilik %${productivity.toFixed(0)} - dikkat dagitici uygulamalari kapatmayi dene.`,
    });
  }

  return insights;
}

/* ------------------------------------------------------------------ */
/*  Styling helpers                                                    */
/* ------------------------------------------------------------------ */

const typeConfig: Record<
  Insight["type"],
  { icon: React.ReactNode; borderColor: string; bgColor: string; label: string }
> = {
  tip: {
    icon: <IconLightbulb />,
    borderColor: "var(--accent-yellow)",
    bgColor: "rgba(234, 179, 8, 0.08)",
    label: "Oneri",
  },
  stat: {
    icon: <IconChart />,
    borderColor: "var(--accent-blue)",
    bgColor: "rgba(99, 102, 241, 0.08)",
    label: "Istatistik",
  },
  achievement: {
    icon: <IconTrophy />,
    borderColor: "var(--accent-green)",
    bgColor: "rgba(34, 197, 94, 0.08)",
    label: "Basari",
  },
  warning: {
    icon: <IconWarning />,
    borderColor: "var(--accent-orange)",
    bgColor: "rgba(249, 115, 22, 0.08)",
    label: "Uyari",
  },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DailyInsights({ summaries, timeline, state }: DailyInsightsProps) {
  const [expanded, setExpanded] = useState(false);

  const insights = useMemo(
    () => generateInsights(summaries, timeline, state),
    [summaries, timeline, state],
  );

  if (insights.length === 0) {
    return null;
  }

  const visibleInsights = expanded ? insights : insights.slice(0, 5);
  const hasMore = insights.length > 5;

  return (
    <div className="card">
      <div className="card-title">Gunun Analizleri</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visibleInsights.map((insight, i) => {
          const config = typeConfig[insight.type];
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                background: config.bgColor,
                borderLeft: `3px solid ${config.borderColor}`,
                borderRadius: "0 var(--radius) var(--radius) 0",
                transition: "background 0.2s ease",
              }}
            >
              <span style={{ flexShrink: 0, display: "flex" }}>
                {config.icon}
              </span>
              <span style={{ flex: 1, fontSize: 13, lineHeight: 1.4 }}>
                {insight.message}
              </span>
              <span
                style={{
                  flexShrink: 0,
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 100,
                  background: "rgba(255,255,255,0.06)",
                  color: config.borderColor,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {config.label}
              </span>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            marginTop: 10,
            background: "none",
            border: "none",
            color: "var(--accent-blue)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            padding: "4px 0",
          }}
        >
          {expanded
            ? "Daha az goster"
            : `Daha fazla goster (${insights.length - 5})`}
        </button>
      )}
    </div>
  );
}
