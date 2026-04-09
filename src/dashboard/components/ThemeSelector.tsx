import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

/* ------------------------------------------------------------------ */
/*  Theme Definitions                                                  */
/* ------------------------------------------------------------------ */

interface ThemeColors {
  "--bg-primary": string;
  "--bg-secondary": string;
  "--bg-card": string;
  "--bg-hover": string;
  "--text-primary": string;
  "--text-secondary": string;
  "--text-muted": string;
  "--accent-blue": string;
  "--accent-green": string;
  "--accent-red": string;
  "--accent-yellow": string;
  "--accent-purple": string;
  "--accent-orange": string;
  "--border": string;
}

interface ThemeEntry {
  id: string;
  name: string;
  colors: ThemeColors;
  preview: { bg: string; accent: string; text: string };
}

const themes: ThemeEntry[] = [
  {
    id: "midnight",
    name: "Midnight",
    colors: {
      "--bg-primary": "#0a0a14",
      "--bg-secondary": "#12122a",
      "--bg-card": "#161638",
      "--bg-hover": "#1e1e4a",
      "--text-primary": "#e8e8f0",
      "--text-secondary": "#8888aa",
      "--text-muted": "#555577",
      "--accent-blue": "#6366f1",
      "--accent-green": "#22c55e",
      "--accent-red": "#ef4444",
      "--accent-yellow": "#eab308",
      "--accent-purple": "#a855f7",
      "--accent-orange": "#f97316",
      "--border": "#222244",
    },
    preview: { bg: "#0a0a14", accent: "#6366f1", text: "#e8e8f0" },
  },
  {
    id: "ocean",
    name: "Ocean",
    colors: {
      "--bg-primary": "#0a1628",
      "--bg-secondary": "#0f2035",
      "--bg-card": "#132a42",
      "--bg-hover": "#1a3552",
      "--text-primary": "#e0f0ff",
      "--text-secondary": "#7aabc8",
      "--text-muted": "#4a7a98",
      "--accent-blue": "#06b6d4",
      "--accent-green": "#10b981",
      "--accent-red": "#f43f5e",
      "--accent-yellow": "#fbbf24",
      "--accent-purple": "#8b5cf6",
      "--accent-orange": "#fb923c",
      "--border": "#1a3050",
    },
    preview: { bg: "#0a1628", accent: "#06b6d4", text: "#e0f0ff" },
  },
  {
    id: "forest",
    name: "Forest",
    colors: {
      "--bg-primary": "#0a1a0a",
      "--bg-secondary": "#0f250f",
      "--bg-card": "#132e13",
      "--bg-hover": "#1a3a1a",
      "--text-primary": "#e0f5e0",
      "--text-secondary": "#7ab87a",
      "--text-muted": "#4a8a4a",
      "--accent-blue": "#22c55e",
      "--accent-green": "#4ade80",
      "--accent-red": "#ef4444",
      "--accent-yellow": "#eab308",
      "--accent-purple": "#a78bfa",
      "--accent-orange": "#fb923c",
      "--border": "#1a3a1a",
    },
    preview: { bg: "#0a1a0a", accent: "#22c55e", text: "#e0f5e0" },
  },
  {
    id: "sunset",
    name: "Sunset",
    colors: {
      "--bg-primary": "#1a0a0a",
      "--bg-secondary": "#251010",
      "--bg-card": "#2e1515",
      "--bg-hover": "#3a1a1a",
      "--text-primary": "#f5e0e0",
      "--text-secondary": "#c88a7a",
      "--text-muted": "#8a5a4a",
      "--accent-blue": "#f97316",
      "--accent-green": "#22c55e",
      "--accent-red": "#ef4444",
      "--accent-yellow": "#fbbf24",
      "--accent-purple": "#c084fc",
      "--accent-orange": "#fb923c",
      "--border": "#3a2020",
    },
    preview: { bg: "#1a0a0a", accent: "#f97316", text: "#f5e0e0" },
  },
  {
    id: "light",
    name: "Light",
    colors: {
      "--bg-primary": "#f8fafc",
      "--bg-secondary": "#f1f5f9",
      "--bg-card": "#ffffff",
      "--bg-hover": "#e2e8f0",
      "--text-primary": "#1e293b",
      "--text-secondary": "#64748b",
      "--text-muted": "#94a3b8",
      "--accent-blue": "#4f46e5",
      "--accent-green": "#16a34a",
      "--accent-red": "#dc2626",
      "--accent-yellow": "#ca8a04",
      "--accent-purple": "#9333ea",
      "--accent-orange": "#ea580c",
      "--border": "#e2e8f0",
    },
    preview: { bg: "#f8fafc", accent: "#4f46e5", text: "#1e293b" },
  },
];

/* ------------------------------------------------------------------ */
/*  Helper: apply theme to document                                    */
/* ------------------------------------------------------------------ */

function applyTheme(themeId: string) {
  const theme = themes.find((t) => t.id === themeId);
  if (!theme) return;

  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(key, value);
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ThemeSelector() {
  const [activeTheme, setActiveTheme] = useState("midnight");
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);

  // Load saved theme on mount
  useEffect(() => {
    invoke<string | null>("get_setting", { key: "theme" }).then((saved) => {
      if (saved) {
        setActiveTheme(saved);
        applyTheme(saved);
      }
    }).catch(() => { /* ignore */ });
  }, []);

  const handlePreview = (themeId: string) => {
    setPreviewTheme(themeId);
    applyTheme(themeId);
  };

  const handleConfirm = async (themeId: string) => {
    setActiveTheme(themeId);
    setPreviewTheme(null);
    applyTheme(themeId);
    try {
      await invoke("save_setting", { key: "theme", value: themeId });
    } catch (err) {
      console.error("Tema kaydedilemedi:", err);
    }
  };

  const handleCancel = () => {
    if (previewTheme) {
      setPreviewTheme(null);
      applyTheme(activeTheme);
    }
  };

  return (
    <div>
      <div className="card-title" style={{ marginBottom: 16 }}>Tema</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
        {themes.map((theme) => {
          const isActive = activeTheme === theme.id;
          const isPreviewing = previewTheme === theme.id;

          return (
            <button
              key={theme.id}
              onClick={() => {
                if (isActive) return;
                if (isPreviewing) {
                  handleConfirm(theme.id);
                } else {
                  handlePreview(theme.id);
                }
              }}
              style={{
                padding: 0,
                border: `2px solid ${isActive ? "var(--accent-blue)" : isPreviewing ? "var(--accent-yellow)" : "var(--border)"}`,
                borderRadius: "var(--radius)",
                cursor: isActive ? "default" : "pointer",
                overflow: "hidden",
                background: "transparent",
                transition: "border-color 0.2s, transform 0.2s",
                transform: isPreviewing ? "scale(1.02)" : "scale(1)",
              }}
            >
              {/* Color preview swatch */}
              <div
                style={{
                  height: 60,
                  background: theme.preview.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: 8,
                }}
              >
                <div style={{ width: 20, height: 20, borderRadius: 4, background: theme.preview.accent }} />
                <div style={{ width: 32, height: 4, borderRadius: 2, background: theme.preview.text, opacity: 0.6 }} />
                <div style={{ width: 24, height: 4, borderRadius: 2, background: theme.preview.text, opacity: 0.3 }} />
              </div>

              {/* Theme name */}
              <div
                style={{
                  padding: "8px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: isActive ? "var(--accent-blue)" : "var(--text-secondary)",
                  background: "var(--bg-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                {theme.name}
                {isActive && (
                  <span style={{ fontSize: 10, color: "var(--accent-green)" }}>&#10003;</span>
                )}
                {isPreviewing && (
                  <span style={{ fontSize: 9, color: "var(--accent-yellow)" }}>Onizleme</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Cancel preview */}
      {previewTheme && previewTheme !== activeTheme && (
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn" onClick={handleCancel} style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Iptal
          </button>
          <button className="btn btn-primary" onClick={() => handleConfirm(previewTheme)} style={{ fontSize: 12 }}>
            Temayı Uygula
          </button>
        </div>
      )}
    </div>
  );
}

// Export for use in App.tsx to apply saved theme on startup
export { applyTheme, themes };
