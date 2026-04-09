import { useEffect, useRef, useState, type ReactNode } from "react";

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: number;
}

interface TabGroupProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export default function TabGroup({ tabs, activeTab, onChange }: TabGroupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    const el = tabRefs.current.get(activeTab);
    if (el && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      setIndicator({
        left: elRect.left - containerRect.left,
        width: elRect.width,
      });
    }
  }, [activeTab, tabs]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "flex",
        gap: 0,
        borderBottom: "1px solid var(--border)",
        marginBottom: 16,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.id, el);
            }}
            onClick={() => onChange(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              fontFamily: "inherit",
              color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              transition: "color 0.2s ease",
              position: "relative",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            {tab.icon && (
              <span style={{ display: "flex", alignItems: "center", opacity: isActive ? 1 : 0.6 }}>
                {tab.icon}
              </span>
            )}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: "#fff",
                  background: "var(--accent-blue)",
                  borderRadius: 999,
                  lineHeight: 1,
                }}
              >
                {tab.badge > 99 ? "99+" : tab.badge}
              </span>
            )}
          </button>
        );
      })}

      {/* Animated underline indicator */}
      <div
        style={{
          position: "absolute",
          bottom: -1,
          left: indicator.left,
          width: indicator.width,
          height: 2,
          background: "var(--accent-blue)",
          borderRadius: "1px 1px 0 0",
          transition: "left 0.25s cubic-bezier(0.4,0,0.2,1), width 0.25s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
    </div>
  );
}
