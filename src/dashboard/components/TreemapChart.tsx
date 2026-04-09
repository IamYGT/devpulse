import { useState, useMemo } from "react";

interface TreemapItem {
  name: string;
  value: number;
  category: string;
}

interface Props {
  items: TreemapItem[];
}

const WIDTH = 500;
const HEIGHT = 300;

const CATEGORY_COLORS: Record<string, { bg: string; border: string }> = {
  productive: { bg: "rgba(34,197,94,0.35)", border: "rgba(34,197,94,0.6)" },
  distracting: { bg: "rgba(239,68,68,0.35)", border: "rgba(239,68,68,0.6)" },
  neutral: { bg: "rgba(85,85,119,0.35)", border: "rgba(85,85,119,0.6)" },
};

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  item: TreemapItem;
}

/**
 * Simple squarify treemap layout.
 * Lays out items in rows, picking the orientation (horizontal vs vertical)
 * that produces the best aspect ratios.
 */
function squarify(
  items: TreemapItem[],
  x: number,
  y: number,
  w: number,
  h: number
): Rect[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [{ x, y, w, h, item: items[0] }];
  }

  const total = items.reduce((s, it) => s + it.value, 0);
  if (total === 0) return [];

  // Sort descending by value
  const sorted = [...items].sort((a, b) => b.value - a.value);

  const rects: Rect[] = [];
  layoutStrip(sorted, 0, sorted.length, x, y, w, h, total, rects);
  return rects;
}

function layoutStrip(
  items: TreemapItem[],
  start: number,
  end: number,
  x: number,
  y: number,
  w: number,
  h: number,
  total: number,
  rects: Rect[]
): void {
  if (start >= end) return;
  if (end - start === 1) {
    rects.push({ x, y, w, h, item: items[start] });
    return;
  }

  const vertical = w >= h;
  let sum = 0;
  let bestRatio = Infinity;
  let splitIdx = start + 1;

  // Find the best split point for aspect ratio
  for (let i = start; i < end; i++) {
    sum += items[i].value;
    const fraction = sum / total;

    const stripSize = vertical ? w * fraction : h * fraction;
    void (vertical ? w - stripSize : h - stripSize);

    // Compute worst aspect ratio in the strip
    let stripTotal = 0;
    for (let j = start; j <= i; j++) stripTotal += items[j].value;

    let worstRatio = 0;
    for (let j = start; j <= i; j++) {
      const itemFrac = items[j].value / stripTotal;
      void (vertical ? stripSize : w);
      void (vertical ? h : stripSize);
      const iw = vertical ? stripSize : w * itemFrac;
      const ih = vertical ? h * itemFrac : stripSize;

      const ratio = Math.max(iw / Math.max(ih, 0.1), ih / Math.max(iw, 0.1));
      worstRatio = Math.max(worstRatio, ratio);
    }

    if (worstRatio <= bestRatio) {
      bestRatio = worstRatio;
      splitIdx = i + 1;
    } else if (worstRatio > bestRatio * 1.5) {
      break;
    }
  }

  // Layout the strip
  let stripSum = 0;
  for (let i = start; i < splitIdx; i++) stripSum += items[i].value;
  const stripFraction = stripSum / total;

  let offset = 0;
  for (let i = start; i < splitIdx; i++) {
    const itemFrac = items[i].value / stripSum;
    if (vertical) {
      const sw = w * stripFraction;
      const sh = h * itemFrac;
      rects.push({
        x: x,
        y: y + offset,
        w: sw,
        h: sh,
        item: items[i],
      });
      offset += sh;
    } else {
      const sw = w * itemFrac;
      const sh = h * stripFraction;
      rects.push({
        x: x + offset,
        y: y,
        w: sw,
        h: sh,
        item: items[i],
      });
      offset += sw;
    }
  }

  // Layout the remaining items in the remaining space
  const remainTotal = total - stripSum;
  if (vertical) {
    const newX = x + w * stripFraction;
    const newW = w * (1 - stripFraction);
    layoutStrip(items, splitIdx, end, newX, y, newW, h, remainTotal, rects);
  } else {
    const newY = y + h * stripFraction;
    const newH = h * (1 - stripFraction);
    layoutStrip(items, splitIdx, end, x, newY, w, newH, remainTotal, rects);
  }
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}dk`;
  return m > 0 ? `${h}s ${m}dk` : `${h}s`;
}

export default function TreemapChart({ items }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const rects = useMemo(() => {
    const filtered = items.filter((it) => it.value > 0);
    return squarify(filtered, 0, 0, WIDTH, HEIGHT);
  }, [items]);

  return (
    <div style={{ position: "relative" }}>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {rects.map((r, i) => {
          const colors = CATEGORY_COLORS[r.item.category] ?? CATEGORY_COLORS.neutral;
          const isHovered = hovered === r.item.name;
          const showLabel = r.w > 50 && r.h > 24;
          const showValue = r.w > 60 && r.h > 38;

          return (
            <g
              key={`${r.item.name}-${i}`}
              onMouseEnter={() => setHovered(r.item.name)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={r.x + 1}
                y={r.y + 1}
                width={Math.max(r.w - 2, 0)}
                height={Math.max(r.h - 2, 0)}
                rx={4}
                fill={isHovered ? colors.border : colors.bg}
                stroke={colors.border}
                strokeWidth={isHovered ? 2 : 1}
                style={{ transition: "fill 0.15s ease, stroke-width 0.15s ease" }}
              />
              {showLabel && (
                <text
                  x={r.x + r.w / 2}
                  y={r.y + r.h / 2 + (showValue ? -6 : 0)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#fff"
                  fontSize={Math.min(12, r.w / r.item.name.length * 1.4)}
                  fontWeight={600}
                  pointerEvents="none"
                >
                  {r.item.name.length > Math.floor(r.w / 7)
                    ? r.item.name.slice(0, Math.floor(r.w / 7) - 1) + "\u2026"
                    : r.item.name}
                </text>
              )}
              {showValue && (
                <text
                  x={r.x + r.w / 2}
                  y={r.y + r.h / 2 + 10}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="rgba(255,255,255,0.6)"
                  fontSize={10}
                  pointerEvents="none"
                >
                  {formatTime(r.item.value)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Floating tooltip for small rectangles */}
      {hovered && (() => {
        const rect = rects.find((r) => r.item.name === hovered);
        if (!rect || (rect.w > 50 && rect.h > 38)) return null;
        return (
          <div
            style={{
              position: "absolute",
              left: rect.x + rect.w / 2,
              top: rect.y - 8,
              transform: "translate(-50%, -100%)",
              background: "rgba(15,15,40,0.95)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 6,
              padding: "6px 10px",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              zIndex: 10,
            }}
          >
            <div style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>
              {rect.item.name}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>
              {formatTime(rect.item.value)}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
