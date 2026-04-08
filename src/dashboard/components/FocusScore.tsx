import { useMemo } from "react";
import type { TimelineEntry } from "../../types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FocusScoreProps {
  timeline: TimelineEntry[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getScoreColor(score: number): string {
  if (score >= 80) return "var(--accent-green)";
  if (score >= 50) return "var(--accent-yellow)";
  if (score >= 30) return "var(--accent-orange)";
  return "var(--accent-red)";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Odakli";
  if (score >= 50) return "Orta";
  if (score >= 30) return "Dagnik";
  return "Cok Dagnik";
}

function computeFocusData(timeline: TimelineEntry[]): {
  score: number;
  avgFocusMinutes: number;
  switchesPerHour: number;
} {
  if (timeline.length < 2) {
    return { score: 100, avgFocusMinutes: 0, switchesPerHour: 0 };
  }

  // Count context switches (when process_name changes between consecutive entries)
  let switches = 0;
  for (let i = 1; i < timeline.length; i++) {
    if (
      timeline[i].process_name !== timeline[i - 1].process_name &&
      !timeline[i].is_idle &&
      !timeline[i - 1].is_idle
    ) {
      switches++;
    }
  }

  // Total active time in hours
  const totalActiveSeconds = timeline
    .filter((e) => !e.is_idle)
    .reduce((a, e) => a + e.duration_seconds, 0);
  const totalActiveHours = totalActiveSeconds / 3600;

  if (totalActiveHours < 0.01) {
    return { score: 100, avgFocusMinutes: 0, switchesPerHour: 0 };
  }

  const switchesPerHour = switches / totalActiveHours;

  // Average time per window before switching (in minutes)
  const avgFocusSeconds =
    switches > 0 ? totalActiveSeconds / (switches + 1) : totalActiveSeconds;
  const avgFocusMinutes = Math.round((avgFocusSeconds / 60) * 10) / 10;

  // Score: 100 at 0 switches/hr, decreasing.
  // ~60 switches/hr = score 0
  const score = Math.max(0, Math.min(100, Math.round(100 - switchesPerHour * 1.67)));

  return {
    score,
    avgFocusMinutes,
    switchesPerHour: Math.round(switchesPerHour * 10) / 10,
  };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function FocusScore({ timeline }: FocusScoreProps) {
  const { score, avgFocusMinutes, switchesPerHour } = useMemo(
    () => computeFocusData(timeline),
    [timeline],
  );

  const color = getScoreColor(score);
  const label = getScoreLabel(score);

  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div className="card-title">Odaklanma Skoru</div>

      {/* Score number */}
      <div
        className="mono"
        style={{
          fontSize: 48,
          fontWeight: 700,
          color,
          lineHeight: 1,
          marginTop: 8,
          transition: "color 0.3s ease",
        }}
      >
        {score}
      </div>

      {/* Label */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color,
          marginTop: 6,
          textTransform: "uppercase",
          letterSpacing: 0.8,
        }}
      >
        {label}
      </div>

      {/* Score bar */}
      <div
        style={{
          width: "80%",
          height: 4,
          background: "var(--bg-primary)",
          borderRadius: 2,
          margin: "14px auto 16px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${score}%`,
            height: "100%",
            background: color,
            borderRadius: 2,
            transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </div>

      {/* Stats */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 24,
          fontSize: 11,
          color: "var(--text-muted)",
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
            {avgFocusMinutes}dk
          </div>
          Ort. Odaklanma
        </div>
        <div
          style={{
            width: 1,
            background: "var(--border)",
            alignSelf: "stretch",
          }}
        />
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
            {switchesPerHour}/s
          </div>
          Gecis/Saat
        </div>
      </div>
    </div>
  );
}
