import {
  useState,
  useCallback,
  useEffect,
  useRef,
  CSSProperties,
  ReactNode,
  createContext,
  useContext,
} from "react";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/* ── Colours per type ─────────────────────────────────────── */
const colours: Record<ToastType, { bg: string; border: string; icon: string }> =
  {
    success: {
      bg: "rgba(34,197,94,0.12)",
      border: "var(--accent-green)",
      icon: "✓",
    },
    error: {
      bg: "rgba(239,68,68,0.12)",
      border: "var(--accent-red)",
      icon: "✕",
    },
    warning: {
      bg: "rgba(234,179,8,0.12)",
      border: "var(--accent-yellow)",
      icon: "⚠",
    },
    info: {
      bg: "rgba(99,102,241,0.12)",
      border: "var(--accent-blue)",
      icon: "ℹ",
    },
  };

/* ── Single toast item ────────────────────────────────────── */
function ToastItem({
  toast,
  onRemove,
}: {
  toast: ToastMessage;
  onRemove: (id: string) => void;
}) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const duration = toast.duration ?? 5000;
    timerRef.current = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, duration);
    return () => clearTimeout(timerRef.current);
  }, [toast, onRemove]);

  const c = colours[toast.type];

  const style: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 16px",
    background: c.bg,
    border: `1px solid ${c.border}`,
    borderRadius: "var(--radius)",
    color: "var(--text-primary)",
    fontSize: "13px",
    fontWeight: 500,
    backdropFilter: "blur(12px)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    transform: exiting ? "translateX(120%)" : "translateX(0)",
    opacity: exiting ? 0 : 1,
    transition: "transform 0.3s ease, opacity 0.3s ease",
    animation: "toast-enter 0.3s ease",
    pointerEvents: "auto" as const,
    maxWidth: "360px",
    wordBreak: "break-word" as const,
  };

  const iconStyle: CSSProperties = {
    fontSize: "16px",
    color: c.border,
    flexShrink: 0,
    width: "20px",
    textAlign: "center",
  };

  const closeStyle: CSSProperties = {
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    padding: "2px 6px",
    fontSize: "14px",
    marginLeft: "auto",
    flexShrink: 0,
    borderRadius: "4px",
    transition: "color 0.2s",
  };

  return (
    <div role="alert" aria-live="assertive" style={style}>
      <span style={iconStyle} aria-hidden="true">
        {c.icon}
      </span>
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        style={closeStyle}
        onClick={() => {
          setExiting(true);
          setTimeout(() => onRemove(toast.id), 300);
        }}
        aria-label="Bildirimi kapat"
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--text-primary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--text-muted)";
        }}
      >
        ✕
      </button>
    </div>
  );
}

/* ── Container ────────────────────────────────────────────── */
function ToastContainer({ toasts, onRemove }: { toasts: ToastMessage[]; onRemove: (id: string) => void }) {
  const containerStyle: CSSProperties = {
    position: "fixed",
    top: "16px",
    right: "16px",
    zIndex: 10000,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    pointerEvents: "none",
  };

  return (
    <>
      <style>{`
        @keyframes toast-enter {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
      <div style={containerStyle}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={onRemove} />
        ))}
      </div>
    </>
  );
}

/* ── Provider ─────────────────────────────────────────────── */
let idCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, duration?: number) => {
      const id = `toast-${++idCounter}-${Date.now()}`;
      setToasts((prev) => [...prev, { id, type, message, duration }]);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

/* ── Hook ─────────────────────────────────────────────────── */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx;
}

export type { ToastMessage, ToastType };
