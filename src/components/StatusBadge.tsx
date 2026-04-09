type BadgeVariant =
  | "productive"
  | "distracting"
  | "neutral"
  | "idle"
  | "success"
  | "warning"
  | "error"
  | "info";

interface StatusBadgeProps {
  variant: BadgeVariant;
  label: string;
  size?: "sm" | "md";
  pulse?: boolean;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, { bg: string; fg: string; dot: string }> = {
  productive: { bg: "rgba(34,197,94,0.15)", fg: "var(--accent-green)", dot: "var(--accent-green)" },
  distracting: { bg: "rgba(239,68,68,0.15)", fg: "var(--accent-red)", dot: "var(--accent-red)" },
  neutral: { bg: "rgba(136,136,170,0.15)", fg: "var(--text-secondary)", dot: "var(--text-secondary)" },
  idle: { bg: "rgba(234,179,8,0.12)", fg: "var(--accent-yellow)", dot: "var(--accent-yellow)" },
  success: { bg: "rgba(34,197,94,0.15)", fg: "var(--accent-green)", dot: "var(--accent-green)" },
  warning: { bg: "rgba(234,179,8,0.15)", fg: "var(--accent-yellow)", dot: "var(--accent-yellow)" },
  error: { bg: "rgba(239,68,68,0.15)", fg: "var(--accent-red)", dot: "var(--accent-red)" },
  info: { bg: "rgba(99,102,241,0.15)", fg: "var(--accent-blue)", dot: "var(--accent-blue)" },
};

export default function StatusBadge({
  variant,
  label,
  size = "md",
  pulse = false,
  dot = false,
}: StatusBadgeProps) {
  const style = variantStyles[variant];
  const isSm = size === "sm";

  if (dot) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: isSm ? 5 : 6,
          fontSize: isSm ? 11 : 13,
          color: style.fg,
          fontWeight: 500,
        }}
      >
        <span
          style={{
            width: isSm ? 6 : 8,
            height: isSm ? 6 : 8,
            borderRadius: "50%",
            background: style.dot,
            flexShrink: 0,
            animation: pulse ? "badge-pulse 2s ease-in-out infinite" : undefined,
          }}
        />
        {label}
        {pulse && (
          <style>{`
            @keyframes badge-pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.5; transform: scale(0.85); }
            }
          `}</style>
        )}
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: isSm ? 5 : 6,
        padding: isSm ? "2px 8px" : "3px 12px",
        fontSize: isSm ? 11 : 12,
        fontWeight: 600,
        color: style.fg,
        background: style.bg,
        borderRadius: 999,
        whiteSpace: "nowrap",
        animation: pulse ? "badge-pulse 2s ease-in-out infinite" : undefined,
      }}
    >
      {label}
      {pulse && (
        <style>{`
          @keyframes badge-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
          }
        `}</style>
      )}
    </span>
  );
}
