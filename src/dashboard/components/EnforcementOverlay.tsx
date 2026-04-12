import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ActiveWarning {
  project_name: string;
  project_id: number;
  level: string;
  message: string;
  percentage: number;
  suggested_project: string | null;
}

interface EnforcementStatus {
  active_warnings: ActiveWarning[];
  enforcement_level: string;
  break_due: boolean;
  minutes_since_break: number;
  daily_overtime_minutes: number;
}

/**
 * EnforcementOverlay - Full screen overlay system for budget enforcement.
 * 4 escalating levels of intervention:
 * - Gentle (80%): Small toast at bottom right
 * - Firm (100%): Banner at top of screen
 * - Aggressive (150%): Semi-transparent overlay covering 50%
 * - Critical (200%): Full screen dark overlay, requires action
 */
export default function EnforcementOverlay() {
  const [status, setStatus] = useState<EnforcementStatus | null>(null);
  const [overrideProjectId, setOverrideProjectId] = useState<number | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [dismissedToasts, setDismissedToasts] = useState<Set<number>>(new Set());

  const fetchStatus = useCallback(async () => {
    try {
      const s = await invoke<EnforcementStatus>("get_enforcement_status");
      setStatus(s);
    } catch (err) {
      console.error("Enforcement status fetch failed:", err);
    }
  }, []);

  // Poll every 5 seconds
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleDismiss = async (projectId: number) => {
    try {
      await invoke("dismiss_warning", { projectId });
      setDismissedToasts((prev) => new Set([...prev, projectId]));
      await fetchStatus();
    } catch (err) {
      console.error("Dismiss failed:", err);
    }
  };

  const handleSwitchProject = async () => {
    // This triggers the user to manually switch - we dismiss the warning
    if (status?.active_warnings[0]) {
      await handleDismiss(status.active_warnings[0].project_id);
    }
  };

  const handleOverrideSubmit = async () => {
    if (!overrideProjectId || !overrideReason.trim()) return;
    try {
      await invoke("request_emergency_override", {
        projectId: overrideProjectId,
        reason: overrideReason,
        extraMinutes: 30,
      });
      setOverrideProjectId(null);
      setOverrideReason("");
      await fetchStatus();
    } catch (err) {
      console.error("Override failed:", err);
    }
  };

  const handleTakeBreak = async () => {
    try {
      await invoke("record_break_start");
      await invoke("pause_tracking");
      await fetchStatus();
    } catch (err) {
      console.error("Break start failed:", err);
    }
  };

  if (!status || !status.active_warnings || status.active_warnings.length === 0) {
    return null;
  }

  // Find the highest severity warning
  const levelPriority: Record<string, number> = {
    critical: 4,
    aggressive: 3,
    firm: 2,
    gentle: 1,
  };

  const sortedWarnings = [...status.active_warnings].sort(
    (a, b) => (levelPriority[b.level] || 0) - (levelPriority[a.level] || 0)
  );

  const topWarning = sortedWarnings[0];

  // Override input dialog
  if (overrideProjectId !== null) {
    return (
      <div style={styles.criticalOverlay}>
        <div style={styles.overrideDialog}>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
            Acil Durum Override
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
            Devam etmek icin bir sebep belirtmelisin. 30dk ek sure verilecek.
          </div>
          <textarea
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="Neden devam etmen gerekiyor? (orn: kritik deadline, bug fix)"
            autoFocus
            style={styles.overrideInput}
          />
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button
              style={styles.btnDanger}
              onClick={handleOverrideSubmit}
              disabled={!overrideReason.trim()}
            >
              Devam Et (+30dk)
            </button>
            <button
              style={styles.btnSecondary}
              onClick={() => {
                setOverrideProjectId(null);
                setOverrideReason("");
              }}
            >
              Vazgec
            </button>
          </div>
        </div>
      </div>
    );
  }

  // LEVEL 4: Critical (200%+) - Full screen dark overlay
  if (topWarning.level === "critical") {
    return (
      <div style={styles.criticalOverlay}>
        <div style={styles.criticalContent}>
          <div style={styles.criticalIcon}>
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div style={styles.criticalTitle}>LUTFEN DUR!</div>
          <div style={styles.criticalMessage}>
            {topWarning.project_name} projesinde{" "}
            <span className="mono" style={{ color: "var(--accent-red)" }}>
              {Math.round(topWarning.percentage)}%
            </span>{" "}
            butce kullanimi.
          </div>
          <div style={styles.criticalSub}>{topWarning.message}</div>

          <div style={styles.criticalButtons}>
            <button style={styles.btnPrimary} onClick={handleSwitchProject}>
              Baska Projeye Gec
            </button>
            <button style={styles.btnWarning} onClick={handleTakeBreak}>
              Mola Ver
            </button>
            <button
              style={styles.btnDangerOutline}
              onClick={() => setOverrideProjectId(topWarning.project_id)}
            >
              Acil: Devam Et (sebep gerekli)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // LEVEL 3: Aggressive (150%+) - Semi-transparent overlay covering 50%
  if (topWarning.level === "aggressive") {
    return (
      <div style={styles.aggressiveOverlay}>
        <div style={styles.aggressiveContent}>
          <div style={styles.aggressiveIcon}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#f97316" }}>
            BUTCE ASILDI!
          </div>
          <div style={{ fontSize: 16, marginTop: 8 }}>{topWarning.message}</div>
          {topWarning.suggested_project && (
            <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 8 }}>
              Onerilen: {topWarning.suggested_project} projesine gec
            </div>
          )}
          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <button style={styles.btnPrimary} onClick={handleSwitchProject}>
              Projeyi Degistir
            </button>
            <button
              style={styles.btnDangerOutline}
              onClick={() => setOverrideProjectId(topWarning.project_id)}
            >
              Acil Durum Override
            </button>
          </div>
        </div>
      </div>
    );
  }

  // LEVEL 2: Firm (100%) - Banner at top of screen
  if (topWarning.level === "firm") {
    return (
      <div style={styles.firmBanner}>
        <div style={styles.firmContent}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{topWarning.message}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={styles.btnSmallPrimary} onClick={handleSwitchProject}>
              Gec
            </button>
            <button
              style={styles.btnSmallWarning}
              onClick={() => handleDismiss(topWarning.project_id)}
            >
              5dk Daha
            </button>
            <button
              style={styles.btnSmallDanger}
              onClick={() => setOverrideProjectId(topWarning.project_id)}
            >
              Acil Durum
            </button>
          </div>
        </div>
      </div>
    );
  }

  // LEVEL 1: Gentle (80%) - Small toast notification at bottom right
  if (topWarning.level === "gentle") {
    if (dismissedToasts.has(topWarning.project_id)) {
      return null;
    }

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      setDismissedToasts((prev) => new Set([...prev, topWarning.project_id]));
    }, 10000);

    return (
      <div style={styles.gentleToast}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
            {topWarning.message}
          </span>
        </div>
        <button
          onClick={() => handleDismiss(topWarning.project_id)}
          style={styles.toastClose}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    );
  }

  return null;
}

// --- Styles ---

const styles: Record<string, React.CSSProperties> = {
  // Critical (Level 4) - Full screen
  criticalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(10, 10, 20, 0.95)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(8px)",
  },
  criticalContent: {
    textAlign: "center" as const,
    maxWidth: 500,
    padding: 40,
  },
  criticalIcon: {
    marginBottom: 24,
    animation: "pulse 2s infinite",
  },
  criticalTitle: {
    fontSize: 42,
    fontWeight: 900,
    color: "#ef4444",
    letterSpacing: 4,
    marginBottom: 16,
    fontFamily: "'JetBrains Mono', monospace",
  },
  criticalMessage: {
    fontSize: 18,
    color: "var(--text-primary)",
    marginBottom: 8,
  },
  criticalSub: {
    fontSize: 14,
    color: "var(--text-secondary)",
    marginBottom: 32,
    lineHeight: 1.6,
  },
  criticalButtons: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    alignItems: "center",
  },

  // Aggressive (Level 3) - Half screen overlay
  aggressiveOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: "50%",
    background: "rgba(10, 10, 20, 0.92)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(4px)",
    borderBottom: "2px solid #f97316",
  },
  aggressiveContent: {
    textAlign: "center" as const,
    padding: 32,
  },
  aggressiveIcon: {
    marginBottom: 16,
  },

  // Firm (Level 2) - Top banner
  firmBanner: {
    position: "fixed",
    top: 0,
    left: 220, // Sidebar width
    right: 0,
    zIndex: 9998,
    background: "linear-gradient(135deg, #1a0a0a 0%, #2a0a0a 100%)",
    borderBottom: "2px solid #ef4444",
    padding: "12px 24px",
    boxShadow: "0 4px 20px rgba(239, 68, 68, 0.3)",
  },
  firmContent: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },

  // Gentle (Level 1) - Toast
  gentleToast: {
    position: "fixed",
    bottom: 24,
    right: 24,
    zIndex: 9997,
    background: "var(--bg-card)",
    border: "1px solid var(--accent-yellow)",
    borderRadius: "var(--radius)",
    padding: "14px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    maxWidth: 420,
    boxShadow: "0 8px 32px rgba(234, 179, 8, 0.15)",
    animation: "slideIn 0.3s ease-out",
  },
  toastClose: {
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    padding: 4,
    display: "flex",
    alignItems: "center",
  },

  // Override dialog
  overrideDialog: {
    background: "var(--bg-card)",
    borderRadius: "var(--radius)",
    padding: 32,
    maxWidth: 440,
    width: "100%",
    border: "1px solid var(--accent-red)",
  },
  overrideInput: {
    width: "100%",
    minHeight: 80,
    padding: 12,
    background: "var(--bg-primary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    color: "var(--text-primary)",
    fontFamily: "'Inter', sans-serif",
    fontSize: 13,
    resize: "vertical" as const,
  },

  // Buttons
  btnPrimary: {
    padding: "12px 28px",
    background: "var(--accent-blue)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius)",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    minWidth: 180,
  },
  btnWarning: {
    padding: "12px 28px",
    background: "var(--accent-yellow)",
    color: "#000",
    border: "none",
    borderRadius: "var(--radius)",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    minWidth: 180,
  },
  btnDanger: {
    padding: "12px 28px",
    background: "var(--accent-red)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius)",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    flex: 1,
  },
  btnDangerOutline: {
    padding: "12px 28px",
    background: "transparent",
    color: "var(--accent-red)",
    border: "1px solid var(--accent-red)",
    borderRadius: "var(--radius)",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    minWidth: 180,
    opacity: 0.8,
  },
  btnSecondary: {
    padding: "12px 28px",
    background: "var(--bg-hover)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    flex: 1,
  },
  btnSmallPrimary: {
    padding: "6px 16px",
    background: "var(--accent-blue)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius)",
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
  },
  btnSmallWarning: {
    padding: "6px 16px",
    background: "var(--accent-yellow)",
    color: "#000",
    border: "none",
    borderRadius: "var(--radius)",
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
  },
  btnSmallDanger: {
    padding: "6px 16px",
    background: "transparent",
    color: "var(--accent-red)",
    border: "1px solid var(--accent-red)",
    borderRadius: "var(--radius)",
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
  },
};
