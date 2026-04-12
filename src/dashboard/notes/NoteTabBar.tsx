import { useRef, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────
interface NoteTab {
  id: number;
  title: string;
}

interface NoteTabBarProps {
  tabs: NoteTab[];
  activeId: number;
  onSelect: (id: number) => void;
  onClose: (id: number) => void;
  onNew: () => void;
}

// ── Helpers ──────────────────────────────────────────────────
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 1) + "\u2026";
}

// ── Main component ───────────────────────────────────────────
export default function NoteTabBar({
  tabs,
  activeId,
  onSelect,
  onClose,
  onNew,
}: NoteTabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleMiddleClick = useCallback(
    (e: React.MouseEvent, id: number) => {
      // Middle mouse button = button 1
      if (e.button === 1) {
        e.preventDefault();
        onClose(id);
      }
    },
    [onClose]
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
        minHeight: 38,
      }}
    >
      {/* Scrollable tab area */}
      <div
        ref={scrollRef}
        style={{
          display: "flex",
          alignItems: "stretch",
          flex: 1,
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "none",
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <div
              key={tab.id}
              onClick={() => onSelect(tab.id)}
              onMouseDown={(e) => handleMiddleClick(e, tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "0 14px",
                minWidth: 0,
                maxWidth: 180,
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                background: isActive ? "var(--bg-primary)" : "transparent",
                borderBottom: isActive
                  ? "2px solid var(--accent-blue)"
                  : "2px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s ease",
                userSelect: "none",
                whiteSpace: "nowrap",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "var(--bg-hover)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }
              }}
            >
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {truncate(tab.title || "Isimsiz Not", 20)}
              </span>

              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
                title="Sekmeyi kapat"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 18,
                  height: 18,
                  padding: 0,
                  fontSize: 14,
                  lineHeight: 1,
                  fontFamily: "inherit",
                  color: "var(--text-muted)",
                  background: "transparent",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--accent-red)";
                  e.currentTarget.style.background = "rgba(239,68,68,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-muted)";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {"\u00D7"}
              </button>
            </div>
          );
        })}
      </div>

      {/* New tab button */}
      <button
        onClick={onNew}
        title="Yeni not"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          padding: 0,
          fontSize: 18,
          fontWeight: 400,
          fontFamily: "inherit",
          color: "var(--text-muted)",
          background: "transparent",
          border: "none",
          borderLeft: "1px solid var(--border)",
          cursor: "pointer",
          flexShrink: 0,
          transition: "all 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--accent-blue)";
          e.currentTarget.style.background = "var(--bg-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--text-muted)";
          e.currentTarget.style.background = "transparent";
        }}
      >
        +
      </button>
    </div>
  );
}
