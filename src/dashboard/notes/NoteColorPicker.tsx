import { type CSSProperties } from "react";

/* ------------------------------------------------------------------ */
/*  Preset colors                                                      */
/* ------------------------------------------------------------------ */

interface ColorOption {
  label: string;
  value: string | null;
}

const presetColors: ColorOption[] = [
  { label: "Varsayilan", value: null },
  { label: "Kirmizi", value: "#fca5a5" },
  { label: "Turuncu", value: "#fdba74" },
  { label: "Sari", value: "#fde68a" },
  { label: "Yesil", value: "#86efac" },
  { label: "Mavi", value: "#93c5fd" },
  { label: "Mor", value: "#c4b5fd" },
  { label: "Gri", value: "#d1d5db" },
];

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface NoteColorPickerProps {
  color: string | null;
  onChange: (color: string | null) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function NoteColorPicker({ color, onChange }: NoteColorPickerProps) {
  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
  };

  return (
    <div style={rowStyle} role="radiogroup" aria-label="Not rengi">
      {presetColors.map((opt) => {
        const isActive = color === opt.value;
        const isDefault = opt.value === null;

        const circleStyle: CSSProperties = {
          width: 24,
          height: 24,
          borderRadius: "50%",
          border: isDefault
            ? "2px dashed var(--border)"
            : "2px solid transparent",
          background: opt.value ?? "transparent",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
          transform: isActive ? "scale(1.15)" : "scale(1)",
          boxShadow: isActive
            ? `0 0 0 2px var(--bg-card), 0 0 0 4px ${opt.value ?? "var(--accent-blue)"}`
            : "none",
          position: "relative",
        };

        const checkStyle: CSSProperties = {
          fontSize: 12,
          fontWeight: 700,
          color: isDefault ? "var(--text-muted)" : "#1a1a2e",
          lineHeight: 1,
        };

        return (
          <button
            key={opt.label}
            role="radio"
            aria-checked={isActive}
            aria-label={opt.label}
            style={{
              ...circleStyle,
              padding: 0,
              outline: "none",
            }}
            onClick={() => onChange(opt.value)}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.transform = "scale(1.1)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.transform = "scale(1)";
              }
            }}
          >
            {isActive && <span style={checkStyle}>&#x2713;</span>}
          </button>
        );
      })}
    </div>
  );
}
