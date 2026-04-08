import { useState, useEffect } from "react";
import { useTrackerState } from "../../hooks/useTrackerState";
import { useInterval } from "../../hooks/useInterval";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "--:--";
  }
}

function categoryBadge(cat: string): { label: string; className: string } {
  if (cat === "productive") return { label: "Uretken", className: "productive" };
  if (cat === "distracting")
    return { label: "Dikkat Dagitici", className: "distracting" };
  return { label: "Notr", className: "neutral" };
}

function sessionScoreColor(score: number): string {
  if (score >= 70) return "var(--accent-green)";
  if (score >= 40) return "var(--accent-yellow)";
  return "var(--accent-red)";
}

export default function WorkSessionCard() {
  const state = useTrackerState(2000);
  const [elapsed, setElapsed] = useState(0);

  // Live counting: increment elapsed every second based on tracker state
  useEffect(() => {
    if (state) {
      setElapsed(state.elapsed_seconds);
    }
  }, [state]);

  useInterval(() => {
    setElapsed((prev) => prev + 1);
  }, 1000);

  if (!state) {
    return (
      <div
        className="card"
        style={{
          borderLeft: "3px solid var(--text-muted)",
          opacity: 0.6,
        }}
      >
        <div className="card-title">Mevcut Oturum</div>
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Oturum verisi bekleniyor...
        </div>
      </div>
    );
  }

  const badge = categoryBadge(state.current_category);
  const productivity = state.productivity_percentage;

  return (
    <div
      className="card"
      style={{
        borderLeft: `3px solid var(--accent-blue)`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle gradient overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "50%",
          height: "100%",
          background:
            "linear-gradient(135deg, transparent 0%, rgba(99, 102, 241, 0.03) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Title row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div className="card-title" style={{ margin: 0 }}>
          Mevcut Oturum
        </div>
        <span className={`badge ${badge.className}`}>{badge.label}</span>
      </div>

      {/* Main info grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px 24px",
        }}
      >
        {/* Start time */}
        <div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 4,
            }}
          >
            Baslangic
          </div>
          <div
            style={{
              fontSize: 14,
              fontFamily: "'JetBrains Mono', monospace",
              color: "var(--text-secondary)",
            }}
          >
            {formatTime(state.session_start)}
          </div>
        </div>

        {/* Duration */}
        <div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 4,
            }}
          >
            Sure
          </div>
          <div
            className="mono"
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "var(--accent-blue)",
            }}
          >
            {formatDuration(elapsed)}
          </div>
        </div>

        {/* Current app / project */}
        <div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 4,
            }}
          >
            Uygulama / Proje
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-primary)",
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {state.current_project || state.current_process_name || "Bilinmiyor"}
          </div>
        </div>

        {/* Productivity score */}
        <div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 4,
            }}
          >
            Verimlilik
          </div>
          <div
            className="mono"
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: sessionScoreColor(productivity),
            }}
          >
            %{productivity.toFixed(0)}
          </div>
        </div>
      </div>

      {/* Break button */}
      <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
        <button
          className="btn"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
          }}
          onClick={() => {
            // Visual only - could trigger a pause command in the future
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
          Molaya Cik
        </button>
      </div>
    </div>
  );
}
