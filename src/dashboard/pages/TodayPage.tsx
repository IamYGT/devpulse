import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTrackerState } from "../../hooks/useTrackerState";
import { useInterval } from "../../hooks/useInterval";
import type { DailySummary, TimelineEntry } from "../../types";

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h > 0) return `${h}s ${m}dk`;
  return `${m}dk`;
}

export default function TodayPage() {
  const state = useTrackerState(2000);
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);

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

  useEffect(() => { fetchData(); }, []);
  useInterval(fetchData, 10000);

  const totalMinutes = summaries.reduce((a, s) => a + s.total_minutes, 0);
  const productiveMinutes = summaries.reduce((a, s) => a + s.productive_minutes, 0);
  const distractingMinutes = summaries.reduce((a, s) => a + s.distracting_minutes, 0);
  const totalCommits = summaries.reduce((a, s) => a + s.commit_count, 0);
  const productivity = totalMinutes > 0 ? (productiveMinutes / totalMinutes) * 100 : 0;
  const totalDuration = timeline.reduce((a, e) => a + e.duration_seconds, 0) || 1;

  return (
    <div>
      <h1 className="page-title">Bugunun Ozeti</h1>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Toplam Calisma</div>
          <div className="value blue">{formatMinutes(totalMinutes)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Uretken Sure</div>
          <div className="value green">{formatMinutes(productiveMinutes)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Dikkat Dagitici</div>
          <div className="value red">{formatMinutes(distractingMinutes)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Verimlilik</div>
          <div className={`value ${productivity >= 70 ? "green" : productivity >= 40 ? "yellow" : "red"}`}>
            %{productivity.toFixed(0)}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Commit</div>
          <div className="value purple">{totalCommits}</div>
        </div>
      </div>

      {/* Current Activity */}
      {state && (
        <div className="card">
          <div className="card-title">Su An</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{
              width: 10, height: 10, borderRadius: "50%",
              background: state.current_category === "productive" ? "var(--accent-green)"
                : state.current_category === "distracting" ? "var(--accent-red)"
                : "var(--text-muted)"
            }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>
                {state.current_project || state.current_process_name || "Bos"}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {state.current_file && <span>{state.current_file} &middot; </span>}
                {state.current_branch && <span>{state.current_branch} &middot; </span>}
                {state.current_window_title.substring(0, 80)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="card">
          <div className="card-title">Gunluk Zaman Cizelgesi</div>
          <div className="timeline-bar">
            {timeline.slice(0, 100).map((entry, i) => {
              const width = Math.max((entry.duration_seconds / totalDuration) * 100, 0.5);
              return (
                <div
                  key={i}
                  className={`timeline-segment ${entry.is_idle ? "idle" : entry.category}`}
                  style={{ width: `${width}%` }}
                  title={`${entry.project_name || entry.process_name} - ${Math.round(entry.duration_seconds / 60)}dk`}
                />
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text-muted)" }}>
            <span><span style={{ display: "inline-block", width: 8, height: 8, background: "var(--accent-green)", borderRadius: 2, marginRight: 4 }} />Uretken</span>
            <span><span style={{ display: "inline-block", width: 8, height: 8, background: "var(--accent-red)", borderRadius: 2, marginRight: 4 }} />Dikkat Dagitici</span>
            <span><span style={{ display: "inline-block", width: 8, height: 8, background: "var(--text-muted)", borderRadius: 2, marginRight: 4 }} />Notr</span>
            <span><span style={{ display: "inline-block", width: 8, height: 8, background: "var(--accent-yellow)", opacity: 0.4, borderRadius: 2, marginRight: 4 }} />Bos</span>
          </div>
        </div>
      )}

      {/* Project Breakdown */}
      {summaries.length > 0 && (
        <div className="card">
          <div className="card-title">Proje Bazli Dagilim</div>
          <div className="project-list">
            {[...summaries]
              .sort((a, b) => b.total_minutes - a.total_minutes)
              .map((s, i) => (
                <div key={i} className="project-row">
                  <div>
                    <div className="name">{s.project_name || "Diger"}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {s.commit_count} commit &middot; %{s.productivity_score.toFixed(0)} verimli
                    </div>
                  </div>
                  <div className="time">{formatMinutes(s.total_minutes)}</div>
                </div>
              ))}
          </div>
        </div>
      )}

      {summaries.length === 0 && timeline.length === 0 && (
        <div className="empty-state">
          <h3>Henuz veri yok</h3>
          <p>DevPulse arka planda calismaya basladi. Biraz calistiktan sonra burada istatistiklerini goreceksin.</p>
        </div>
      )}
    </div>
  );
}
