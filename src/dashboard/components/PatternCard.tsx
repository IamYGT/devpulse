/* ------------------------------------------------------------------ */
/*  PatternCard - Displays a detected work pattern                     */
/* ------------------------------------------------------------------ */

interface WorkPattern {
  pattern_type: string;
  description: string;
  confidence: number;
  data: Record<string, unknown>;
}

interface PatternCardProps {
  pattern: WorkPattern;
  onCreateRule: () => void;
}

/* ------------------------------------------------------------------ */
/*  Pattern Type Configs                                               */
/* ------------------------------------------------------------------ */

interface PatternStyle {
  icon: React.ReactNode;
  color: string;
  label: string;
}

const IconClock = ({ color }: { color: string }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconBarChart = ({ color }: { color: string }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </svg>
);

const IconZap = ({ color }: { color: string }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const IconCalendar = ({ color }: { color: string }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const IconTarget = ({ color }: { color: string }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

function getPatternStyle(type: string): PatternStyle {
  switch (type) {
    case "productive_hours":
      return {
        icon: <IconClock color="var(--accent-blue)" />,
        color: "var(--accent-blue)",
        label: "Verimli Saatler",
      };
    case "distraction_triggers":
      return {
        icon: <IconZap color="var(--accent-orange)" />,
        color: "var(--accent-orange)",
        label: "Dikkat Dagiticilar",
      };
    case "context_switching":
      return {
        icon: <IconBarChart color="#8b5cf6" />,
        color: "#8b5cf6",
        label: "Uygulama Degisimi",
      };
    case "weekly_rhythm":
      return {
        icon: <IconCalendar color="var(--accent-green)" />,
        color: "var(--accent-green)",
        label: "Haftalik Ritim",
      };
    case "session_sweet_spot":
      return {
        icon: <IconTarget color="var(--accent-red)" />,
        color: "var(--accent-red)",
        label: "Optimal Seans Suresi",
      };
    default:
      return {
        icon: <IconBarChart color="var(--text-muted)" />,
        color: "var(--text-muted)",
        label: "Pattern",
      };
  }
}

/* ------------------------------------------------------------------ */
/*  Inline Mini Bar Chart                                              */
/* ------------------------------------------------------------------ */

function MiniBarChart({
  data,
  color,
}: {
  data: { label: string; value: number }[];
  color: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 2,
        height: 32,
        marginTop: 8,
      }}
    >
      {data.map((d, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 24,
              height: Math.max(2, (d.value / max) * 28),
              background: color,
              borderRadius: 2,
              opacity: 0.7,
              transition: "height 0.3s ease",
            }}
          />
          <span
            style={{
              fontSize: 8,
              color: "var(--text-muted)",
              lineHeight: 1,
            }}
          >
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Data Extractors for Mini Charts                                    */
/* ------------------------------------------------------------------ */

function extractChartData(
  pattern: WorkPattern
): { label: string; value: number }[] | null {
  const data = pattern.data;

  switch (pattern.pattern_type) {
    case "weekly_rhythm": {
      const breakdown = data.daily_breakdown as
        | { day: string; avg_productive_min: number }[]
        | undefined;
      if (breakdown) {
        return breakdown.map((d) => ({
          label: (d.day as string).substring(0, 2),
          value: d.avg_productive_min,
        }));
      }
      return null;
    }

    case "distraction_triggers": {
      const distractors = data.top_distractors as
        | { app: string; times_triggered: number }[]
        | undefined;
      if (distractors) {
        return distractors.slice(0, 5).map((d) => ({
          label: (d.app as string).substring(0, 4),
          value: d.times_triggered,
        }));
      }
      return null;
    }

    case "context_switching": {
      const hourly = data.hourly_averages as
        | { hour: number; avg_switches: number }[]
        | undefined;
      if (hourly) {
        return hourly.slice(0, 10).map((d) => ({
          label: `${d.hour}`,
          value: d.avg_switches,
        }));
      }
      return null;
    }

    case "session_sweet_spot": {
      const buckets = data.bucket_breakdown as
        | { range: string; session_count: number }[]
        | undefined;
      if (buckets) {
        return buckets.map((d) => ({
          label: (d.range as string).replace("dk", ""),
          value: d.session_count,
        }));
      }
      return null;
    }

    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PatternCard({
  pattern,
  onCreateRule,
}: PatternCardProps) {
  const style = getPatternStyle(pattern.pattern_type);
  const confidencePct = Math.round(pattern.confidence * 100);
  const chartData = extractChartData(pattern);

  return (
    <div
      className="card"
      style={{
        padding: "16px 18px",
        borderLeft: `3px solid ${style.color}`,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <span style={{ flexShrink: 0, display: "flex" }}>{style.icon}</span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: style.color,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {style.label}
          </div>
        </div>

        {/* Confidence bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 60,
              height: 6,
              borderRadius: 3,
              background: "var(--border)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${confidencePct}%`,
                height: "100%",
                borderRadius: 3,
                background:
                  confidencePct >= 70
                    ? "var(--accent-green)"
                    : confidencePct >= 50
                      ? "var(--accent-orange)"
                      : "var(--text-muted)",
                transition: "width 0.5s ease",
              }}
            />
          </div>
          <span
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              minWidth: 28,
            }}
          >
            %{confidencePct}
          </span>
        </div>
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.5,
          color: "var(--text-secondary)",
          marginBottom: chartData ? 0 : 12,
        }}
      >
        {pattern.description}
      </div>

      {/* Mini chart */}
      {chartData && (
        <div style={{ marginBottom: 12 }}>
          <MiniBarChart data={chartData} color={style.color} />
        </div>
      )}

      {/* Action button */}
      <button
        onClick={onCreateRule}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          borderRadius: "var(--radius)",
          border: `1px solid ${style.color}40`,
          background: `${style.color}10`,
          color: style.color,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = `${style.color}20`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = `${style.color}10`;
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Bu pattern'e gore kural olustur
      </button>
    </div>
  );
}
