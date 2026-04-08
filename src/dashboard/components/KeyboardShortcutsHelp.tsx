import { useEffect, useCallback } from "react";

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  description: string;
}

const shortcuts: Shortcut[] = [
  { keys: ["Ctrl", "Shift", "D"], description: "Dashboard ac/kapa" },
  { keys: ["Ctrl", "Shift", "M"], description: "MiniBar goster/gizle" },
  { keys: ["Ctrl", "Shift", "P"], description: "Takibi duraklat/devam et" },
  { keys: ["Ctrl", "Shift", "T"], description: "Pomodoro baslat/duraklat" },
  { keys: ["Esc"], description: "Overlay kapat" },
];

export default function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#1e1e2e",
          borderRadius: "16px",
          padding: "32px",
          minWidth: "420px",
          maxWidth: "500px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <h2
          style={{
            margin: "0 0 24px 0",
            fontSize: "18px",
            fontWeight: 600,
            color: "#cdd6f4",
            textAlign: "center",
          }}
        >
          Klavye Kisayollari
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <span style={{ color: "#a6adc8", fontSize: "14px" }}>
                {shortcut.description}
              </span>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                {shortcut.keys.map((key, ki) => (
                  <span key={ki}>
                    <kbd
                      style={{
                        display: "inline-block",
                        padding: "4px 10px",
                        fontSize: "12px",
                        fontFamily: "monospace",
                        fontWeight: 600,
                        color: "#cdd6f4",
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: "6px",
                        boxShadow: "0 2px 0 rgba(0,0,0,0.3)",
                      }}
                    >
                      {key}
                    </kbd>
                    {ki < shortcut.keys.length - 1 && (
                      <span
                        style={{
                          color: "#585b70",
                          margin: "0 2px",
                          fontSize: "12px",
                        }}
                      >
                        +
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p
          style={{
            margin: "20px 0 0 0",
            textAlign: "center",
            fontSize: "12px",
            color: "#585b70",
          }}
        >
          <kbd
            style={{
              padding: "2px 8px",
              fontSize: "11px",
              fontFamily: "monospace",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "4px",
              color: "#a6adc8",
            }}
          >
            ?
          </kbd>{" "}
          tusu ile bu paneli acabilirsiniz
        </p>
      </div>
    </div>
  );
}
