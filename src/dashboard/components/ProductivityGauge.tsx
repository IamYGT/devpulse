import { useMemo } from "react";

interface ProductivityGaugeProps {
  value: number; // 0-100
}

function getGaugeColor(v: number): string {
  if (v <= 30) return "var(--accent-red)";
  if (v <= 60) return "var(--accent-yellow)";
  return "var(--accent-green)";
}

function getGradientId(v: number): string {
  if (v <= 30) return "gauge-grad-red";
  if (v <= 60) return "gauge-grad-yellow";
  return "gauge-grad-green";
}

export default function ProductivityGauge({ value }: ProductivityGaugeProps) {
  const clamped = Math.max(0, Math.min(100, value));

  const { dashArray, dashOffset, color } = useMemo(() => {
    // Semicircle: radius=80, center=(100,90)
    // Arc length for 180 degrees = pi * r = 251.327
    const radius = 80;
    const circumference = Math.PI * radius; // ~251.33
    const offset = circumference - (clamped / 100) * circumference;
    return {
      dashArray: circumference,
      dashOffset: offset,
      color: getGaugeColor(clamped),
    };
  }, [clamped]);

  return (
    <div
      style={{
        width: 200,
        height: 120,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
      }}
    >
      <svg width="200" height="110" viewBox="0 0 200 110">
        <defs>
          {/* Red gradient */}
          <linearGradient id="gauge-grad-red" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          {/* Yellow gradient */}
          <linearGradient id="gauge-grad-yellow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ca8a04" />
            <stop offset="100%" stopColor="#eab308" />
          </linearGradient>
          {/* Green gradient */}
          <linearGradient id="gauge-grad-green" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#16a34a" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>

        {/* Background arc */}
        <path
          d="M 20 90 A 80 80 0 0 1 180 90"
          fill="none"
          stroke="var(--bg-primary)"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Foreground arc */}
        <path
          d="M 20 90 A 80 80 0 0 1 180 90"
          fill="none"
          stroke={`url(#${getGradientId(clamped)})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={dashArray}
          strokeDashoffset={dashOffset}
          style={{
            transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />

        {/* Center percentage text */}
        <text
          x="100"
          y="80"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          fontSize="36"
          fontWeight="700"
          fontFamily="'JetBrains Mono', monospace"
          style={{
            transition: "fill 0.3s ease",
          }}
        >
          {Math.round(clamped)}
        </text>

        {/* Percent symbol */}
        <text
          x="136"
          y="72"
          textAnchor="start"
          dominantBaseline="middle"
          fill="var(--text-muted)"
          fontSize="14"
          fontWeight="600"
          fontFamily="'JetBrains Mono', monospace"
        >
          %
        </text>
      </svg>

      {/* Label */}
      <div
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: 0.8,
          fontWeight: 600,
          marginTop: -4,
        }}
      >
        Bugunun Verimliligi
      </div>
    </div>
  );
}
