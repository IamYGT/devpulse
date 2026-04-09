import { useMemo } from "react";

interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export default function SparkLine({
  data,
  width = 80,
  height = 20,
  color = "#3b82f6",
}: Props) {
  const { linePath, fillPath, minPt, maxPt } = useMemo(() => {
    if (data.length < 2) {
      return { linePath: "", fillPath: "", minPt: null, maxPt: null };
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 2;
    const usableH = height - padding * 2;

    const points: [number, number][] = data.map((v, i) => [
      (i / (data.length - 1)) * width,
      padding + usableH - ((v - min) / range) * usableH,
    ]);

    // Build smooth line using catmull-rom to bezier conversion
    let line = `M ${points[0][0]},${points[0][1]}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx1 = prev[0] + (curr[0] - prev[0]) * 0.35;
      const cpx2 = curr[0] - (curr[0] - prev[0]) * 0.35;
      line += ` C ${cpx1},${prev[1]} ${cpx2},${curr[1]} ${curr[0]},${curr[1]}`;
    }

    // Fill path: line + bottom edge
    const fill =
      line +
      ` L ${points[points.length - 1][0]},${height}` +
      ` L ${points[0][0]},${height} Z`;

    // Find min and max points
    let minIdx = 0;
    let maxIdx = 0;
    data.forEach((v, i) => {
      if (v < data[minIdx]) minIdx = i;
      if (v > data[maxIdx]) maxIdx = i;
    });

    return {
      linePath: line,
      fillPath: fill,
      minPt: points[minIdx],
      maxPt: points[maxIdx],
    };
  }, [data, width, height]);

  if (data.length < 2) return null;

  const gradientId = `spark-grad-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Gradient fill under line */}
      <path d={fillPath} fill={`url(#${gradientId})`} />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Min dot */}
      {minPt && (
        <circle
          cx={minPt[0]}
          cy={minPt[1]}
          r={2}
          fill="#ef4444"
          stroke="rgba(15,15,40,0.8)"
          strokeWidth={1}
        />
      )}

      {/* Max dot */}
      {maxPt && (
        <circle
          cx={maxPt[0]}
          cy={maxPt[1]}
          r={2}
          fill="#22c55e"
          stroke="rgba(15,15,40,0.8)"
          strokeWidth={1}
        />
      )}
    </svg>
  );
}
