import { useRef, useState, type ReactNode } from "react";

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  color?: string;
  trend?: { value: number; direction: "up" | "down" | "neutral" };
  onClick?: () => void;
  sparklineData?: number[];
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 60;
  const h = 24;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} style={{ position: "absolute", bottom: 12, right: 14, opacity: 0.5 }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrendArrow({ value, direction }: { value: number; direction: "up" | "down" | "neutral" }) {
  const trendColor =
    direction === "up"
      ? "var(--accent-green)"
      : direction === "down"
        ? "var(--accent-red)"
        : "var(--text-muted)";

  const arrow = direction === "up" ? "\u2191" : direction === "down" ? "\u2193" : "\u2192";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: 12,
        fontWeight: 600,
        color: trendColor,
      }}
    >
      <span>{arrow}</span>
      <span>{Math.abs(value)}%</span>
    </span>
  );
}

export default function StatCard({
  icon,
  label,
  value,
  color = "var(--accent-blue)",
  trend,
  onClick,
  sparklineData,
}: StatCardProps) {
  const [hovered, setHovered] = useState(false);
  const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onClick) return;
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      setRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top, id: Date.now() });
      setTimeout(() => setRipple(null), 500);
    }
    onClick();
  };

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        overflow: "hidden",
        background: "var(--bg-card)",
        border: `1px solid ${hovered ? color : "var(--border)"}`,
        borderRadius: "var(--radius)",
        padding: "18px 20px",
        cursor: onClick ? "pointer" : "default",
        transition: "transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hovered ? `0 4px 20px ${color}18` : "none",
      }}
    >
      {/* Ripple */}
      {ripple && (
        <span
          key={ripple.id}
          style={{
            position: "absolute",
            left: ripple.x - 40,
            top: ripple.y - 40,
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: color,
            opacity: 0.15,
            transform: "scale(0)",
            animation: "stat-ripple 0.5s ease-out forwards",
            pointerEvents: "none",
          }}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ color, display: "flex", alignItems: "center" }}>{icon}</span>
        <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>{label}</span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)" }}>{value}</span>
        {trend && <TrendArrow value={trend.value} direction={trend.direction} />}
      </div>

      {sparklineData && sparklineData.length > 1 && (
        <MiniSparkline data={sparklineData} color={color} />
      )}

      <style>{`
        @keyframes stat-ripple {
          to { transform: scale(4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
