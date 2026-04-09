import { useEffect, useRef, useState } from "react";

interface Props {
  current: number[];
  previous: number[];
  labels: string[];
}

const SIZE = 300;
const CENTER = SIZE / 2;
const RADIUS = 110;
const LEVELS = 5;
const ANIMATION_DURATION = 800;

function polarToCartesian(
  angle: number,
  radius: number
): { x: number; y: number } {
  const rad = (Math.PI / 2 - (angle * Math.PI) / 180) * -1 + Math.PI / 2;
  return {
    x: CENTER + radius * Math.cos(rad - Math.PI / 2),
    y: CENTER + radius * Math.sin(rad - Math.PI / 2),
  };
}

function buildPolygonPoints(
  values: number[],
  scale: number = 1
): string {
  const step = 360 / values.length;
  return values
    .map((v, i) => {
      const r = (v / 100) * RADIUS * scale;
      const { x, y } = polarToCartesian(step * i, r);
      return `${x},${y}`;
    })
    .join(" ");
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function RadarChart({ current, previous, labels }: Props) {
  const [animScale, setAnimScale] = useState(0);
  const [hoveredAxis, setHoveredAxis] = useState<number | null>(null);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    startRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);
      setAnimScale(easeOutCubic(progress));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [current, previous]);

  const axisCount = labels.length;
  const step = 360 / axisCount;

  // Grid lines (concentric polygons)
  const gridPolygons = Array.from({ length: LEVELS }, (_, i) => {
    const r = ((i + 1) / LEVELS) * RADIUS;
    const pts = Array.from({ length: axisCount }, (_, j) => {
      const { x, y } = polarToCartesian(step * j, r);
      return `${x},${y}`;
    }).join(" ");
    return pts;
  });

  // Axis lines from center to edge
  const axisLines = Array.from({ length: axisCount }, (_, i) => {
    const { x, y } = polarToCartesian(step * i, RADIUS);
    return { x, y };
  });

  // Axis label positions
  const labelPositions = Array.from({ length: axisCount }, (_, i) => {
    const { x, y } = polarToCartesian(step * i, RADIUS + 22);
    return { x, y };
  });

  // Data point positions (for hover dots)
  const currentPoints = current.map((v, i) => {
    const r = (v / 100) * RADIUS * animScale;
    return polarToCartesian(step * i, r);
  });

  const previousPoints = previous.map((v, i) => {
    const r = (v / 100) * RADIUS * animScale;
    return polarToCartesian(step * i, r);
  });

  return (
    <div style={{ width: SIZE, height: SIZE, position: "relative" }}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ overflow: "visible" }}
      >
        {/* Grid */}
        {gridPolygons.map((pts, i) => (
          <polygon
            key={`grid-${i}`}
            points={pts}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />
        ))}

        {/* Axis lines */}
        {axisLines.map((end, i) => (
          <line
            key={`axis-${i}`}
            x1={CENTER}
            y1={CENTER}
            x2={end.x}
            y2={end.y}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={1}
          />
        ))}

        {/* Previous week polygon (outlined gray) */}
        <polygon
          points={buildPolygonPoints(previous, animScale)}
          fill="none"
          stroke="rgba(156,163,175,0.5)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />

        {/* Current week polygon (filled blue) */}
        <polygon
          points={buildPolygonPoints(current, animScale)}
          fill="rgba(59,130,246,0.2)"
          stroke="#3b82f6"
          strokeWidth={2}
        />

        {/* Axis labels */}
        {labelPositions.map((pos, i) => (
          <text
            key={`label-${i}`}
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(255,255,255,0.7)"
            fontSize={10}
            fontFamily="Inter, sans-serif"
          >
            {labels[i]}
          </text>
        ))}

        {/* Current week dots */}
        {currentPoints.map((pt, i) => (
          <circle
            key={`cur-dot-${i}`}
            cx={pt.x}
            cy={pt.y}
            r={hoveredAxis === i ? 5 : 3}
            fill="#3b82f6"
            stroke="#1e3a5f"
            strokeWidth={1.5}
            style={{ cursor: "pointer", transition: "r 0.15s ease" }}
            onMouseEnter={() => setHoveredAxis(i)}
            onMouseLeave={() => setHoveredAxis(null)}
          />
        ))}

        {/* Previous week dots */}
        {previousPoints.map((pt, i) => (
          <circle
            key={`prev-dot-${i}`}
            cx={pt.x}
            cy={pt.y}
            r={2}
            fill="rgba(156,163,175,0.6)"
          />
        ))}

        {/* Hover tooltip */}
        {hoveredAxis !== null && (() => {
          const pt = currentPoints[hoveredAxis];
          const curVal = current[hoveredAxis];
          const prevVal = previous[hoveredAxis];
          const diff = curVal - prevVal;
          const diffStr = diff >= 0 ? `+${diff}` : `${diff}`;
          return (
            <g>
              <rect
                x={pt.x - 40}
                y={pt.y - 36}
                width={80}
                height={28}
                rx={4}
                fill="rgba(15,15,40,0.92)"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={1}
              />
              <text
                x={pt.x}
                y={pt.y - 25}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#fff"
                fontSize={11}
                fontWeight={600}
              >
                {curVal}
              </text>
              <text
                x={pt.x}
                y={pt.y - 13}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={diff >= 0 ? "#22c55e" : "#ef4444"}
                fontSize={9}
              >
                {diffStr} vs gecen hafta
              </text>
            </g>
          );
        })()}

        {/* Legend */}
        <circle cx={20} cy={SIZE - 16} r={4} fill="#3b82f6" />
        <text
          x={28}
          y={SIZE - 16}
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.6)"
          fontSize={9}
        >
          Bu Hafta
        </text>
        <line
          x1={90}
          y1={SIZE - 16}
          x2={104}
          y2={SIZE - 16}
          stroke="rgba(156,163,175,0.5)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
        <text
          x={110}
          y={SIZE - 16}
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.6)"
          fontSize={9}
        >
          Gecen Hafta
        </text>
      </svg>
    </div>
  );
}
