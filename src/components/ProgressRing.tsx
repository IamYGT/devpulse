import { useEffect, useState } from "react";

interface ProgressRingProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  showLabel?: boolean;
  animated?: boolean;
}

function getAutoColor(value: number): string {
  if (value >= 70) return "var(--accent-green)";
  if (value >= 40) return "var(--accent-yellow)";
  return "var(--accent-red)";
}

export default function ProgressRing({
  value,
  size = 60,
  strokeWidth = 4,
  color,
  showLabel = true,
  animated = true,
}: ProgressRingProps) {
  const [displayValue, setDisplayValue] = useState(animated ? 0 : value);
  const clamped = Math.min(100, Math.max(0, value));
  const resolvedColor = color || getAutoColor(clamped);

  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayValue / 100) * circumference;

  useEffect(() => {
    if (!animated) {
      setDisplayValue(clamped);
      return;
    }
    let start: number | null = null;
    const from = displayValue;
    const duration = 600;

    function tick(ts: number) {
      if (start === null) start = ts;
      const elapsed = ts - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(from + (clamped - from) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }, [clamped]);

  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
      }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={resolvedColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: animated ? "stroke 0.3s ease" : undefined }}
        />
      </svg>
      {showLabel && (
        <span
          style={{
            position: "absolute",
            fontSize: size < 50 ? 10 : 13,
            fontWeight: 700,
            color: "var(--text-primary)",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {Math.round(displayValue)}%
        </span>
      )}
    </div>
  );
}
