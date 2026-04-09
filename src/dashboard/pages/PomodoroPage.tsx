import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePomodoroState } from "../../hooks/usePomodoroState";
import { PomodoroTimer } from "../components/PomodoroTimer";
import PageTransition from "../../components/PageTransition";
import StatusBadge from "../../components/StatusBadge";

/* ------------------------------------------------------------------ */
/*  Config Section                                                     */
/* ------------------------------------------------------------------ */

function ConfigSection({
  workMin,
  shortMin,
  longMin,
  interval,
  onSave,
}: {
  workMin: number;
  shortMin: number;
  longMin: number;
  interval: number;
  onSave: (w: number, s: number, l: number, i: number) => void;
}) {
  const [work, setWork] = useState(workMin);
  const [short_, setShort] = useState(shortMin);
  const [long_, setLong] = useState(longMin);
  const [intv, setIntv] = useState(interval);

  function handleSave() {
    onSave(work, short_, long_, intv);
  }

  return (
    <div className="card">
      <div className="card-title">Yapilandirma</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "16px",
        }}
      >
        <div>
          <label
            style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              display: "block",
              marginBottom: "6px",
            }}
          >
            Calisma (dk)
          </label>
          <input
            type="number"
            min={1}
            max={120}
            value={work}
            onChange={(e) => setWork(Math.max(1, Number(e.target.value)))}
          />
        </div>
        <div>
          <label
            style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              display: "block",
              marginBottom: "6px",
            }}
          >
            Kisa Mola (dk)
          </label>
          <input
            type="number"
            min={1}
            max={60}
            value={short_}
            onChange={(e) => setShort(Math.max(1, Number(e.target.value)))}
          />
        </div>
        <div>
          <label
            style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              display: "block",
              marginBottom: "6px",
            }}
          >
            Uzun Mola (dk)
          </label>
          <input
            type="number"
            min={1}
            max={120}
            value={long_}
            onChange={(e) => setLong(Math.max(1, Number(e.target.value)))}
          />
        </div>
        <div>
          <label
            style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              display: "block",
              marginBottom: "6px",
            }}
          >
            Uzun Mola Araligi
          </label>
          <input
            type="number"
            min={2}
            max={10}
            value={intv}
            onChange={(e) => setIntv(Math.max(2, Number(e.target.value)))}
          />
        </div>
      </div>
      <div style={{ marginTop: "16px" }}>
        <button className="btn btn-primary" onClick={handleSave}>
          Kaydet
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tips Section                                                       */
/* ------------------------------------------------------------------ */

function TipsSection() {
  const tips = [
    "Her calisma oturumunda tek bir goreve odaklanin.",
    "Molalarda ekrandan uzaklasin, gozlerinizi dinlendirin.",
    "Uzun molada kisa bir yuruyus yapin veya su icin.",
    "Dikkat daginikliklarini bir kagida not edin, oturumdan sonra bakin.",
    "4 oturum tamamladiginizda kendinizi odullendirin!",
  ];

  return (
    <div className="card">
      <div className="card-title">Pomodoro Ipuclari</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {tips.map((tip, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              padding: "10px 14px",
              background: "var(--bg-secondary)",
              borderRadius: "var(--radius)",
              fontSize: "13px",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            <span
              style={{
                color: "var(--accent-blue)",
                fontWeight: 700,
                fontSize: "14px",
                minWidth: "18px",
              }}
            >
              {i + 1}.
            </span>
            <span>{tip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function PomodoroPage() {
  const { state, notification } = usePomodoroState(1000);

  async function handleSaveConfig(
    workMin: number,
    shortMin: number,
    longMin: number,
    interval: number
  ) {
    try {
      await invoke("set_pomodoro_config", {
        work: workMin * 60,
        shortBreak: shortMin * 60,
        longBreak: longMin * 60,
        interval,
      });
    } catch (err) {
      console.error("set_pomodoro_config failed:", err);
    }
  }

  if (!state) {
    return (
      <div className="content">
        <h2 className="page-title">Pomodoro Zamanlayici</h2>
        <div className="empty-state">
          <div className="empty-icon">...</div>
          <h3>Yukleniyor</h3>
          <p>Pomodoro durumu aliniyor...</p>
        </div>
      </div>
    );
  }

  const isBreak = state.mode === "short_break" || state.mode === "long_break";
  const sessionStatusVariant = state.is_running
    ? isBreak ? "idle" as const : "productive" as const
    : "neutral" as const;
  const sessionStatusLabel = state.is_running
    ? isBreak ? "Mola" : "Calisma"
    : "Durduruldu";

  return (
    <PageTransition>
    <div className="content">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <h2 className="page-title" style={{ margin: 0 }}>Pomodoro Zamanlayici</h2>
        <StatusBadge variant={sessionStatusVariant} label={sessionStatusLabel} pulse={state.is_running} />
      </div>

      {/* Timer */}
      <div className="card" style={{ display: "flex", justifyContent: "center", padding: "40px 20px" }}>
        <PomodoroTimer state={state} notification={notification} />
      </div>

      {/* Session History (placeholder) */}
      <div className="card">
        <div className="card-title">Bugunun Oturumlari</div>
        {state.sessions_completed > 0 ? (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {Array.from({ length: state.sessions_completed }, (_, i) => (
              <div
                key={i}
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "var(--radius)",
                  background: "rgba(34, 197, 94, 0.15)",
                  border: "1px solid var(--accent-green)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "var(--accent-green)",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {i + 1}
              </div>
            ))}
            {/* Remaining slots */}
            {state.sessions_completed % state.long_break_interval !== 0 &&
              Array.from(
                { length: state.long_break_interval - (state.sessions_completed % state.long_break_interval) },
                (_, i) => (
                  <div
                    key={`empty-${i}`}
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "var(--radius)",
                      background: "var(--bg-secondary)",
                      border: "1px dashed var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      color: "var(--text-muted)",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {state.sessions_completed + i + 1}
                  </div>
                )
              )}
          </div>
        ) : (
          <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "12px 0" }}>
            Henuz oturum yok. Baslat butonuna basarak ilk Pomodoro oturumunuzu baslatin!
          </div>
        )}
      </div>

      {/* Config */}
      <ConfigSection
        workMin={Math.round(state.work_duration / 60)}
        shortMin={Math.round(state.short_break_duration / 60)}
        longMin={Math.round(state.long_break_duration / 60)}
        interval={state.long_break_interval}
        onSave={handleSaveConfig}
      />

      {/* Tips */}
      <TipsSection />
    </div>
    </PageTransition>
  );
}
