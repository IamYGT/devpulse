import { useEffect, CSSProperties, ReactNode } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  closeOnOverlay?: boolean;
}

const sizeMap: Record<string, string> = {
  sm: "400px",
  md: "560px",
  lg: "720px",
};

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  closeOnOverlay = true,
}: ModalProps) {
  const focusRef = useFocusTrap(isOpen);

  /* Escape key closes */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  /* Lock body scroll */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const titleId = "modal-title";

  const backdropStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 9000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0, 0, 0, 0.6)",
    backdropFilter: "blur(4px)",
    animation: "modal-fade-in 0.2s ease",
  };

  const dialogStyle: CSSProperties = {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    width: "90vw",
    maxWidth: sizeMap[size],
    maxHeight: "85vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 16px 48px rgba(0, 0, 0, 0.5)",
    animation: "modal-scale-in 0.2s ease",
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  };

  const titleStyle: CSSProperties = {
    fontSize: "16px",
    fontWeight: 700,
    color: "var(--text-primary)",
    margin: 0,
  };

  const closeBtnStyle: CSSProperties = {
    background: "none",
    border: "1px solid transparent",
    borderRadius: "6px",
    color: "var(--text-muted)",
    fontSize: "18px",
    cursor: "pointer",
    padding: "4px 8px",
    lineHeight: 1,
    transition: "all 0.2s ease",
  };

  const bodyStyle: CSSProperties = {
    padding: "20px",
    overflowY: "auto",
    flex: 1,
  };

  return (
    <>
      <style>{`
        @keyframes modal-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modal-scale-in {
          from { transform: scale(0.95); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
      `}</style>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        style={backdropStyle}
        onClick={closeOnOverlay ? onClose : undefined}
      >
        <div
          ref={focusRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          style={dialogStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={headerStyle}>
            <h2 id={titleId} style={titleStyle}>
              {title}
            </h2>
            <button
              style={closeBtnStyle}
              onClick={onClose}
              aria-label="Kapat"
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text-primary)";
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.background = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.borderColor = "transparent";
                e.currentTarget.style.background = "none";
              }}
            >
              ✕
            </button>
          </div>
          <div style={bodyStyle}>{children}</div>
        </div>
      </div>
    </>
  );
}

export type { ModalProps };
