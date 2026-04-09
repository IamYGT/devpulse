import { useEffect, useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";

interface TimelineEntry {
  project_name: string;
  start_time: string;
  end_time: string;
  category: string;
}

const START_HOUR = 8;
const END_HOUR = 22;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const ROW_HEIGHT = 24;
const HEADER_HEIGHT = 28;
const LEFT_LABEL_WIDTH = 120;
const WIDTH = 600;
const CHART_WIDTH = WIDTH - LEFT_LABEL_WIDTH;

const CATEGORY_COLORS: Record<string, string> = {
  productive: "#3b82f6",
  distracting: "#ef4444",
  neutral: "#555577",
};

function timeToMinutes(timeStr: string): number {
  const d = new Date(timeStr);
  return d.getHours() * 60 + d.getMinutes();
}

function minutesToX(minutes: number): number {
  const startMin = START_HOUR * 60;
  const endMin = END_HOUR * 60;
  const clamped = Math.max(startMin, Math.min(endMin, minutes));
  return ((clamped - startMin) / (endMin - startMin)) * CHART_WIDTH;
}

function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export default function GanttChart() {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [currentMinute, setCurrentMinute] = useState(
    new Date().getHours() * 60 + new Date().getMinutes()
  );

  useEffect(() => {
    invoke<TimelineEntry[]>("get_today_timeline")
      .then(setEntries)
      .catch(() => setEntries([]));
  }, []);

  // Update current time every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentMinute(now.getHours() * 60 + now.getMinutes());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Group entries by project
  const grouped = useMemo(() => {
    const map = new Map<string, { entry: TimelineEntry; start: number; end: number }[]>();
    entries.forEach((e) => {
      const start = timeToMinutes(e.start_time);
      const end = timeToMinutes(e.end_time);
      if (!map.has(e.project_name)) map.set(e.project_name, []);
      map.get(e.project_name)!.push({ entry: e, start, end });
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [entries]);

  const totalHeight = HEADER_HEIGHT + grouped.length * ROW_HEIGHT + 4;

  // Hour markers
  const hourMarkers = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i);

  const [hoveredBar, setHoveredBar] = useState<{
    project: string;
    start: number;
    end: number;
    x: number;
    y: number;
  } | null>(null);

  return (
    <div style={{ position: "relative" }}>
      <svg width={WIDTH} height={totalHeight} viewBox={`0 0 ${WIDTH} ${totalHeight}`}>
        {/* Header: hour labels */}
        {hourMarkers.map((hour) => {
          const x = LEFT_LABEL_WIDTH + minutesToX(hour * 60);
          return (
            <g key={`h-${hour}`}>
              <line
                x1={x}
                y1={HEADER_HEIGHT}
                x2={x}
                y2={totalHeight}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
              {hour % 2 === 0 && (
                <text
                  x={x}
                  y={12}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.4)"
                  fontSize={9}
                  fontFamily="monospace"
                >
                  {formatHourLabel(hour)}
                </text>
              )}
            </g>
          );
        })}

        {/* Rows */}
        {grouped.map(([projectName, sessions], rowIdx) => {
          const y = HEADER_HEIGHT + rowIdx * ROW_HEIGHT;

          return (
            <g key={projectName}>
              {/* Row background */}
              {rowIdx % 2 === 0 && (
                <rect
                  x={0}
                  y={y}
                  width={WIDTH}
                  height={ROW_HEIGHT}
                  fill="rgba(255,255,255,0.02)"
                />
              )}

              {/* Project label */}
              <text
                x={LEFT_LABEL_WIDTH - 8}
                y={y + ROW_HEIGHT / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fill="rgba(255,255,255,0.7)"
                fontSize={10}
              >
                {projectName.length > 16
                  ? projectName.slice(0, 15) + "\u2026"
                  : projectName}
              </text>

              {/* Session bars */}
              {sessions.map((s, si) => {
                const barX = LEFT_LABEL_WIDTH + minutesToX(s.start);
                const barW = Math.max(minutesToX(s.end) - minutesToX(s.start), 2);
                const color =
                  CATEGORY_COLORS[s.entry.category] ?? CATEGORY_COLORS.neutral;

                return (
                  <rect
                    key={`bar-${si}`}
                    x={barX}
                    y={y + 3}
                    width={barW}
                    height={ROW_HEIGHT - 6}
                    rx={3}
                    fill={color}
                    opacity={0.85}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() =>
                      setHoveredBar({
                        project: projectName,
                        start: s.start,
                        end: s.end,
                        x: barX + barW / 2,
                        y: y,
                      })
                    }
                    onMouseLeave={() => setHoveredBar(null)}
                  />
                );
              })}
            </g>
          );
        })}

        {/* Current time indicator */}
        {currentMinute >= START_HOUR * 60 && currentMinute <= END_HOUR * 60 && (
          <g>
            <line
              x1={LEFT_LABEL_WIDTH + minutesToX(currentMinute)}
              y1={HEADER_HEIGHT - 4}
              x2={LEFT_LABEL_WIDTH + minutesToX(currentMinute)}
              y2={totalHeight}
              stroke="#ef4444"
              strokeWidth={1.5}
            />
            <polygon
              points={`
                ${LEFT_LABEL_WIDTH + minutesToX(currentMinute) - 4},${HEADER_HEIGHT - 4}
                ${LEFT_LABEL_WIDTH + minutesToX(currentMinute) + 4},${HEADER_HEIGHT - 4}
                ${LEFT_LABEL_WIDTH + minutesToX(currentMinute)},${HEADER_HEIGHT + 2}
              `}
              fill="#ef4444"
            />
          </g>
        )}

        {/* Hover tooltip */}
        {hoveredBar && (
          <g>
            <rect
              x={hoveredBar.x - 50}
              y={hoveredBar.y - 26}
              width={100}
              height={22}
              rx={4}
              fill="rgba(15,15,40,0.95)"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1}
            />
            <text
              x={hoveredBar.x}
              y={hoveredBar.y - 15}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#fff"
              fontSize={10}
              fontFamily="monospace"
            >
              {`${Math.floor(hoveredBar.start / 60)}:${String(hoveredBar.start % 60).padStart(2, "0")} - ${Math.floor(hoveredBar.end / 60)}:${String(hoveredBar.end % 60).padStart(2, "0")}`}
            </text>
          </g>
        )}
      </svg>

      {grouped.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "16px 0",
            color: "rgba(255,255,255,0.4)",
            fontSize: 12,
          }}
        >
          Henuz calisma oturumu yok
        </div>
      )}
    </div>
  );
}
