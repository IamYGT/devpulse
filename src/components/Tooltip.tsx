import {
  useState,
  useRef,
  useEffect,
  useCallback,
  CSSProperties,
  ReactNode,
} from "react";

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

export default function Tooltip({
  content,
  children,
  position = "top",
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const tooltipId = useRef(`tooltip-${Math.random().toString(36).slice(2, 9)}`);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const tooltip = tooltipRef.current.getBoundingClientRect();
    const gap = 8;

    let top = 0;
    let left = 0;

    switch (position) {
      case "top":
        top = trigger.top - tooltip.height - gap;
        left = trigger.left + trigger.width / 2 - tooltip.width / 2;
        break;
      case "bottom":
        top = trigger.bottom + gap;
        left = trigger.left + trigger.width / 2 - tooltip.width / 2;
        break;
      case "left":
        top = trigger.top + trigger.height / 2 - tooltip.height / 2;
        left = trigger.left - tooltip.width - gap;
        break;
      case "right":
        top = trigger.top + trigger.height / 2 - tooltip.height / 2;
        left = trigger.right + gap;
        break;
    }

    /* Clamp to viewport */
    const padding = 8;
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltip.width - padding));
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltip.height - padding));

    setCoords({ top, left });
  }, [position]);

  const show = useCallback(() => {
    clearTimeout(hideTimer.current);
    showTimer.current = setTimeout(() => {
      setVisible(true);
    }, 300);
  }, []);

  const hide = useCallback(() => {
    clearTimeout(showTimer.current);
    hideTimer.current = setTimeout(() => {
      setVisible(false);
    }, 100);
  }, []);

  useEffect(() => {
    if (visible) {
      requestAnimationFrame(calculatePosition);
    }
  }, [visible, calculatePosition]);

  useEffect(() => {
    return () => {
      clearTimeout(showTimer.current);
      clearTimeout(hideTimer.current);
    };
  }, []);

  const wrapperStyle: CSSProperties = {
    display: "inline-flex",
  };

  const tooltipStyle: CSSProperties = {
    position: "fixed",
    top: `${coords.top}px`,
    left: `${coords.left}px`,
    zIndex: 10001,
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.4,
    maxWidth: "240px",
    pointerEvents: "none",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
    opacity: visible ? 1 : 0,
    transform: visible ? "scale(1)" : "scale(0.96)",
    transition: "opacity 0.15s ease, transform 0.15s ease",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };

  return (
    <>
      <div
        ref={triggerRef}
        style={wrapperStyle}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        aria-describedby={visible ? tooltipId.current : undefined}
      >
        {children}
      </div>
      {visible && (
        <div
          ref={tooltipRef}
          id={tooltipId.current}
          role="tooltip"
          style={tooltipStyle}
        >
          {content}
        </div>
      )}
    </>
  );
}

export type { TooltipProps };
