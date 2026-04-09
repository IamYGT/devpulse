import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SmartSuggestion {
  action: string;
  message: string;
  project_name: string | null;
  urgency: string;
}

/* ------------------------------------------------------------------ */
/*  Action Configs                                                     */
/* ------------------------------------------------------------------ */

interface ActionStyle {
  icon: React.ReactNode;
  borderColor: string;
  bgColor: string;
  label: string;
}

const IconSwitch = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

const IconCoffee = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
    <line x1="6" y1="2" x2="6" y2="4" />
    <line x1="10" y1="2" x2="10" y2="4" />
    <line x1="14" y1="2" x2="14" y2="4" />
  </svg>
);

const IconGit = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <line x1="3" y1="12" x2="9" y2="12" />
    <line x1="15" y1="12" x2="21" y2="12" />
  </svg>
);

const IconThumbsUp = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
  </svg>
);

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

function getActionStyle(action: string): ActionStyle {
  switch (action) {
    case "switch_project":
      return {
        icon: <IconSwitch />,
        borderColor: "var(--accent-blue)",
        bgColor: "rgba(99, 102, 241, 0.08)",
        label: "Proje Gecisi",
      };
    case "take_break":
      return {
        icon: <IconCoffee />,
        borderColor: "#8b5cf6",
        bgColor: "rgba(139, 92, 246, 0.08)",
        label: "Mola Zamani",
      };
    case "commit_changes":
      return {
        icon: <IconGit />,
        borderColor: "var(--accent-orange)",
        bgColor: "rgba(249, 115, 22, 0.08)",
        label: "Commit Hatirlatma",
      };
    case "keep_going":
    default:
      return {
        icon: <IconThumbsUp />,
        borderColor: "var(--accent-green)",
        bgColor: "rgba(34, 197, 94, 0.08)",
        label: "Devam Et",
      };
  }
}

function urgencyDot(urgency: string): string {
  switch (urgency) {
    case "high":
      return "var(--accent-red)";
    case "medium":
      return "var(--accent-orange)";
    default:
      return "var(--accent-green)";
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SmartSuggestionCard() {
  const [suggestion, setSuggestion] = useState<SmartSuggestion | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestion = async () => {
    try {
      const result = await invoke<SmartSuggestion>("get_smart_suggestion");
      setSuggestion(result);
      setDismissed(false);
      // Animate in
      setTimeout(() => setVisible(true), 50);
    } catch (err) {
      console.error("Failed to fetch smart suggestion:", err);
    }
  };

  useEffect(() => {
    fetchSuggestion();
    intervalRef.current = setInterval(fetchSuggestion, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    // After animation out, mark dismissed and set a comeback timer
    setTimeout(() => setDismissed(true), 300);

    // Come back with new suggestion after 2 minutes
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      fetchSuggestion();
    }, 120000);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  if (dismissed || !suggestion) return null;

  const style = getActionStyle(suggestion.action);

  return (
    <div
      style={{
        padding: "14px 16px",
        background: style.bgColor,
        borderLeft: `3px solid ${style.borderColor}`,
        borderRadius: "0 var(--radius) var(--radius) 0",
        display: "flex",
        alignItems: "center",
        gap: 12,
        transform: visible ? "translateX(0)" : "translateX(20px)",
        opacity: visible ? 1 : 0,
        transition: "transform 0.3s ease, opacity 0.3s ease",
        position: "relative",
      }}
    >
      {/* Urgency dot */}
      <span
        style={{
          position: "absolute",
          top: 6,
          right: 32,
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: urgencyDot(suggestion.urgency),
        }}
      />

      {/* Icon */}
      <span style={{ flexShrink: 0, display: "flex" }}>{style.icon}</span>

      {/* Content */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: style.borderColor,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginBottom: 2,
          }}
        >
          {style.label}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.4 }}>{suggestion.message}</div>
        {suggestion.project_name && suggestion.action === "switch_project" && (
          <div
            style={{
              marginTop: 6,
              display: "inline-block",
              padding: "2px 10px",
              borderRadius: 100,
              background: "rgba(99, 102, 241, 0.15)",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--accent-blue)",
            }}
          >
            {suggestion.project_name}
          </div>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        style={{
          flexShrink: 0,
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          padding: 4,
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.6,
          transition: "opacity 0.2s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = "0.6";
        }}
        title="Kapat"
      >
        <IconX />
      </button>
    </div>
  );
}
