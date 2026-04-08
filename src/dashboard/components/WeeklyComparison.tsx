import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { WeeklyTrends, DayTrend } from "../../types";

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

const IconArrowUp = ({ color }: { color: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

const IconArrowDown = ({ color }: { color: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <polyline points="19 12 12 19 5 12" />
  </svg>
);

const IconMinus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

interface WeekStats {
  totalHours: number;
  productiveHours: number;
  commits: number;
  productivity: number;
  avgDailyHours: number;
}

function computeWeekStats(days: DayTrend[]): WeekStats {
  const totalMinutes = days.reduce((a, d) => a + d.total_minutes, 0);
  const productiveMinutes = days.reduce((a, d) => a + d.productive_minutes, 0);
  const commits = days.reduce((a, d) => a + d.commit_count, 0);
  const productivity =
    totalMinutes > 0 ? (productiveMinutes / totalMinutes) * 100 : 0;
  const activeDays = days.filter((d) => d.total_minutes > 0).length || 1;

  return {
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    productiveHours: Math.round((productiveMinutes / 60) * 10) / 10,
    commits,
    productivity: Math.round(productivity),
    avgDailyHours: Math.round((totalMinutes / 60 / activeDays) * 10) / 10,
  };
}

function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/* ------------------------------------------------------------------ */
/*  Metric Row                                                         */
/* ------------------------------------------------------------------ */

interface MetricRowProps {
  label: string;
  thisWeek: string;
  lastWeek: string;
  change: number;
  /** true = higher is better, false = lower is better */
  higherIsBetter: boolean;
}

function MetricRow({ label, thisWeek, lastWeek, change, higherIsBetter }: MetricRowProps) {
  const isPositive = higherIsBetter ? change > 0 : change < 0;
  const isNeutral = change === 0;
  const arrowColor = isNeutral
    ? "var(--text-muted)"
    : isPositive
      ? "var(--accent-green)"
      : "var(--accent-red)";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr 90px",
        alignItems: "center",
        padding: "10px 0",
        borderBottom: "1px solid var(--border)",
        fontSize: 13,
      }}
    >
      <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
        {label}
      </span>
      <span
        className="mono"
        style={{ fontWeight: 600, textAlign: "center" }}
      >
        {thisWeek}
      </span>
      <span
        className="mono"
        style={{ color: "var(--text-muted)", textAlign: "center" }}
      >
        {lastWeek}
      </span>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 4,
          color: arrowColor,
          fontWeight: 600,
          fontSize: 12,
        }}
      >
        {isNeutral ? (
          <IconMinus />
        ) : change > 0 ? (
          <IconArrowUp color={arrowColor} />
        ) : (
          <IconArrowDown color={arrowColor} />
        )}
        {isNeutral ? "-" : `${Math.abs(change)}%`}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function WeeklyComparison() {
  const [trends, setTrends] = useState<WeeklyTrends | null>(null);

  useEffect(() => {
    invoke<WeeklyTrends>("get_weekly_trends")
      .then(setTrends)
      .catch(console.error);
  }, []);

  if (!trends || trends.days.length < 7) {
    return (
      <div className="card">
        <div className="card-title">Haftalik Karsilastirma</div>
        <div
          style={{
            textAlign: "center",
            padding: "32px 20px",
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          Karsilastirma icin en az 2 haftalik veri gerekli.
        </div>
      </div>
    );
  }

  // Split into this week (last 7 days) and previous week (7 days before that)
  const allDays = trends.days;
  const thisWeekDays = allDays.slice(-7);
  const lastWeekDays = allDays.length >= 14 ? allDays.slice(-14, -7) : [];

  if (lastWeekDays.length === 0) {
    return (
      <div className="card">
        <div className="card-title">Haftalik Karsilastirma</div>
        <div
          style={{
            textAlign: "center",
            padding: "32px 20px",
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          Karsilastirma icin en az 2 haftalik veri gerekli.
        </div>
      </div>
    );
  }

  const tw = computeWeekStats(thisWeekDays);
  const lw = computeWeekStats(lastWeekDays);

  return (
    <div className="card">
      <div className="card-title">Haftalik Karsilastirma</div>

      {/* Column headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 90px",
          padding: "6px 0 10px",
          borderBottom: "1px solid var(--border)",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        <span>Metrik</span>
        <span style={{ textAlign: "center" }}>Bu Hafta</span>
        <span style={{ textAlign: "center" }}>Gecen Hafta</span>
        <span style={{ textAlign: "right" }}>Degisim</span>
      </div>

      <MetricRow
        label="Toplam Saat"
        thisWeek={`${tw.totalHours}s`}
        lastWeek={`${lw.totalHours}s`}
        change={percentChange(tw.totalHours, lw.totalHours)}
        higherIsBetter={true}
      />
      <MetricRow
        label="Uretken Saat"
        thisWeek={`${tw.productiveHours}s`}
        lastWeek={`${lw.productiveHours}s`}
        change={percentChange(tw.productiveHours, lw.productiveHours)}
        higherIsBetter={true}
      />
      <MetricRow
        label="Commit"
        thisWeek={`${tw.commits}`}
        lastWeek={`${lw.commits}`}
        change={percentChange(tw.commits, lw.commits)}
        higherIsBetter={true}
      />
      <MetricRow
        label="Verimlilik"
        thisWeek={`%${tw.productivity}`}
        lastWeek={`%${lw.productivity}`}
        change={percentChange(tw.productivity, lw.productivity)}
        higherIsBetter={true}
      />
      <MetricRow
        label="Ort. Gunluk"
        thisWeek={`${tw.avgDailyHours}s`}
        lastWeek={`${lw.avgDailyHours}s`}
        change={percentChange(tw.avgDailyHours, lw.avgDailyHours)}
        higherIsBetter={true}
      />
    </div>
  );
}
