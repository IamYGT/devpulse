import { useEffect, useState } from "react";

interface EmptyStateProps {
  icon?: "chart" | "calendar" | "git" | "clock" | "search" | "folder";
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

const icons: Record<string, React.ReactElement> = {
  chart: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <rect x="8" y="40" width="10" height="16" rx="2" fill="var(--accent-blue)" opacity="0.5" />
      <rect x="22" y="28" width="10" height="28" rx="2" fill="var(--accent-blue)" opacity="0.65" />
      <rect x="36" y="16" width="10" height="40" rx="2" fill="var(--accent-blue)" opacity="0.8" />
      <rect x="50" y="8" width="10" height="48" rx="2" fill="var(--accent-blue)" />
      <line x1="4" y1="58" x2="60" y2="58" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  calendar: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <rect x="8" y="14" width="48" height="42" rx="6" stroke="var(--accent-blue)" strokeWidth="2" fill="none" />
      <line x1="8" y1="26" x2="56" y2="26" stroke="var(--accent-blue)" strokeWidth="2" />
      <circle cx="22" cy="36" r="3" fill="var(--accent-blue)" opacity="0.5" />
      <circle cx="34" cy="36" r="3" fill="var(--accent-blue)" opacity="0.7" />
      <circle cx="46" cy="36" r="3" fill="var(--accent-blue)" />
      <circle cx="22" cy="46" r="3" fill="var(--accent-blue)" opacity="0.3" />
      <line x1="20" y1="8" x2="20" y2="18" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" />
      <line x1="44" y1="8" x2="44" y2="18" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  git: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="16" r="6" stroke="var(--accent-blue)" strokeWidth="2" fill="none" />
      <circle cx="18" cy="48" r="6" stroke="var(--accent-blue)" strokeWidth="2" fill="var(--accent-blue)" opacity="0.3" />
      <circle cx="46" cy="48" r="6" stroke="var(--accent-blue)" strokeWidth="2" fill="var(--accent-blue)" opacity="0.3" />
      <line x1="28" y1="20" x2="20" y2="42" stroke="var(--accent-blue)" strokeWidth="2" />
      <line x1="36" y1="20" x2="44" y2="42" stroke="var(--accent-blue)" strokeWidth="2" />
    </svg>
  ),
  clock: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="24" stroke="var(--accent-blue)" strokeWidth="2" fill="none" />
      <line x1="32" y1="32" x2="32" y2="18" stroke="var(--accent-blue)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="32" y1="32" x2="44" y2="36" stroke="var(--accent-blue)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="32" r="3" fill="var(--accent-blue)" />
    </svg>
  ),
  search: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <circle cx="28" cy="28" r="16" stroke="var(--accent-blue)" strokeWidth="2.5" fill="none" />
      <line x1="40" y1="40" x2="54" y2="54" stroke="var(--accent-blue)" strokeWidth="3" strokeLinecap="round" />
      <line x1="20" y1="28" x2="36" y2="28" stroke="var(--accent-blue)" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
  ),
  folder: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <path d="M6 18C6 15.8 7.8 14 10 14H24L30 20H54C56.2 20 58 21.8 58 24V50C58 52.2 56.2 54 54 54H10C7.8 54 6 52.2 6 50V18Z" stroke="var(--accent-blue)" strokeWidth="2" fill="none" />
      <line x1="22" y1="36" x2="42" y2="36" stroke="var(--accent-blue)" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <line x1="26" y1="42" x2="38" y2="42" stroke="var(--accent-blue)" strokeWidth="1.5" strokeLinecap="round" opacity="0.25" />
    </svg>
  ),
};

export default function EmptyState({ icon = "chart", title, description, action }: EmptyStateProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        textAlign: "center",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 0.4s ease, transform 0.4s ease",
      }}
    >
      <div style={{ marginBottom: 20, opacity: 0.85 }}>{icons[icon]}</div>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: 8,
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            maxWidth: 320,
            lineHeight: 1.5,
            marginBottom: action ? 20 : 0,
          }}
        >
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          style={{
            padding: "8px 20px",
            fontSize: 13,
            fontWeight: 500,
            color: "#fff",
            background: "var(--accent-blue)",
            border: "none",
            borderRadius: "var(--radius)",
            cursor: "pointer",
            transition: "opacity 0.15s, transform 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "0.85";
            e.currentTarget.style.transform = "scale(1.03)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "1";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
