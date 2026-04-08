import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTrackerState } from "../../hooks/useTrackerState";
import { useInterval } from "../../hooks/useInterval";
import type { DailySummary, TimelineEntry } from "../../types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h > 0) return `${h}s ${m}dk`;
  return `${m}dk`;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}s ${m}dk ${s}sn`;
  if (m > 0) return `${m}dk ${s}sn`;
  return `${s}sn`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "..." : text;
}

function categoryColor(cat: string): string {
  if (cat === "productive") return "var(--accent-green)";
  if (cat === "distracting") return "var(--accent-red)";
  return "var(--text-muted)";
}

function productivityBarColor(score: number): string {
  if (score >= 70) return "green";
  if (score >= 40) return "yellow";
  if (score >= 20) return "orange";
  return "red";
}

/* ------------------------------------------------------------------ */
/*  SVG Icons (inline, lightweight)                                    */
/* ------------------------------------------------------------------ */

const IconClock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconCheck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const IconX = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

const IconPercent = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-yellow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="5" x2="5" y2="19" />
    <circle cx="6.5" cy="6.5" r="2.5" />
    <circle cx="17.5" cy="17.5" r="2.5" />
  </svg>
);

const IconGit = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="18" r="3" />
    <circle cx="12" cy="6" r="3" />
    <line x1="12" y1="9" x2="12" y2="15" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Tooltip component for timeline hover                               */
/* ------------------------------------------------------------------ */

function TimelineTooltip({
  entry,
  style,
}: {
  entry: TimelineEntry;
  style: React.CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 8px)",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "8px 12px",
        fontSize: 12,
        color: "var(--text-primary)",
        whiteSpace: "nowrap",
        zIndex: 100,
        pointerEvents: "none",
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        ...style,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 2 }}>
        {entry.project_name || entry.process_name}
      </div>
      <div style={{ color: "var(--text-muted)" }}>
        {formatElapsed(entry.duration_seconds)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function TodayPage() {
  const state = useTrackerState(2000);
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [hoveredSegment, setHoveredSegment] = useState<{
    index: number;
    entry: TimelineEntry;
    left: number;
  } | null>(null);

  const fetchData = async () => {
    try {
      const [s, t] = await Promise.all([
        invoke<DailySummary[]>("get_today_summary"),
        invoke<TimelineEntry[]>("get_today_timeline"),
      ]);
      setSummaries(s);
      setTimeline(t);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);
  useInterval(fetchData, 10000);

  /* -- Computed stats ------------------------------------------------ */
  const totalMinutes = summaries.reduce((a, s) => a + s.total_minutes, 0);
  const productiveMinutes = summaries.reduce(
    (a, s) => a + s.productive_minutes,
    0,
  );
  const distractingMinutes = summaries.reduce(
    (a, s) => a + s.distracting_minutes,
    0,
  );
  const totalCommits = summaries.reduce((a, s) => a + s.commit_count, 0);
  const productivity =
    totalMinutes > 0 ? (productiveMinutes / totalMinutes) * 100 : 0;

  const productivityColorClass =
    productivity >= 70 ? "green" : productivity >= 40 ? "yellow" : "red";

  const totalTimelineDuration =
    timeline.reduce((a, e) => a + e.duration_seconds, 0) || 1;

  const sortedSummaries = [...summaries].sort(
    (a, b) => b.total_minutes - a.total_minutes,
  );

  const hasData = summaries.length > 0 || timeline.length > 0;

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <div>
      <h1 className="page-title">Bugunun Ozeti</h1>

      {/* ============ TOP STATS GRID ============ */}
      <div className="stats-grid">
        {/* Total Time */}
        <div className="stat-card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <IconClock />
            <span className="label">Toplam Calisma</span>
          </div>
          <div className="value blue">{formatMinutes(totalMinutes)}</div>
        </div>

        {/* Productive Time */}
        <div className="stat-card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <IconCheck />
            <span className="label">Uretken Sure</span>
          </div>
          <div className="value green">{formatMinutes(productiveMinutes)}</div>
        </div>

        {/* Distracting Time */}
        <div className="stat-card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <IconX />
            <span className="label">Dikkat Dagitici</span>
          </div>
          <div className="value red">{formatMinutes(distractingMinutes)}</div>
        </div>

        {/* Productivity % */}
        <div className="stat-card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <IconPercent />
            <span className="label">Verimlilik</span>
          </div>
          <div className={`value ${productivityColorClass}`}>
            %{productivity.toFixed(0)}
          </div>
        </div>

        {/* Commits Today */}
        <div className="stat-card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <IconGit />
            <span className="label">Commit</span>
          </div>
          <div className="value purple">{totalCommits}</div>
        </div>
      </div>

      {/* ============ CURRENT ACTIVITY ============ */}
      {state && (
        <div className="card">
          <div className="card-title">Su An</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            {/* Pulsing category indicator */}
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: categoryColor(state.current_category),
                flexShrink: 0,
                boxShadow: `0 0 8px ${categoryColor(state.current_category)}`,
                animation: state.is_idle ? "none" : undefined,
              }}
            />

            {/* Info block */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 15,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>
                  {state.current_project ||
                    state.current_process_name ||
                    "Bos"}
                </span>
                {state.is_idle && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "var(--accent-yellow)",
                      color: "#000",
                      fontWeight: 700,
                      letterSpacing: 0.5,
                    }}
                  >
                    IDLE
                  </span>
                )}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginTop: 4,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                }}
              >
                {state.current_file && (
                  <span
                    className="mono"
                    style={{
                      background: "var(--bg-secondary)",
                      padding: "1px 6px",
                      borderRadius: 3,
                      fontSize: 11,
                    }}
                  >
                    {state.current_file}
                  </span>
                )}
                {state.current_branch && (
                  <span
                    className="mono"
                    style={{
                      background: "var(--bg-secondary)",
                      padding: "1px 6px",
                      borderRadius: 3,
                      fontSize: 11,
                    }}
                  >
                    {state.current_branch}
                  </span>
                )}
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  marginTop: 4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {truncate(state.current_window_title, 80)}
              </div>
            </div>

            {/* Elapsed time */}
            <div
              className="mono"
              style={{
                fontSize: 14,
                color: "var(--text-secondary)",
                flexShrink: 0,
                textAlign: "right",
              }}
            >
              {formatElapsed(state.elapsed_seconds)}
            </div>
          </div>
        </div>
      )}

      {/* ============ TIMELINE ============ */}
      {timeline.length > 0 && (
        <div className="card">
          <div className="card-title">Gunluk Zaman Cizelgesi</div>

          {/* Timeline bar with tooltip support */}
          <div style={{ position: "relative" }}>
            {hoveredSegment && (
              <TimelineTooltip
                entry={hoveredSegment.entry}
                style={{ left: `${hoveredSegment.left}%` }}
              />
            )}
            <div className="timeline-bar">
              {timeline.slice(0, 200).map((entry, i) => {
                const width = Math.max(
                  (entry.duration_seconds / totalTimelineDuration) * 100,
                  0.3,
                );
                return (
                  <div
                    key={i}
                    className={`timeline-segment ${entry.is_idle ? "idle" : entry.category}`}
                    style={{ width: `${width}%` }}
                    onMouseEnter={() => {
                      // compute rough left offset for tooltip
                      const precedingDuration = timeline
                        .slice(0, i)
                        .reduce((a, e) => a + e.duration_seconds, 0);
                      const left =
                        (precedingDuration / totalTimelineDuration) * 100;
                      setHoveredSegment({ index: i, entry, left });
                    }}
                    onMouseLeave={() => setHoveredSegment(null)}
                  />
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div
            style={{
              display: "flex",
              gap: 16,
              fontSize: 11,
              color: "var(--text-muted)",
              marginTop: 4,
            }}
          >
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  background: "var(--accent-green)",
                  borderRadius: 2,
                  marginRight: 4,
                }}
              />
              Uretken
            </span>
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  background: "var(--accent-red)",
                  borderRadius: 2,
                  marginRight: 4,
                }}
              />
              Dikkat Dagitici
            </span>
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  background: "var(--text-muted)",
                  borderRadius: 2,
                  marginRight: 4,
                }}
              />
              Notr
            </span>
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  background: "var(--accent-yellow)",
                  opacity: 0.4,
                  borderRadius: 2,
                  marginRight: 4,
                }}
              />
              Bos
            </span>
          </div>
        </div>
      )}

      {/* ============ PROJECT BREAKDOWN ============ */}
      {sortedSummaries.length > 0 && (
        <div className="card">
          <div className="card-title">Proje Bazli Dagilim</div>
          <div className="project-list">
            {sortedSummaries.map((s, i) => {
              const proportion =
                totalMinutes > 0 ? (s.total_minutes / totalMinutes) * 100 : 0;
              return (
                <div key={i} className="project-row" style={{ flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="name">{s.project_name || "Diger"}</div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginTop: 2,
                        display: "flex",
                        gap: 8,
                      }}
                    >
                      <span>{s.commit_count} commit</span>
                      <span>
                        %{s.productivity_score.toFixed(0)} verimli
                      </span>
                    </div>
                    {/* Mini progress bar */}
                    <div className="progress-bar" style={{ marginTop: 8 }}>
                      <div
                        className={`progress-bar-fill ${productivityBarColor(s.productivity_score)}`}
                        style={{ width: `${proportion}%` }}
                      />
                    </div>
                  </div>
                  <div
                    className="time"
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      marginLeft: 16,
                    }}
                  >
                    {formatMinutes(s.total_minutes)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============ EMPTY STATE ============ */}
      {!hasData && (
        <div className="empty-state">
          <h3>Henuz veri yok</h3>
          <p>
            DevPulse arka planda calismaya basladi. Biraz calistiktan sonra
            burada istatistiklerini goreceksin.
          </p>
        </div>
      )}
    </div>
  );
}
