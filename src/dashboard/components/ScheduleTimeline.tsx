import { useState, useEffect, useRef } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ScheduleBlock {
  id: number;
  date: string;
  project_id: number;
  project_name: string;
  start_time: string;
  end_time: string;
  priority: string;
  status: string;
  actual_minutes: number;
}

interface Props {
  blocks: ScheduleBlock[];
  onBlockClick: (block: ScheduleBlock) => void;
  onSlotClick: (hour: number) => void;
  startHour?: number;
  endHour?: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const PROJECT_COLORS = [
  "#6366f1", "#22c55e", "#f97316", "#a855f7", "#ef4444",
  "#eab308", "#06b6d4", "#ec4899", "#14b8a6", "#f43f5e",
];

function getProjectColor(projectId: number): string {
  return PROJECT_COLORS[projectId % PROJECT_COLORS.length];
}

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function priorityBadge(p: string): { label: string; bg: string } {
  switch (p) {
    case "P0": return { label: "P0", bg: "var(--accent-red)" };
    case "P1": return { label: "P1", bg: "var(--accent-orange)" };
    case "P2": return { label: "P2", bg: "var(--accent-blue)" };
    default:   return { label: p, bg: "var(--text-muted)" };
  }
}

function statusIcon(s: string): string {
  switch (s) {
    case "active":    return "\u25B6";
    case "completed": return "\u2713";
    case "skipped":   return "\u2717";
    default:          return "\u25CB";
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ScheduleTimeline({
  blocks,
  onBlockClick,
  onSlotClick,
  startHour = 7,
  endHour = 22,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(new Date());

  // Update current time every 30s
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(iv);
  }, []);

  // Scroll to current time on mount
  useEffect(() => {
    if (containerRef.current) {
      const currentMinute = now.getHours() * 60 + now.getMinutes();
      const scrollTarget = ((currentMinute - startHour * 60) / ((endHour - startHour) * 60)) * containerRef.current.scrollHeight;
      containerRef.current.scrollTop = Math.max(0, scrollTarget - 200);
    }
  }, []);

  const totalMinutes = (endHour - startHour) * 60;
  const hourHeight = 72; // px per hour
  const totalHeight = (endHour - startHour) * hourHeight;

  // Current time indicator position
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowOffset = ((nowMinutes - startHour * 60) / totalMinutes) * totalHeight;
  const showNowLine = nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60;

  // Build hour labels
  const hours: number[] = [];
  for (let h = startHour; h <= endHour; h++) hours.push(h);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      <div style={{ position: "relative", height: totalHeight, minHeight: totalHeight }}>
        {/* Hour grid lines and labels */}
        {hours.map((h) => {
          const top = (h - startHour) * hourHeight;
          return (
            <div key={h} style={{ position: "absolute", top, left: 0, right: 0 }}>
              {/* Hour label */}
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: -8,
                  width: 48,
                  textAlign: "right",
                  fontSize: 11,
                  color: "var(--text-muted)",
                  fontFamily: "monospace",
                  userSelect: "none",
                }}
              >
                {String(h).padStart(2, "0")}:00
              </span>
              {/* Grid line */}
              <div
                style={{
                  position: "absolute",
                  left: 56,
                  right: 0,
                  height: 1,
                  background: "var(--border)",
                  opacity: 0.5,
                }}
              />
              {/* Clickable slot area */}
              <div
                onClick={() => onSlotClick(h)}
                style={{
                  position: "absolute",
                  left: 56,
                  right: 0,
                  top: 0,
                  height: hourHeight,
                  cursor: "pointer",
                  borderRadius: 4,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "rgba(99,102,241,0.04)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "transparent";
                }}
              />
            </div>
          );
        })}

        {/* Schedule blocks */}
        {blocks.map((block) => {
          const blockStart = parseTime(block.start_time);
          const blockEnd = parseTime(block.end_time);
          const top = ((blockStart - startHour * 60) / totalMinutes) * totalHeight;
          const height = ((blockEnd - blockStart) / totalMinutes) * totalHeight;
          const color = getProjectColor(block.project_id);
          const badge = priorityBadge(block.priority);
          const duration = blockEnd - blockStart;
          const isCompact = height < 48;

          return (
            <div
              key={block.id}
              onClick={(e) => { e.stopPropagation(); onBlockClick(block); }}
              style={{
                position: "absolute",
                top,
                left: 60,
                right: 8,
                height: Math.max(height, 28),
                background: `${color}18`,
                borderLeft: `3px solid ${color}`,
                borderRadius: "0 8px 8px 0",
                padding: isCompact ? "2px 10px" : "8px 12px",
                cursor: "pointer",
                zIndex: 2,
                display: "flex",
                flexDirection: isCompact ? "row" : "column",
                gap: isCompact ? 8 : 4,
                alignItems: isCompact ? "center" : "flex-start",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
                overflow: "hidden",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = "scale(1.01)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = `0 2px 12px ${color}33`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = "scale(1)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
              }}
            >
              {/* Project name + status */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>{statusIcon(block.status)}</span>
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 13,
                    color: "var(--text-primary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {block.project_name}
                </span>
              </div>

              {/* Time + Priority + Duration */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "monospace" }}>
                  {block.start_time}-{block.end_time}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#fff",
                    background: badge.bg,
                    borderRadius: 4,
                    padding: "1px 5px",
                  }}
                >
                  {badge.label}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {duration} dk
                </span>
              </div>

              {/* Actual vs planned (if completed) */}
              {!isCompact && block.actual_minutes > 0 && (
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                  Gercek: {block.actual_minutes} dk / Planli: {duration} dk
                </div>
              )}
            </div>
          );
        })}

        {/* Current time indicator (red line) */}
        {showNowLine && (
          <div
            style={{
              position: "absolute",
              top: nowOffset,
              left: 48,
              right: 0,
              height: 2,
              background: "var(--accent-red)",
              zIndex: 10,
              pointerEvents: "none",
            }}
          >
            {/* Red dot */}
            <div
              style={{
                position: "absolute",
                left: -4,
                top: -3,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--accent-red)",
              }}
            />
            {/* Time label */}
            <span
              style={{
                position: "absolute",
                right: 4,
                top: -16,
                fontSize: 10,
                fontWeight: 700,
                color: "var(--accent-red)",
                fontFamily: "monospace",
              }}
            >
              {String(now.getHours()).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}
            </span>
          </div>
        )}

        {/* Lunch indicator */}
        <div
          style={{
            position: "absolute",
            top: ((12 * 60 - startHour * 60) / totalMinutes) * totalHeight,
            left: 56,
            right: 0,
            height: (60 / totalMinutes) * totalHeight,
            background: "rgba(255,255,255,0.03)",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          <span style={{ fontSize: 12, color: "var(--text-muted)", opacity: 0.6 }}>
            Ogle Arasi
          </span>
        </div>
      </div>
    </div>
  );
}
