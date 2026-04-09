interface LoadingProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  variant?: "spinner" | "dots" | "pulse";
  color?: string;
}

const sizes = { sm: 16, md: 24, lg: 48 };

export default function LoadingSpinner({
  size = "md",
  label,
  variant = "spinner",
  color = "var(--accent-blue)",
}: LoadingProps) {
  const px = sizes[size];

  if (variant === "dots") {
    return (
      <span className="loading-dots" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: px * 0.35,
              height: px * 0.35,
              borderRadius: "50%",
              background: color,
              animation: `loading-dot-bounce 1.2s ease-in-out ${i * 0.16}s infinite`,
            }}
          />
        ))}
        {label && (
          <span style={{ marginLeft: 8, fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
        )}
        <style>{`
          @keyframes loading-dot-bounce {
            0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
            30% { opacity: 1; transform: scale(1.2); }
          }
        `}</style>
      </span>
    );
  }

  if (variant === "pulse") {
    return (
      <span className="loading-pulse" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: px * 0.5,
            height: px * 0.5,
            borderRadius: "50%",
            background: color,
            animation: "loading-pulse-anim 1.5s ease-in-out infinite",
          }}
        />
        {label && (
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
        )}
        <style>{`
          @keyframes loading-pulse-anim {
            0%, 100% { opacity: 0.4; transform: scale(0.85); }
            50% { opacity: 1; transform: scale(1.15); }
          }
        `}</style>
      </span>
    );
  }

  // Default: spinner
  const strokeWidth = size === "lg" ? 3 : 2.5;
  const radius = (px - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <span
      className="loading-spinner"
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <svg
        width={px}
        height={px}
        viewBox={`0 0 ${px} ${px}`}
        style={{ animation: "loading-spin 1s linear infinite" }}
      >
        <defs>
          <linearGradient id={`spinner-grad-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
          opacity={0.3}
        />
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          stroke={`url(#spinner-grad-${size})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference * 0.7} ${circumference * 0.3}`}
        />
      </svg>
      {label && (
        <span style={{ fontSize: size === "sm" ? 11 : 13, color: "var(--text-secondary)" }}>
          {label}
        </span>
      )}
      <style>{`
        @keyframes loading-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </span>
  );
}
