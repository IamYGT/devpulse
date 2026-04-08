import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface DaySummary {
  date: string;
  total_minutes: number;
  productive_minutes: number;
  commit_count: number;
  productivity_score: number;
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h > 0) return `${h}s ${m}dk`;
  return `${m}dk`;
}

function scoreColor(score: number): string {
  if (score === 0) return "var(--bg-secondary)";
  if (score <= 30) return "#c0392b";
  if (score <= 60) return "#f39c12";
  if (score <= 80) return "#27ae60";
  return "#2ecc71";
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Returns 0=Monday ... 6=Sunday (ISO weekday) for the first day of the month. */
function getFirstDayOfWeek(year: number, month: number): number {
  const d = new Date(year, month - 1, 1).getDay(); // 0=Sun
  return d === 0 ? 6 : d - 1; // convert to Mon=0
}

const MONTH_NAMES = [
  "Ocak",
  "Subat",
  "Mart",
  "Nisan",
  "Mayis",
  "Haziran",
  "Temmuz",
  "Agustos",
  "Eylul",
  "Ekim",
  "Kasim",
  "Aralik",
];

const DAY_HEADERS = ["Pzt", "Sal", "Car", "Per", "Cum", "Cmt", "Paz"];

export default function MonthlyPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<DaySummary[]>([]);
  const [tooltip, setTooltip] = useState<{
    day: number;
    summary: DaySummary | null;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    invoke<DaySummary[]>("get_monthly_summary", { year, month })
      .then(setData)
      .catch(console.error);
  }, [year, month]);

  const goPrev = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  };

  const goNext = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  };

  // Build lookup: day number -> DaySummary
  const dayMap = new Map<number, DaySummary>();
  for (const d of data) {
    const dayNum = parseInt(d.date.split("-")[2], 10);
    dayMap.set(dayNum, d);
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOffset = getFirstDayOfWeek(year, month);

  // Build calendar grid cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  // Monthly aggregate stats
  const totalHours = data.reduce((a, d) => a + d.total_minutes, 0) / 60;
  const avgProductivity =
    data.length > 0
      ? data.reduce((a, d) => a + d.productivity_score, 0) / data.length
      : 0;
  const totalCommits = data.reduce((a, d) => a + d.commit_count, 0);
  const mostProductiveDay = data.reduce<DaySummary | null>(
    (best, d) =>
      !best || d.productivity_score > best.productivity_score ? d : best,
    null,
  );

  return (
    <div>
      <h1 className="page-title">Aylik Ozet</h1>

      {/* Month Navigation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          marginBottom: 24,
        }}
      >
        <button
          className="btn"
          onClick={goPrev}
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            cursor: "pointer",
            padding: "6px 14px",
            borderRadius: "var(--radius)",
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          &larr;
        </button>
        <span
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "var(--text-primary)",
            minWidth: 180,
            textAlign: "center",
          }}
        >
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <button
          className="btn"
          onClick={goNext}
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            cursor: "pointer",
            padding: "6px 14px",
            borderRadius: "var(--radius)",
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          &rarr;
        </button>
      </div>

      {/* Heatmap Calendar */}
      <div className="card" style={{ position: "relative" }}>
        <div className="card-title">Uretkenlik Haritasi</div>

        {/* Day headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 4,
            marginBottom: 4,
          }}
        >
          {DAY_HEADERS.map((d) => (
            <div
              key={d}
              style={{
                textAlign: "center",
                fontSize: 11,
                color: "var(--text-muted)",
                fontWeight: 600,
                padding: "4px 0",
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 4,
          }}
        >
          {cells.map((day, i) => {
            if (day === null) {
              return <div key={`empty-${i}`} style={{ aspectRatio: "1" }} />;
            }

            const summary = dayMap.get(day) || null;
            const score = summary ? summary.productivity_score : 0;
            const bg = scoreColor(score);

            return (
              <div
                key={day}
                style={{
                  aspectRatio: "1",
                  background: bg,
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 500,
                  color:
                    score > 0
                      ? "rgba(255,255,255,0.9)"
                      : "var(--text-muted)",
                  cursor: summary ? "pointer" : "default",
                  transition: "transform 0.1s, box-shadow 0.1s",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  const rect = (
                    e.target as HTMLElement
                  ).getBoundingClientRect();
                  setTooltip({
                    day,
                    summary,
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                {day}
              </div>
            );
          })}
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            style={{
              position: "fixed",
              left: tooltip.x,
              top: tooltip.y - 8,
              transform: "translate(-50%, -100%)",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "8px 12px",
              fontSize: 12,
              color: "var(--text-primary)",
              whiteSpace: "nowrap",
              zIndex: 1000,
              pointerEvents: "none",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {tooltip.day} {MONTH_NAMES[month - 1]} {year}
            </div>
            {tooltip.summary ? (
              <>
                <div>
                  Toplam: {formatMinutes(tooltip.summary.total_minutes)}
                </div>
                <div>
                  Verimlilik: %{tooltip.summary.productivity_score.toFixed(0)}
                </div>
                <div>Commit: {tooltip.summary.commit_count}</div>
              </>
            ) : (
              <div style={{ color: "var(--text-muted)" }}>Veri yok</div>
            )}
          </div>
        )}

        {/* Legend */}
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginTop: 16,
            fontSize: 11,
            color: "var(--text-muted)",
          }}
        >
          <span>Az</span>
          {[
            "var(--bg-secondary)",
            "#c0392b",
            "#f39c12",
            "#27ae60",
            "#2ecc71",
          ].map((c, i) => (
            <div
              key={i}
              style={{
                width: 14,
                height: 14,
                background: c,
                borderRadius: 3,
              }}
            />
          ))}
          <span>Cok</span>
        </div>
      </div>

      {/* Monthly Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Toplam Calisma</div>
          <div className="value blue">{totalHours.toFixed(1)} saat</div>
        </div>

        <div className="stat-card">
          <div className="label">Ort. Verimlilik</div>
          <div
            className={`value ${avgProductivity >= 70 ? "green" : avgProductivity >= 40 ? "yellow" : "red"}`}
          >
            %{avgProductivity.toFixed(0)}
          </div>
        </div>

        <div className="stat-card">
          <div className="label">Toplam Commit</div>
          <div className="value purple">{totalCommits}</div>
        </div>

        <div className="stat-card">
          <div className="label">En Verimli Gun</div>
          <div className="value green" style={{ fontSize: 16 }}>
            {mostProductiveDay
              ? `${mostProductiveDay.date} (%${mostProductiveDay.productivity_score.toFixed(0)})`
              : "-"}
          </div>
        </div>
      </div>

      {/* Empty State */}
      {data.length === 0 && (
        <div className="empty-state">
          <h3>Bu ay icin veri yok</h3>
          <p>
            DevPulse calismaya basladiktan sonra aylik istatistikler burada
            gorunecek.
          </p>
        </div>
      )}
    </div>
  );
}
