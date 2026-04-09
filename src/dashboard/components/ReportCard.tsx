import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ReportMetrics {
  schedule_adherence: number;
  productivity_score: number;
  break_compliance: number;
  commit_frequency: number;
  focus_score: number;
  overtime_penalty: number;
}

interface DailyReportCard {
  date: string;
  grade: string;
  score: number;
  metrics: ReportMetrics;
  highlights: string[];
  improvements: string[];
}

interface ReportCardProps {
  date?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function gradeStyle(grade: string): { color: string; bg: string } {
  switch (grade) {
    case "A":
      return { color: "#22c55e", bg: "rgba(34, 197, 94, 0.12)" };
    case "B":
      return { color: "#6366f1", bg: "rgba(99, 102, 241, 0.12)" };
    case "C":
      return { color: "#eab308", bg: "rgba(234, 179, 8, 0.12)" };
    case "D":
      return { color: "#f97316", bg: "rgba(249, 115, 22, 0.12)" };
    default:
      return { color: "#ef4444", bg: "rgba(239, 68, 68, 0.12)" };
  }
}

function metricBarColor(value: number): string {
  if (value >= 80) return "var(--accent-green)";
  if (value >= 60) return "var(--accent-blue)";
  if (value >= 40) return "var(--accent-yellow)";
  if (value >= 20) return "var(--accent-orange)";
  return "var(--accent-red)";
}

const METRIC_LABELS: { key: keyof ReportMetrics; label: string }[] = [
  { key: "productivity_score", label: "Verimlilik" },
  { key: "schedule_adherence", label: "Plan Uyumu" },
  { key: "focus_score", label: "Odaklanma" },
  { key: "commit_frequency", label: "Commit Sikligi" },
  { key: "break_compliance", label: "Mola Uyumu" },
  { key: "overtime_penalty", label: "Mesai Dengesi" },
];

/* ------------------------------------------------------------------ */
/*  SVG Icons                                                          */
/* ------------------------------------------------------------------ */

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconArrowUp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

const IconCalendar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Progress Ring Component                                            */
/* ------------------------------------------------------------------ */

function ProgressRing({
  value,
  size = 120,
  stroke = 8,
  color,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ReportCard({ date }: ReportCardProps) {
  const [report, setReport] = useState<DailyReportCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [compareDate, setCompareDate] = useState<string | null>(null);
  const [compareReport, setCompareReport] = useState<DailyReportCard | null>(null);

  const targetDate =
    date || new Date().toISOString().split("T")[0];

  useEffect(() => {
    setLoading(true);
    invoke<DailyReportCard>("get_daily_report_card", { date: targetDate })
      .then(setReport)
      .catch((err) => console.error("Failed to fetch report card:", err))
      .finally(() => setLoading(false));
  }, [targetDate]);

  // Load comparison report
  useEffect(() => {
    if (!compareDate) {
      setCompareReport(null);
      return;
    }
    invoke<DailyReportCard>("get_daily_report_card", { date: compareDate })
      .then(setCompareReport)
      .catch((err) => console.error("Failed to fetch compare report:", err));
  }, [compareDate]);

  if (loading) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 24 }}>
        <span style={{ color: "var(--text-muted)" }}>Rapor hazirlaniyor...</span>
      </div>
    );
  }

  if (!report) return null;

  const gs = gradeStyle(report.grade);

  // Calculate previous day for comparison
  const prevDate = (() => {
    const d = new Date(targetDate);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  })();

  return (
    <div className="card">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div className="card-title" style={{ margin: 0 }}>
          Gunluk Karne
        </div>
        <button
          onClick={() =>
            setCompareDate(compareDate ? null : prevDate)
          }
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: compareDate ? "rgba(99, 102, 241, 0.12)" : "none",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "4px 12px",
            fontSize: 12,
            color: compareDate ? "var(--accent-blue)" : "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <IconCalendar />
          {compareDate ? "Karsilastirmayi Kapat" : "Karsilastir"}
        </button>
      </div>

      {/* Grade & Score */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
          marginBottom: 24,
        }}
      >
        {/* Grade Letter */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 16,
            background: gs.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
            fontWeight: 800,
            color: gs.color,
          }}
        >
          {report.grade}
        </div>

        {/* Score Ring */}
        <div style={{ position: "relative", display: "inline-flex" }}>
          <ProgressRing value={report.score} color={gs.color} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              transform: "rotate(0deg)",
            }}
          >
            <span style={{ fontSize: 28, fontWeight: 700, color: gs.color }}>
              {report.score.toFixed(0)}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>puan</span>
          </div>
        </div>

        {/* Compare grade if active */}
        {compareReport && (
          <div style={{ textAlign: "center", opacity: 0.7 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                background: gradeStyle(compareReport.grade).bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
                fontWeight: 700,
                color: gradeStyle(compareReport.grade).color,
                margin: "0 auto 4px",
              }}
            >
              {compareReport.grade}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Onceki ({compareReport.score.toFixed(0)})
            </div>
          </div>
        )}
      </div>

      {/* Metric Bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {METRIC_LABELS.map(({ key, label }) => {
          const value = report.metrics[key];
          const compareValue = compareReport?.metrics[key];
          const barColor = metricBarColor(value);

          return (
            <div key={key}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                <span style={{ fontWeight: 600, color: barColor }}>
                  %{value.toFixed(0)}
                  {compareValue !== undefined && (
                    <span
                      style={{
                        fontSize: 10,
                        marginLeft: 6,
                        color:
                          value >= compareValue
                            ? "var(--accent-green)"
                            : "var(--accent-red)",
                      }}
                    >
                      {value >= compareValue ? "+" : ""}
                      {(value - compareValue).toFixed(0)}
                    </span>
                  )}
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: "var(--bg-secondary)",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(value, 100)}%`,
                    borderRadius: 3,
                    background: barColor,
                    transition: "width 0.6s ease",
                  }}
                />
                {compareValue !== undefined && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: `${Math.min(compareValue, 100)}%`,
                      width: 2,
                      height: "100%",
                      background: "var(--text-muted)",
                      opacity: 0.5,
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Highlights */}
      {report.highlights.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--accent-green)",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Basarilar
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {report.highlights.map((h, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: "var(--text-secondary)",
                }}
              >
                <IconCheck />
                {h}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Improvements */}
      {report.improvements.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--accent-orange)",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Gelistirilecekler
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {report.improvements.map((imp, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: "var(--text-secondary)",
                }}
              >
                <IconArrowUp />
                {imp}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
