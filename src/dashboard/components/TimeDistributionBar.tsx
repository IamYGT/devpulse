import { useState, useMemo } from "react";

interface TimeDistributionBarProps {
  productive: number;   // minutes
  distracting: number;  // minutes
  idle: number;         // minutes
  neutral: number;      // minutes
}

interface Segment {
  key: string;
  label: string;
  minutes: number;
  color: string;
  percentage: number;
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}dk`;
  return m > 0 ? `${h}s ${m}dk` : `${h}s`;
}

export default function TimeDistributionBar({
  productive,
  distracting,
  idle,
  neutral,
}: TimeDistributionBarProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const total = productive + distracting + idle + neutral;

  const segments: Segment[] = useMemo(() => {
    if (total === 0) return [];
    return [
      {
        key: "productive",
        label: "Uretken",
        minutes: productive,
        color: "var(--accent-green)",
        percentage: (productive / total) * 100,
      },
      {
        key: "distracting",
        label: "Dikkat Dagitici",
        minutes: distracting,
        color: "var(--accent-red)",
        percentage: (distracting / total) * 100,
      },
      {
        key: "idle",
        label: "Bosta",
        minutes: idle,
        color: "var(--accent-yellow)",
        percentage: (idle / total) * 100,
      },
      {
        key: "neutral",
        label: "Notr",
        minutes: neutral,
        color: "var(--text-muted)",
        percentage: (neutral / total) * 100,
      },
    ].filter((s) => s.minutes > 0);
  }, [productive, distracting, idle, neutral, total]);

  if (total === 0) {
    return (
      <div
        style={{
          height: 24,
          borderRadius: 6,
          background: "var(--bg-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          color: "var(--text-muted)",
        }}
      >
        Henuz veri yok
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        position: "relative",
      }}
    >
      {/* Stacked bar */}
      <div
        style={{
          flex: 1,
          height: 24,
          borderRadius: 6,
          overflow: "hidden",
          display: "flex",
          background: "var(--bg-primary)",
          gap: 1,
        }}
      >
        {segments.map((seg) => (
          <div
            key={seg.key}
            style={{
              width: `${seg.percentage}%`,
              height: "100%",
              background: seg.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "filter 0.2s ease, opacity 0.2s ease",
              filter:
                hoveredKey && hoveredKey !== seg.key
                  ? "brightness(0.6)"
                  : "none",
              position: "relative",
            }}
            onMouseEnter={(e) => {
              setHoveredKey(seg.key);
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltipPos({
                x: rect.left + rect.width / 2,
                y: rect.top,
              });
            }}
            onMouseLeave={() => setHoveredKey(null)}
          >
            {/* Show percentage label inside segment if wide enough */}
            {seg.percentage >= 12 && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: seg.key === "idle" ? "#000" : "#fff",
                  letterSpacing: 0.3,
                  userSelect: "none",
                }}
              >
                %{seg.percentage.toFixed(0)}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Total time label */}
      <div
        style={{
          flexShrink: 0,
          fontSize: 12,
          fontFamily: "'JetBrains Mono', monospace",
          color: "var(--text-secondary)",
          fontWeight: 600,
        }}
      >
        {formatTime(total)}
      </div>

      {/* Hover tooltip (portal-free, positioned fixed) */}
      {hoveredKey && (
        <div
          style={{
            position: "fixed",
            left: tooltipPos.x,
            top: tooltipPos.y - 8,
            transform: "translate(-50%, -100%)",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "6px 10px",
            fontSize: 11,
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            zIndex: 1000,
            pointerEvents: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}
        >
          {(() => {
            const seg = segments.find((s) => s.key === hoveredKey);
            if (!seg) return null;
            return (
              <>
                <span style={{ fontWeight: 600 }}>{seg.label}</span>
                <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>
                  {formatTime(seg.minutes)} (%{seg.percentage.toFixed(1)})
                </span>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
