import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTrackerState } from "../../hooks/useTrackerState";
import { useInterval } from "../../hooks/useInterval";
import type { DailySummary, TimelineEntry } from "../../types";

import DailyInsights from "../components/DailyInsights";
import ProductivityGauge from "../components/ProductivityGauge";
import FocusScore from "../components/FocusScore";
import WeeklyComparison from "../components/WeeklyComparison";
import ProjectTimeline from "../components/ProjectTimeline";

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function InsightsPage() {
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
      console.error("InsightsPage fetch error:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-refresh every 30 seconds
  useInterval(fetchData, 30000);

  const totalMinutes = summaries.reduce((a, s) => a + s.total_minutes, 0);
  const productiveMinutes = summaries.reduce((a, s) => a + s.productive_minutes, 0);
  const productivity = totalMinutes > 0 ? (productiveMinutes / totalMinutes) * 100 : 0;

  const hasData = summaries.length > 0 || timeline.length > 0;

  return (
    <div>
      <h1 className="page-title">Analizler ve Oneriler</h1>

      {!hasData && (
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
              <path d="M9 18h6" />
              <path d="M10 22h4" />
            </svg>
          </div>
          <h3>Henuz analiz icin yeterli veri yok</h3>
          <p>
            Biraz calistiktan sonra burada verimlilik analizlerini, odaklanma
            skorunu ve haftalik karsilastirmalari goreceksin.
          </p>
        </div>
      )}

      {hasData && (
        <>
          {/* Top: Daily Insights */}
          <DailyInsights
            summaries={summaries}
            timeline={timeline}
            state={state}
          />

          {/* Middle: Gauge + Focus Score side by side */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div
              className="card"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px 20px",
              }}
            >
              <ProductivityGauge value={productivity} />
            </div>

            <FocusScore timeline={timeline} />
          </div>

          {/* Weekly Comparison */}
          <WeeklyComparison />

          {/* Project Timeline */}
          <ProjectTimeline
            timeline={timeline}
            isTracking={state?.is_tracking}
          />
        </>
      )}
    </div>
  );
}
