import { useMemo } from "react";
import type { TimelineEntry } from "../../types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ProjectTimelineProps {
  timeline: TimelineEntry[];
  isTracking?: boolean;
}

interface TimelineBlock {
  label: string;
  category: string;
  startTime: string;
  durationSeconds: number;
  isLast: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTime(date: Date): string {
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 1) return "<1dk";
  const h = Math.floor(m / 60);
  const mins = m % 60;
  if (h > 0) return `${h}s ${mins}dk`;
  return `${mins}dk`;
}

function categoryColor(cat: string): string {
  if (cat === "productive") return "var(--accent-green)";
  if (cat === "distracting") return "var(--accent-red)";
  return "var(--text-muted)";
}

function categoryBg(cat: string): string {
  if (cat === "productive") return "rgba(34, 197, 94, 0.10)";
  if (cat === "distracting") return "rgba(239, 68, 68, 0.10)";
  return "rgba(85, 85, 119, 0.08)";
}

/**
 * Merge consecutive timeline entries with the same project/process into blocks.
 */
function buildBlocks(timeline: TimelineEntry[]): TimelineBlock[] {
  if (timeline.length === 0) return [];

  const blocks: TimelineBlock[] = [];
  let currentLabel = timeline[0].project_name || timeline[0].process_name;
  let currentCategory = timeline[0].is_idle ? "idle" : timeline[0].category;
  let currentStart = timeline[0].timestamp;
  let currentDuration = timeline[0].duration_seconds;

  for (let i = 1; i < timeline.length; i++) {
    const entry = timeline[i];
    const label = entry.project_name || entry.process_name;
    const category = entry.is_idle ? "idle" : entry.category;

    if (label === currentLabel && category === currentCategory) {
      currentDuration += entry.duration_seconds;
    } else {
      blocks.push({
        label: currentLabel,
        category: currentCategory,
        startTime: currentStart,
        durationSeconds: currentDuration,
        isLast: false,
      });
      currentLabel = label;
      currentCategory = category;
      currentStart = entry.timestamp;
      currentDuration = entry.duration_seconds;
    }
  }

  // Push the last block
  blocks.push({
    label: currentLabel,
    category: currentCategory,
    startTime: currentStart,
    durationSeconds: currentDuration,
    isLast: true,
  });

  return blocks;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ProjectTimeline({ timeline, isTracking }: ProjectTimelineProps) {
  const blocks = useMemo(() => buildBlocks(timeline), [timeline]);

  if (blocks.length === 0) {
    return (
      <div className="card">
        <div className="card-title">Proje Zaman Cizelgesi</div>
        <div
          style={{
            textAlign: "center",
            padding: "32px 20px",
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          Henuz zaman cizelgesi verisi yok.
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">Proje Zaman Cizelgesi</div>

      <div
        style={{
          maxHeight: 420,
          overflowY: "auto",
          paddingRight: 4,
        }}
      >
        {blocks.map((block, i) => {
          const startDate = new Date(block.startTime);
          const isIdle = block.category === "idle";

          return (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 14,
                minHeight: 48,
                position: "relative",
              }}
            >
              {/* Time column */}
              <div
                className="mono"
                style={{
                  width: 48,
                  flexShrink: 0,
                  fontSize: 11,
                  color: "var(--text-muted)",
                  paddingTop: 4,
                  textAlign: "right",
                }}
              >
                {formatTime(startDate)}
              </div>

              {/* Vertical line + dot */}
              <div
                style={{
                  width: 16,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flexShrink: 0,
                  position: "relative",
                }}
              >
                {/* Dot */}
                <div
                  style={{
                    width: block.isLast && isTracking ? 10 : 8,
                    height: block.isLast && isTracking ? 10 : 8,
                    borderRadius: "50%",
                    background: isIdle
                      ? "var(--accent-yellow)"
                      : categoryColor(block.category),
                    flexShrink: 0,
                    marginTop: 5,
                    boxShadow:
                      block.isLast && isTracking
                        ? `0 0 8px ${categoryColor(block.category)}`
                        : "none",
                    animation:
                      block.isLast && isTracking
                        ? "pulse-dot 2s infinite"
                        : "none",
                  }}
                />
                {/* Line */}
                {i < blocks.length - 1 && (
                  <div
                    style={{
                      width: 1,
                      flex: 1,
                      background: "var(--border)",
                      marginTop: 4,
                    }}
                  />
                )}
              </div>

              {/* Content */}
              <div
                style={{
                  flex: 1,
                  paddingBottom: 12,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: isIdle ? "rgba(234, 179, 8, 0.08)" : categoryBg(block.category),
                    borderLeft: `3px solid ${isIdle ? "var(--accent-yellow)" : categoryColor(block.category)}`,
                    maxWidth: "100%",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      opacity: isIdle ? 0.6 : 1,
                    }}
                  >
                    {isIdle ? "Bosta" : block.label}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      flexShrink: 0,
                    }}
                  >
                    {formatDuration(block.durationSeconds)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pulse animation for current activity */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
