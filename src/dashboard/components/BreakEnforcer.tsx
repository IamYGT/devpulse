import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

interface BreakStatus {
  minutes_since_break: number;
  break_recommended: boolean;
  break_enforced: boolean;
  last_break_time: string | null;
}

const STRETCHING_TIPS = [
  "Kollarini yukariya uzat ve 10 saniye tut",
  "Boynunu yavasca saga ve sola cevir",
  "Gozlerini kapat ve 20 saniye uzaga bak",
  "Omuzlarini yukari kaldir, 5 saniye tut, birak",
  "Bileklerini dairesel olarak cevir",
  "Derin nefes al, 4 saniye tut, yavasca ver",
  "Ayaga kalk ve birka adim at",
  "Parcaklarini ac-kapa yap, kan dolasimini artir",
  "Sirtini duzlestir, omurgani uzat",
  "20-20-20 kurali: 20 saniye 20 feet uzaga bak",
];

/**
 * BreakEnforcer - Enforces regular breaks during work sessions.
 * - After 90 minutes continuous: gentle break reminder
 * - After 120 minutes: firm "MOLA ZAMANI" overlay with 5min countdown
 * - Shows stretching/eye rest suggestions
 * - "Molaya Basladim" button to acknowledge
 */
export default function BreakEnforcer() {
  const [breakStatus, setBreakStatus] = useState<BreakStatus | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(5 * 60); // 5 minutes
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBreakStatus = useCallback(async () => {
    try {
      const status = await invoke<BreakStatus>("get_break_status");
      setBreakStatus(status);

      // Show overlay if break is enforced and not dismissed
      if (status.break_enforced && !isOnBreak && !dismissed) {
        setShowOverlay(true);
      }
    } catch (err) {
      console.error("Break status fetch failed:", err);
    }
  }, [isOnBreak, dismissed]);

  // Poll every 10 seconds
  useEffect(() => {
    fetchBreakStatus();
    const interval = setInterval(fetchBreakStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchBreakStatus]);

  // Countdown timer for break
  useEffect(() => {
    if (isOnBreak && countdownSeconds > 0) {
      countdownRef.current = setInterval(() => {
        setCountdownSeconds((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [isOnBreak]);

  // Rotate tips every 15 seconds
  useEffect(() => {
    if (isOnBreak) {
      const tipInterval = setInterval(() => {
        setTipIndex((prev) => (prev + 1) % STRETCHING_TIPS.length);
      }, 15000);
      return () => clearInterval(tipInterval);
    }
  }, [isOnBreak]);

  const handleStartBreak = async () => {
    setIsOnBreak(true);
    setCountdownSeconds(5 * 60);
    try {
      await invoke("record_break_start");
      await invoke("pause_tracking");
    } catch (err) {
      console.error("Break start failed:", err);
    }
  };

  const handleEndBreak = async () => {
    setIsOnBreak(false);
    setShowOverlay(false);
    setDismissed(true);
    setCountdownSeconds(5 * 60);
    try {
      await invoke("resume_tracking");
      await fetchBreakStatus();
    } catch (err) {
      console.error("Break end failed:", err);
    }
    // Reset dismissed after a while so it can trigger again
    setTimeout(() => setDismissed(false), 60000);
  };

  const handleDismissReminder = () => {
    setDismissed(true);
    setTimeout(() => setDismissed(false), 5 * 60 * 1000); // Re-enable after 5 minutes
  };

  const formatCountdown = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!breakStatus) return null;

  // Break in progress - show countdown overlay
  if (isOnBreak) {
    const progress = ((5 * 60 - countdownSeconds) / (5 * 60)) * 100;

    return (
      <div style={styles.breakOverlay}>
        <div style={styles.breakContent}>
          <div style={{ marginBottom: 24 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
              <path d="M18 8h1a4 4 0 010 8h-1" />
              <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
              <line x1="6" y1="1" x2="6" y2="4" />
              <line x1="10" y1="1" x2="10" y2="4" />
              <line x1="14" y1="1" x2="14" y2="4" />
            </svg>
          </div>

          <div style={styles.breakTitle}>Mola Zamani</div>

          <div style={styles.countdownDisplay} className="mono">
            {formatCountdown(countdownSeconds)}
          </div>

          {/* Progress bar */}
          <div style={styles.progressBarContainer}>
            <div
              style={{
                ...styles.progressBarFill,
                width: `${progress}%`,
              }}
            />
          </div>

          {/* Tip */}
          <div style={styles.tipCard}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: 1 }}>
              Oneri
            </div>
            <div style={{ fontSize: 15, color: "var(--text-primary)", lineHeight: 1.5 }}>
              {STRETCHING_TIPS[tipIndex]}
            </div>
          </div>

          {countdownSeconds === 0 ? (
            <button style={styles.btnSuccess} onClick={handleEndBreak}>
              Calismaya Devam Et
            </button>
          ) : (
            <button style={styles.btnSecondary} onClick={handleEndBreak}>
              Molayi Erken Bitir
            </button>
          )}
        </div>
      </div>
    );
  }

  // Enforced break overlay (120+ minutes)
  if (showOverlay && breakStatus.break_enforced) {
    return (
      <div style={styles.enforcedOverlay}>
        <div style={styles.enforcedContent}>
          <div style={styles.enforcedIcon}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12,6 12,12 16,14" />
            </svg>
          </div>

          <div style={styles.enforcedTitle}>MOLA ZAMANI!</div>

          <div style={styles.enforcedMessage}>
            {breakStatus.minutes_since_break} dakikadir aralik vermeden calisiyorsun.
          </div>

          <div style={styles.enforcedSub}>
            Uzun sureli kesintisiz calisma verimliligi dusurur ve sagligina zarar verir.
            Kisa bir mola alarak hem kendini hem de isini koru.
          </div>

          <div style={{ display: "flex", flexDirection: "column" as const, gap: 12, marginTop: 24 }}>
            <button style={styles.btnSuccess} onClick={handleStartBreak}>
              Molaya Basladim (5dk)
            </button>
            <button style={styles.btnGhost} onClick={handleDismissReminder}>
              Biraz Sonra
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Gentle reminder (90+ minutes)
  if (breakStatus.break_recommended && !dismissed) {
    return (
      <div style={styles.reminderToast}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12,6 12,12 16,14" />
          </svg>
          <span style={{ fontSize: 13 }}>
            {breakStatus.minutes_since_break}dk aralik vermeden calisiyorsun. Kisa bir mola oneriyoruz.
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button style={styles.btnSmallSuccess} onClick={handleStartBreak}>
            Mola Al
          </button>
          <button style={styles.btnSmallGhost} onClick={handleDismissReminder}>
            Daha Sonra
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// --- Styles ---

const styles: Record<string, React.CSSProperties> = {
  // Break in progress overlay
  breakOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(10, 10, 20, 0.97)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(12px)",
  },
  breakContent: {
    textAlign: "center" as const,
    maxWidth: 400,
    padding: 40,
  },
  breakTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: "#22c55e",
    marginBottom: 16,
  },
  countdownDisplay: {
    fontSize: 72,
    fontWeight: 800,
    color: "var(--text-primary)",
    marginBottom: 24,
    letterSpacing: 4,
  },
  progressBarContainer: {
    width: "100%",
    height: 6,
    background: "var(--border)",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 32,
  },
  progressBarFill: {
    height: "100%",
    background: "linear-gradient(90deg, #22c55e, #4ade80)",
    borderRadius: 3,
    transition: "width 1s linear",
  },
  tipCard: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "16px 20px",
    marginBottom: 32,
    minHeight: 70,
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
  },

  // Enforced break overlay
  enforcedOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(10, 10, 20, 0.93)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(6px)",
  },
  enforcedContent: {
    textAlign: "center" as const,
    maxWidth: 440,
    padding: 40,
  },
  enforcedIcon: {
    marginBottom: 20,
  },
  enforcedTitle: {
    fontSize: 36,
    fontWeight: 800,
    color: "#f97316",
    letterSpacing: 3,
    marginBottom: 16,
    fontFamily: "'JetBrains Mono', monospace",
  },
  enforcedMessage: {
    fontSize: 18,
    color: "var(--text-primary)",
    marginBottom: 8,
  },
  enforcedSub: {
    fontSize: 13,
    color: "var(--text-secondary)",
    lineHeight: 1.6,
  },

  // Gentle reminder toast
  reminderToast: {
    position: "fixed",
    bottom: 80, // Above the enforcement overlay toast
    right: 24,
    zIndex: 9996,
    background: "var(--bg-card)",
    border: "1px solid #22c55e",
    borderRadius: "var(--radius)",
    padding: "14px 18px",
    maxWidth: 380,
    boxShadow: "0 8px 32px rgba(34, 197, 94, 0.15)",
  },

  // Buttons
  btnSuccess: {
    padding: "14px 32px",
    background: "#22c55e",
    color: "#000",
    border: "none",
    borderRadius: "var(--radius)",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    width: "100%",
  },
  btnSecondary: {
    padding: "12px 28px",
    background: "var(--bg-hover)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    width: "100%",
  },
  btnGhost: {
    padding: "10px 24px",
    background: "transparent",
    color: "var(--text-muted)",
    border: "none",
    borderRadius: "var(--radius)",
    fontWeight: 500,
    fontSize: 13,
    cursor: "pointer",
    width: "100%",
  },
  btnSmallSuccess: {
    padding: "6px 14px",
    background: "#22c55e",
    color: "#000",
    border: "none",
    borderRadius: "var(--radius)",
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
  },
  btnSmallGhost: {
    padding: "6px 14px",
    background: "transparent",
    color: "var(--text-muted)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    fontWeight: 500,
    fontSize: 12,
    cursor: "pointer",
  },
};
