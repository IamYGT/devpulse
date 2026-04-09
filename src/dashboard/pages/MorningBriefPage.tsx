import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PlannedProject {
  name: string;
  planned_minutes: number;
  priority: string;
  last_active: string | null;
  pending_commits: boolean;
}

interface YesterdaySummary {
  total_hours: number;
  productivity: number;
  top_project: string;
  schedule_adherence: number;
}

interface MorningBrief {
  greeting: string;
  date: string;
  planned_projects: PlannedProject[];
  yesterday_summary: YesterdaySummary;
  streak_days: number;
  tip_of_the_day: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = [
    "Ocak", "Subat", "Mart", "Nisan", "Mayis", "Haziran",
    "Temmuz", "Agustos", "Eylul", "Ekim", "Kasim", "Aralik",
  ];
  const days = [
    "Pazar", "Pazartesi", "Sali", "Carsamba",
    "Persembe", "Cuma", "Cumartesi",
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${days[d.getDay()]}`;
}

function gradeColor(productivity: number): string {
  if (productivity >= 80) return "var(--accent-green)";
  if (productivity >= 60) return "var(--accent-blue)";
  if (productivity >= 40) return "var(--accent-yellow)";
  if (productivity >= 20) return "var(--accent-orange)";
  return "var(--accent-red)";
}

function priorityBadge(priority: string): { bg: string; text: string } {
  switch (priority) {
    case "P0":
      return { bg: "rgba(239, 68, 68, 0.15)", text: "var(--accent-red)" };
    case "P1":
      return { bg: "rgba(249, 115, 22, 0.15)", text: "var(--accent-orange)" };
    case "P2":
      return { bg: "rgba(99, 102, 241, 0.15)", text: "var(--accent-blue)" };
    default:
      return { bg: "rgba(148, 163, 184, 0.15)", text: "var(--text-muted)" };
  }
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Hic aktif degil";
  const now = new Date();
  const then = new Date(dateStr);
  const diffHours = Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60));
  if (diffHours < 1) return "Az once";
  if (diffHours < 24) return `${diffHours} saat once`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Dun";
  return `${diffDays} gun once`;
}

/* ------------------------------------------------------------------ */
/*  SVG Icons                                                          */
/* ------------------------------------------------------------------ */

const IconSun = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-yellow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const IconFire = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </svg>
);

const IconTarget = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconGit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <line x1="3" y1="12" x2="9" y2="12" />
    <line x1="15" y1="12" x2="21" y2="12" />
  </svg>
);

const IconBulb = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-yellow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
  </svg>
);

const IconPlay = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MorningBriefPage() {
  const [brief, setBrief] = useState<MorningBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const result = await invoke<MorningBrief>("get_morning_brief");
        setBrief(result);
      } catch (err) {
        console.error("Failed to fetch morning brief:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (dismissed) return null;

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 24, color: "var(--text-muted)" }}>Hazirlaniyorum...</div>
      </div>
    );
  }

  if (!brief) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 18, color: "var(--text-muted)" }}>
          Sabah brifingi yuklenemedi.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 24px", maxWidth: 800, margin: "0 auto" }}>
      {/* Greeting Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 8,
        }}
      >
        <IconSun />
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            margin: 0,
            background: "linear-gradient(135deg, var(--accent-yellow), var(--accent-orange))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {brief.greeting}
        </h1>
      </div>
      <div
        style={{
          fontSize: 14,
          color: "var(--text-muted)",
          marginBottom: 32,
          paddingLeft: 48,
        }}
      >
        {formatDate(brief.date)}
      </div>

      {/* Streak Badge */}
      {brief.streak_days > 0 && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 100,
            background: "rgba(249, 115, 22, 0.1)",
            border: "1px solid rgba(249, 115, 22, 0.2)",
            marginBottom: 24,
          }}
        >
          <IconFire />
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--accent-orange)" }}>
            {brief.streak_days} gun ust uste uretken calistin!
          </span>
        </div>
      )}

      {/* Yesterday Recap */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Dunun Ozeti</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 16,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: gradeColor(brief.yesterday_summary.productivity),
              }}
            >
              {brief.yesterday_summary.total_hours.toFixed(1)}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Saat</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: gradeColor(brief.yesterday_summary.productivity),
              }}
            >
              %{brief.yesterday_summary.productivity.toFixed(0)}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Verimlilik</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "var(--text-primary)",
                marginTop: 8,
              }}
            >
              {brief.yesterday_summary.top_project}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>En Cok Calisan</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: gradeColor(brief.yesterday_summary.schedule_adherence),
              }}
            >
              %{brief.yesterday_summary.schedule_adherence.toFixed(0)}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Plan Uyumu</div>
          </div>
        </div>
      </div>

      {/* Today's Plan */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <IconTarget />
          <span className="card-title" style={{ margin: 0 }}>
            Bugunun Plani
          </span>
        </div>

        {brief.planned_projects.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>
            Henuz bir plan veya butce tanimlanmamis. Projelerine butce ekleyerek basla!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {brief.planned_projects.map((project, i) => {
              const badge = priorityBadge(project.priority);
              const hours = Math.floor(project.planned_minutes / 60);
              const mins = project.planned_minutes % 60;
              const timeStr = hours > 0 ? `${hours}s ${mins}dk` : `${mins}dk`;

              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    background: "var(--bg-secondary)",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {/* Priority badge */}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 100,
                      background: badge.bg,
                      color: badge.text,
                    }}
                  >
                    {project.priority}
                  </span>

                  {/* Project name */}
                  <span
                    style={{
                      flex: 1,
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {project.name}
                  </span>

                  {/* Pending commits indicator */}
                  {project.pending_commits && (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11,
                        color: "var(--accent-orange)",
                      }}
                      title="Dunku commitleri kontrol et"
                    >
                      <IconGit />
                      bekleyen
                    </span>
                  )}

                  {/* Last active */}
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      color: "var(--text-muted)",
                    }}
                  >
                    <IconClock />
                    {timeAgo(project.last_active)}
                  </span>

                  {/* Planned time */}
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--accent-blue)",
                      minWidth: 60,
                      textAlign: "right",
                    }}
                  >
                    {timeStr}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tip of the Day */}
      <div
        className="card"
        style={{
          marginBottom: 24,
          background: "rgba(234, 179, 8, 0.06)",
          borderLeft: "3px solid var(--accent-yellow)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <span style={{ flexShrink: 0, marginTop: 2 }}>
            <IconBulb />
          </span>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--accent-yellow)",
                marginBottom: 4,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Gunun Ipucu
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-primary)" }}>
              {brief.tip_of_the_day}
            </div>
          </div>
        </div>
      </div>

      {/* Start Working Button */}
      <div style={{ textAlign: "center" }}>
        <button
          onClick={() => setDismissed(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 36px",
            fontSize: 16,
            fontWeight: 700,
            border: "none",
            borderRadius: "var(--radius)",
            background: "linear-gradient(135deg, var(--accent-blue), var(--accent-green))",
            color: "#fff",
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(99, 102, 241, 0.3)",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.transform = "translateY(-2px)";
            (e.target as HTMLButtonElement).style.boxShadow =
              "0 6px 20px rgba(99, 102, 241, 0.4)";
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.transform = "translateY(0)";
            (e.target as HTMLButtonElement).style.boxShadow =
              "0 4px 16px rgba(99, 102, 241, 0.3)";
          }}
        >
          <IconPlay />
          Ise Basla
        </button>
      </div>
    </div>
  );
}
