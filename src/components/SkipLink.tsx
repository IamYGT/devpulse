import { CSSProperties } from "react";

const skipLinkStyle: CSSProperties = {
  position: "absolute",
  left: "-9999px",
  top: "auto",
  width: "1px",
  height: "1px",
  overflow: "hidden",
  zIndex: 9999,
  padding: "12px 24px",
  background: "var(--accent-blue)",
  color: "#fff",
  fontSize: "14px",
  fontWeight: 600,
  borderRadius: "var(--radius)",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const skipLinkFocusStyle: CSSProperties = {
  position: "fixed",
  left: "16px",
  top: "16px",
  width: "auto",
  height: "auto",
  overflow: "visible",
  boxShadow: "0 0 0 3px rgba(99, 102, 241, 0.4)",
};

export default function SkipLink() {
  return (
    <a
      href="#main-content"
      style={skipLinkStyle}
      onFocus={(e) => {
        Object.assign(e.currentTarget.style, skipLinkFocusStyle);
      }}
      onBlur={(e) => {
        e.currentTarget.style.position = "absolute";
        e.currentTarget.style.left = "-9999px";
        e.currentTarget.style.width = "1px";
        e.currentTarget.style.height = "1px";
        e.currentTarget.style.overflow = "hidden";
      }}
    >
      Icerige Atla
    </a>
  );
}
