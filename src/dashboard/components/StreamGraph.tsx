import { useState, useMemo } from "react";

interface ProjectHours {
  name: string;
  hours: number;
}

interface DayData {
  date: string;
  projects: ProjectHours[];
}

interface Props {
  data: DayData[];
}

const WIDTH = 600;
const HEIGHT = 260;
const PADDING = { top: 20, right: 20, bottom: 30, left: 40 };
const CHART_W = WIDTH - PADDING.left - PADDING.right;
const CHART_H = HEIGHT - PADDING.top - PADDING.bottom;

const PROJECT_COLORS = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#22c55e",
  "#f59e0b", "#ef4444", "#ec4899", "#14b8a6",
  "#f97316", "#6366f1",
];

const DAY_LABELS = ["Pzt", "Sal", "Car", "Per", "Cum", "Cmt", "Paz"];

function bezierCommand(point: [number, number], i: number, points: [number, number][]): string {
  if (i === 0) return `L ${point[0]},${point[1]}`;

  const prev = points[i - 1];
  const cpx1 = prev[0] + (point[0] - prev[0]) * 0.4;
  const cpx2 = point[0] - (point[0] - prev[0]) * 0.4;

  return `C ${cpx1},${prev[1]} ${cpx2},${point[1]} ${point[0]},${point[1]}`;
}

function buildSmoothPath(points: [number, number][]): string {
  return points.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt[0]},${pt[1]}`;
    return acc + " " + bezierCommand(pt, i, points);
  }, "");
}

export default function StreamGraph({ data }: Props) {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  // Collect all unique project names
  const projectNames = useMemo(() => {
    const names = new Set<string>();
    data.forEach((d) => d.projects.forEach((p) => names.add(p.name)));
    return Array.from(names);
  }, [data]);

  // Build stacked values per day
  const stackedData = useMemo(() => {
    const maxTotal = Math.max(
      ...data.map((d) => d.projects.reduce((s, p) => s + p.hours, 0)),
      1
    );
    const yScale = CHART_H / (Math.ceil(maxTotal) || 1);

    return data.map((day, dayIdx) => {
      const x = (dayIdx / Math.max(data.length - 1, 1)) * CHART_W;
      let cumulative = 0;
      const layers = projectNames.map((name) => {
        const found = day.projects.find((p) => p.name === name);
        const hours = found?.hours ?? 0;
        const y0 = cumulative;
        cumulative += hours;
        return { name, hours, y0, y1: cumulative };
      });
      return { x, layers, total: cumulative, yScale };
    });
  }, [data, projectNames]);

  const maxTotal = Math.max(...stackedData.map((d) => d.total), 1);
  const yMax = Math.ceil(maxTotal);
  const yScale = CHART_H / yMax;

  // Build area paths per project
  const areaPaths = projectNames.map((name, pi) => {
    const topPoints: [number, number][] = stackedData.map((d) => {
      const layer = d.layers.find((l) => l.name === name)!;
      return [d.x, CHART_H - layer.y1 * yScale];
    });

    const bottomPoints: [number, number][] = [...stackedData]
      .reverse()
      .map((d) => {
        const layer = d.layers.find((l) => l.name === name)!;
        return [d.x, CHART_H - layer.y0 * yScale];
      });

    const topPath = buildSmoothPath(topPoints);
    const bottomPath = buildSmoothPath(bottomPoints);
    const fullPath = topPath + " " + bottomPath.replace("M", "L") + " Z";

    return { name, path: fullPath, color: PROJECT_COLORS[pi % PROJECT_COLORS.length] };
  });

  // Y-axis ticks
  const yTicks = Array.from({ length: Math.min(yMax + 1, 6) }, (_, i) => {
    const val = Math.round((i / Math.min(yMax, 5)) * yMax);
    return val;
  });

  return (
    <div style={{ position: "relative" }}>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <defs>
          {areaPaths.map((ap, i) => (
            <linearGradient
              key={`grad-${i}`}
              id={`stream-grad-${i}`}
              x1="0" y1="0" x2="0" y2="1"
            >
              <stop offset="0%" stopColor={ap.color} stopOpacity={0.7} />
              <stop offset="100%" stopColor={ap.color} stopOpacity={0.2} />
            </linearGradient>
          ))}
        </defs>

        <g transform={`translate(${PADDING.left},${PADDING.top})`}>
          {/* Y-axis grid lines */}
          {yTicks.map((val) => (
            <g key={`ytick-${val}`}>
              <line
                x1={0}
                y1={CHART_H - val * yScale}
                x2={CHART_W}
                y2={CHART_H - val * yScale}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
              <text
                x={-6}
                y={CHART_H - val * yScale}
                textAnchor="end"
                dominantBaseline="middle"
                fill="rgba(255,255,255,0.4)"
                fontSize={9}
              >
                {val}s
              </text>
            </g>
          ))}

          {/* Area layers */}
          {areaPaths.map((ap, i) => (
            <path
              key={`area-${i}`}
              d={ap.path}
              fill={`url(#stream-grad-${i})`}
              stroke={ap.color}
              strokeWidth={1}
              opacity={0.9}
            />
          ))}

          {/* X-axis day labels */}
          {data.map((_, i) => {
            const x = (i / Math.max(data.length - 1, 1)) * CHART_W;
            return (
              <text
                key={`xlabel-${i}`}
                x={x}
                y={CHART_H + 16}
                textAnchor="middle"
                fill="rgba(255,255,255,0.5)"
                fontSize={10}
              >
                {DAY_LABELS[i] ?? data[i].date}
              </text>
            );
          })}

          {/* Hover column zones */}
          {data.map((_, i) => {
            const x = (i / Math.max(data.length - 1, 1)) * CHART_W;
            const colW = CHART_W / Math.max(data.length - 1, 1);
            return (
              <rect
                key={`hover-${i}`}
                x={x - colW / 2}
                y={0}
                width={colW}
                height={CHART_H}
                fill="transparent"
                onMouseEnter={() => setHoveredDay(i)}
                onMouseLeave={() => setHoveredDay(null)}
                style={{ cursor: "crosshair" }}
              />
            );
          })}

          {/* Hover vertical line */}
          {hoveredDay !== null && (
            <line
              x1={(hoveredDay / Math.max(data.length - 1, 1)) * CHART_W}
              y1={0}
              x2={(hoveredDay / Math.max(data.length - 1, 1)) * CHART_W}
              y2={CHART_H}
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={1}
              strokeDasharray="3 3"
              pointerEvents="none"
            />
          )}
        </g>
      </svg>

      {/* Hover tooltip */}
      {hoveredDay !== null && data[hoveredDay] && (
        <div
          style={{
            position: "absolute",
            left: PADDING.left + (hoveredDay / Math.max(data.length - 1, 1)) * CHART_W + 10,
            top: PADDING.top,
            background: "rgba(15,15,40,0.95)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 6,
            padding: "8px 12px",
            pointerEvents: "none",
            zIndex: 10,
            minWidth: 120,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.6)",
              marginBottom: 4,
            }}
          >
            {data[hoveredDay].date}
          </div>
          {data[hoveredDay].projects.map((p, pi) => (
            <div
              key={pi}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                fontSize: 11,
                color: "#fff",
                lineHeight: "18px",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background:
                      PROJECT_COLORS[
                        projectNames.indexOf(p.name) % PROJECT_COLORS.length
                      ],
                    display: "inline-block",
                  }}
                />
                {p.name}
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {p.hours.toFixed(1)}s
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginTop: 4,
          paddingLeft: PADDING.left,
        }}
      >
        {projectNames.map((name, i) => (
          <div
            key={name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10,
              color: "rgba(255,255,255,0.6)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: PROJECT_COLORS[i % PROJECT_COLORS.length],
              }}
            />
            {name}
          </div>
        ))}
      </div>
    </div>
  );
}
