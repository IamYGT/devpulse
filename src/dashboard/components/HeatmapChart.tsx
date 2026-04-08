import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface HeatmapDay {
  date: string;
  total_minutes: number;
  productivity_score: number;
}

interface Props {
  year: number;
}

const CELL_SIZE = 12;
const CELL_GAP = 2;
const CELL_STEP = CELL_SIZE + CELL_GAP;
const ROWS = 7;
const COLS = 53;
const LEFT_LABEL_WIDTH = 32;
const TOP_LABEL_HEIGHT = 18;

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAY_LABELS: [string, number][] = [
  ["Mon", 1],
  ["Wed", 3],
  ["Fri", 5],
];

function getColor(minutes: number): string {
  if (minutes === 0) return "#161638";
  if (minutes < 30) return "#064e3b";
  if (minutes < 60) return "#065f46";
  if (minutes < 120) return "#047857";
  if (minutes < 180) return "#059669";
  if (minutes < 240) return "#10b981";
  return "#22c55e";
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function HeatmapChart({ year }: Props) {
  const [data, setData] = useState<HeatmapDay[]>([]);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    day: HeatmapDay | null;
    date: string;
  } | null>(null);

  useEffect(() => {
    invoke<HeatmapDay[]>("get_yearly_heatmap", { year })
      .then(setData)
      .catch(() => setData([]));
  }, [year]);

  const dataMap = new Map<string, HeatmapDay>();
  data.forEach((d) => dataMap.set(d.date, d));

  // Build grid: first day of year determines starting column offset
  const jan1 = new Date(year, 0, 1);
  const startDow = jan1.getDay(); // 0=Sun, 6=Sat

  const cells: {
    col: number;
    row: number;
    date: string;
    minutes: number;
    score: number;
  }[] = [];

  const current = new Date(year, 0, 1);
  while (current.getFullYear() === year) {
    const dow = current.getDay();
    const dayOfYear = Math.floor(
      (current.getTime() - jan1.getTime()) / 86400000
    );
    const col = Math.floor((dayOfYear + startDow) / 7);
    const row = dow;
    const dateStr = formatDate(current);
    const entry = dataMap.get(dateStr);
    cells.push({
      col,
      row,
      date: dateStr,
      minutes: entry?.total_minutes ?? 0,
      score: entry?.productivity_score ?? 0,
    });
    current.setDate(current.getDate() + 1);
  }

  // Month label positions
  const monthPositions: { label: string; col: number }[] = [];
  for (let m = 0; m < 12; m++) {
    const firstOfMonth = new Date(year, m, 1);
    const dayOfYear = Math.floor(
      (firstOfMonth.getTime() - jan1.getTime()) / 86400000
    );
    const col = Math.floor((dayOfYear + startDow) / 7);
    monthPositions.push({ label: MONTH_LABELS[m], col });
  }

  const svgWidth = LEFT_LABEL_WIDTH + COLS * CELL_STEP;
  const svgHeight = TOP_LABEL_HEIGHT + ROWS * CELL_STEP;

  const handleMouseEnter = useCallback(
    (
      e: React.MouseEvent<SVGRectElement>,
      cell: (typeof cells)[0]
    ) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltip({
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
        day: dataMap.get(cell.date) ?? null,
        date: cell.date,
      });
    },
    [dataMap]
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <svg
        width={svgWidth}
        height={svgHeight}
        style={{ display: "block" }}
      >
        {/* Month labels */}
        {monthPositions.map((mp) => (
          <text
            key={mp.label}
            x={LEFT_LABEL_WIDTH + mp.col * CELL_STEP}
            y={12}
            fill="#8888aa"
            fontSize={10}
            fontFamily="Inter, sans-serif"
          >
            {mp.label}
          </text>
        ))}

        {/* Day labels */}
        {DAY_LABELS.map(([label, row]) => (
          <text
            key={label}
            x={0}
            y={TOP_LABEL_HEIGHT + row * CELL_STEP + CELL_SIZE - 2}
            fill="#8888aa"
            fontSize={10}
            fontFamily="Inter, sans-serif"
          >
            {label}
          </text>
        ))}

        {/* Cells */}
        {cells.map((cell) => (
          <rect
            key={cell.date}
            x={LEFT_LABEL_WIDTH + cell.col * CELL_STEP}
            y={TOP_LABEL_HEIGHT + cell.row * CELL_STEP}
            width={CELL_SIZE}
            height={CELL_SIZE}
            rx={2}
            ry={2}
            fill={getColor(cell.minutes)}
            style={{ cursor: "pointer" }}
            onMouseEnter={(e) => handleMouseEnter(e, cell)}
            onMouseLeave={handleMouseLeave}
          />
        ))}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
            background: "#1e1e4a",
            border: "1px solid #222244",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 12,
            color: "#e8e8f0",
            pointerEvents: "none",
            zIndex: 1000,
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>
            {tooltip.date}
          </div>
          {tooltip.day ? (
            <>
              <div>{tooltip.day.total_minutes} dakika</div>
              <div>
                Verimlilik: {tooltip.day.productivity_score.toFixed(0)}%
              </div>
            </>
          ) : (
            <div style={{ color: "#555577" }}>Veri yok</div>
          )}
        </div>
      )}
    </div>
  );
}
