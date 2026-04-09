import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DailySummary } from "../../types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h > 0) return `${h}s ${m}dk`;
  return `${m}dk`;
}

function getGrade(score: number): { letter: string; color: string } {
  if (score >= 90) return { letter: "A", color: "var(--accent-green)" };
  if (score >= 75) return { letter: "B", color: "#22d3ee" };
  if (score >= 60) return { letter: "C", color: "var(--accent-yellow)" };
  if (score >= 40) return { letter: "D", color: "var(--accent-orange)" };
  return { letter: "F", color: "var(--accent-red)" };
}

function getInsights(summaries: DailySummary[]): { good: string[]; improve: string[] } {
  const totalMinutes = summaries.reduce((a, s) => a + s.total_minutes, 0);
  const productiveMinutes = summaries.reduce((a, s) => a + s.productive_minutes, 0);
  const distractingMinutes = summaries.reduce((a, s) => a + s.distracting_minutes, 0);
  const commits = summaries.reduce((a, s) => a + s.commit_count, 0);
  const productivity = totalMinutes > 0 ? (productiveMinutes / totalMinutes) * 100 : 0;

  const good: string[] = [];
  const improve: string[] = [];

  if (productivity >= 70) good.push("Verimlilik oraniniz cok iyi");
  if (productivity >= 50 && productivity < 70) good.push("Verimlilik oraniniz iyi seviyede");
  if (commits > 5) good.push(`${commits} commit ile uretken bir gun`);
  if (commits > 0 && commits <= 5) good.push("Kodunuzu commit ettiniz");
  if (totalMinutes > 300) good.push("5+ saat calistiniz");

  if (productivity < 50) improve.push("Verimlilik oranini artirmaya calisin");
  if (distractingMinutes > 60) improve.push("Dikkat dagitici sureler fazla, odak modasini deneyin");
  if (commits === 0) improve.push("Bugun hic commit yapilmadi");
  if (totalMinutes < 120) improve.push("Calisma suresi kisa kaldi");
  if (totalMinutes > 480) improve.push("Uzun calisma suresi, mola vermeyi unutmayin");

  if (good.length === 0) good.push("Yarin daha iyi olacak!");
  if (improve.length === 0) improve.push("Mukemmel bir gun, boyle devam!");

  return { good, improve };
}

/* ------------------------------------------------------------------ */
/*  Overlay styles                                                     */
/* ------------------------------------------------------------------ */

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  backdropFilter: "blur(4px)",
  zIndex: 10000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  animation: "fadeIn 0.3s ease",
};

const modalStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 520,
  maxHeight: "85vh",
  overflow: "auto",
  padding: "32px 28px",
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DayEndSummary() {
  const [visible, setVisible] = useState(false);
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [note, setNote] = useState("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check every minute if it's after 18:00
    const checkTime = () => {
      const hour = new Date().getHours();
      const todayKey = `day_end_dismissed_${new Date().toISOString().split("T")[0]}`;
      const wasDismissed = sessionStorage.getItem(todayKey);

      if (hour >= 18 && !wasDismissed && !dismissed) {
        // Fetch today's data
        invoke<DailySummary[]>("get_today_summary")
          .then((data) => {
            if (data.length > 0) {
              setSummaries(data);
              setVisible(true);
            }
          })
          .catch(() => { /* ignore */ });
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, [dismissed]);

  const handleDismiss = () => {
    const todayKey = `day_end_dismissed_${new Date().toISOString().split("T")[0]}`;
    sessionStorage.setItem(todayKey, "true");
    setDismissed(true);
    setVisible(false);

    // Save note if entered
    if (note.trim()) {
      invoke("save_setting", {
        key: `tomorrow_note_${new Date().toISOString().split("T")[0]}`,
        value: note.trim(),
      }).catch(() => { /* ignore */ });
    }
  };

  if (!visible || summaries.length === 0) return null;

  /* -- Computed stats ------------------------------------------------ */
  const totalMinutes = summaries.reduce((a, s) => a + s.total_minutes, 0);
  const productiveMinutes = summaries.reduce((a, s) => a + s.productive_minutes, 0);
  const distractingMinutes = summaries.reduce((a, s) => a + s.distracting_minutes, 0);
  const totalCommits = summaries.reduce((a, s) => a + s.commit_count, 0);
  const productivity = totalMinutes > 0 ? (productiveMinutes / totalMinutes) * 100 : 0;
  const grade = getGrade(productivity);
  const insights = getInsights(summaries);

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && handleDismiss()}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
            Gunun Ozeti
          </div>

          {/* Grade Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 72,
              height: 72,
              borderRadius: "50%",
              border: `3px solid ${grade.color}`,
              background: `${grade.color}15`,
              fontSize: 36,
              fontWeight: 800,
              color: grade.color,
              fontFamily: "'JetBrains Mono', monospace",
              marginBottom: 8,
            }}
          >
            {grade.letter}
          </div>

          <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            %{productivity.toFixed(0)} verimlilik
          </div>
        </div>

        {/* Stats Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginBottom: 20,
          }}
        >
          {[
            { label: "Toplam Sure", value: formatMinutes(totalMinutes), color: "var(--accent-blue)" },
            { label: "Uretken Sure", value: formatMinutes(productiveMinutes), color: "var(--accent-green)" },
            { label: "Dikkat Dagitici", value: formatMinutes(distractingMinutes), color: "var(--accent-red)" },
            { label: "Commitler", value: String(totalCommits), color: "var(--accent-purple)" },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                padding: "12px 14px",
                background: "var(--bg-secondary)",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{stat.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: stat.color, fontFamily: "'JetBrains Mono', monospace" }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Per-Project Comparison */}
        {summaries.length > 1 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Proje Bazli
            </div>
            {summaries
              .filter((s) => s.project_name)
              .sort((a, b) => b.total_minutes - a.total_minutes)
              .map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    background: i % 2 === 0 ? "var(--bg-secondary)" : "transparent",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{s.project_name}</span>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {s.commit_count} commit
                    </span>
                    <span
                      className="mono"
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--accent-blue)",
                      }}
                    >
                      {formatMinutes(s.total_minutes)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Insights */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          {/* What went well */}
          <div
            style={{
              padding: 14,
              background: "rgba(34,197,94,0.06)",
              borderRadius: "var(--radius)",
              border: "1px solid rgba(34,197,94,0.15)",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--accent-green)", fontWeight: 600, marginBottom: 8 }}>
              Iyi Giden
            </div>
            {insights.good.map((item, i) => (
              <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.8, display: "flex", gap: 6 }}>
                <span style={{ color: "var(--accent-green)" }}>&#10003;</span>
                {item}
              </div>
            ))}
          </div>

          {/* What to improve */}
          <div
            style={{
              padding: 14,
              background: "rgba(234,179,8,0.06)",
              borderRadius: "var(--radius)",
              border: "1px solid rgba(234,179,8,0.15)",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--accent-yellow)", fontWeight: 600, marginBottom: 8 }}>
              Gelistirilebilir
            </div>
            {insights.improve.map((item, i) => (
              <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.8, display: "flex", gap: 6 }}>
                <span style={{ color: "var(--accent-yellow)" }}>&#9679;</span>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Tomorrow Note */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>
            Yarin icin not
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Yarin ne uzerinde calismak istiyorsun?"
            style={{
              width: "100%",
              minHeight: 64,
              padding: "10px 14px",
              background: "var(--bg-primary)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              color: "var(--text-primary)",
              fontSize: 13,
              resize: "vertical",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button className="btn" onClick={handleDismiss} style={{ fontSize: 13 }}>
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
