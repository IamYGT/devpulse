import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { useInterval } from "../../hooks/useInterval";
import type { Project, DailySummary } from "../../types";
import ProjectHealthCard, {
  getProjectHealth,
  type ProjectHealthData,
  type HealthStatus,
} from "../components/ProjectHealthCard";
import ProjectAllocationChart from "../components/ProjectAllocationChart";
import NeglectedProjectsBanner, {
  type NeglectedProject,
} from "../components/NeglectedProjectsBanner";
import ProjectJournal from "../components/ProjectJournal";
import CrossProjectComparison from "../components/CrossProjectComparison";
import QuickProjectSwitcher from "../components/QuickProjectSwitcher";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h > 0) return `${h}s ${m}dk`;
  return `${m}dk`;
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [lastActiveDates, setLastActiveDates] = useState<
    Record<number, string | null>
  >({});
  const [weekCommits, setWeekCommits] = useState<Record<number, number>>({});
  const [selectedJournalProject, setSelectedJournalProject] = useState<Project | null>(null);

  /* -- Data fetching ------------------------------------------------ */
  const fetchData = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        invoke<Project[]>("get_projects"),
        invoke<DailySummary[]>("get_today_summary"),
      ]);
      setProjects(p);
      setSummaries(s);

      // Fetch last active dates per project
      const lastActiveMap: Record<number, string | null> = {};
      const weekCommitsMap: Record<number, number> = {};

      await Promise.all(
        p.map(async (project) => {
          try {
            const lastDate = await invoke<string | null>(
              "get_project_last_active",
              { projectId: project.id },
            );
            lastActiveMap[project.id] = lastDate;
          } catch {
            lastActiveMap[project.id] = null;
          }

          try {
            const commits = await invoke<number>("get_project_week_commits", {
              projectId: project.id,
            });
            weekCommitsMap[project.id] = commits;
          } catch {
            weekCommitsMap[project.id] = 0;
          }
        }),
      );

      setLastActiveDates(lastActiveMap);
      setWeekCommits(weekCommitsMap);
    } catch (err) {
      console.error("Proje verileri alinamadi:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useInterval(fetchData, 30000);

  /* -- Computed data ------------------------------------------------ */

  const projectHealthData: ProjectHealthData[] = projects.map((p) => ({
    project: p,
    todaySummary: summaries.find((s) => s.project_id === p.id) ?? null,
    lastActive: lastActiveDates[p.id] ?? null,
    weekCommits: weekCommits[p.id] ?? 0,
  }));

  // Count by health status
  const healthCounts: Record<HealthStatus, number> = {
    on_track: 0,
    behind: 0,
    neglected: 0,
    no_budget: 0,
  };

  projectHealthData.forEach((d) => {
    const health = getProjectHealth(d.project, d.todaySummary, d.lastActive);
    healthCounts[health]++;
  });

  // Neglected projects for banner
  const neglectedProjects: NeglectedProject[] = projectHealthData
    .filter((d) => {
      if (!d.lastActive) return d.project.daily_budget_minutes > 0;
      const diffDays =
        (new Date().getTime() - new Date(d.lastActive).getTime()) /
        (1000 * 60 * 60 * 24);
      return diffDays > 2;
    })
    .map((d) => {
      const diffDays = d.lastActive
        ? Math.floor(
            (new Date().getTime() - new Date(d.lastActive).getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : 999;
      return {
        project: d.project,
        lastActive: d.lastActive,
        daysSinceActive: diffDays,
      };
    });

  // Total today's time
  const totalTodayMinutes = summaries.reduce((a, s) => a + s.total_minutes, 0);

  /* -- Actions ------------------------------------------------------ */

  const handleSwitchProject = async (projectId: number) => {
    try {
      await invoke("set_active_project", { projectId });
      // Update recent list in localStorage
      const stored = localStorage.getItem("devpulse_recent_projects");
      const recent: number[] = stored ? JSON.parse(stored) : [];
      const updated = [projectId, ...recent.filter((id) => id !== projectId)].slice(0, 10);
      localStorage.setItem("devpulse_recent_projects", JSON.stringify(updated));
    } catch (err) {
      console.error("Proje degistirilemedi:", err);
    }
  };

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div>
      <h1 className="page-title">Proje Portfoyu</h1>

      {/* ============ NEGLECTED ALERT BANNER ============ */}
      <NeglectedProjectsBanner
        neglectedProjects={neglectedProjects}
        onProjectClick={(id) => {
          const project = projects.find((p) => p.id === id);
          if (project) setSelectedJournalProject(project);
        }}
      />

      {/* ============ TOP STATS ROW ============ */}
      <div className="stats-grid">
        {/* Total projects */}
        <div className="stat-card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent-blue)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span className="label">Toplam Proje</span>
          </div>
          <div className="value blue">{projects.length}</div>
        </div>

        {/* On track */}
        <div className="stat-card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent-green)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span className="label">Yolunda</span>
          </div>
          <div className="value green">{healthCounts.on_track}</div>
        </div>

        {/* Behind */}
        <div className="stat-card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent-yellow)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="label">Geride</span>
          </div>
          <div className="value yellow">{healthCounts.behind}</div>
        </div>

        {/* Neglected */}
        <div className="stat-card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent-red)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span className="label">Ihmal Edilmis</span>
          </div>
          <div className="value red">{healthCounts.neglected}</div>
        </div>

        {/* Today total time */}
        <div className="stat-card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent-purple)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span className="label">Bugun Toplam</span>
          </div>
          <div className="value purple">{formatMinutes(totalTodayMinutes)}</div>
        </div>
      </div>

      {/* ============ TIME ALLOCATION PIE + COMPARISON CHARTS ============ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 16,
        }}
      >
        {/* Pie Chart */}
        <div className="card">
          <div className="card-title">Bugunun Zaman Dagilimi</div>
          <ProjectAllocationChart projects={projects} summaries={summaries} />
        </div>

        {/* Cross-project comparison */}
        <div className="card">
          <div className="card-title">Haftalik Karsilastirma</div>
          <CrossProjectComparison projects={projects} />
        </div>
      </div>

      {/* ============ PROJECT HEALTH GRID ============ */}
      <div className="card" style={{ padding: 16 }}>
        <div className="card-title" style={{ marginBottom: 16, paddingLeft: 4 }}>
          Proje Saglik Durumu
        </div>
        {projects.length === 0 ? (
          <div className="empty-state" style={{ padding: "40px 20px" }}>
            <div className="empty-icon">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <h3>Henuz proje yok</h3>
            <p>Ayarlar sayfasindan proje ekleyerek baslayabilirsin.</p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 16,
            }}
          >
            {projectHealthData.map((data) => (
              <ProjectHealthCard
                key={data.project.id}
                data={data}
                onSwitchProject={handleSwitchProject}
                onNavigate={handleNavigate}
              />
            ))}
          </div>
        )}
      </div>

      {/* ============ PROJECT JOURNAL (selected project) ============ */}
      {selectedJournalProject ? (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span />
            <button
              className="btn"
              style={{ fontSize: 11, padding: "4px 10px" }}
              onClick={() => setSelectedJournalProject(null)}
            >
              Notu Kapat
            </button>
          </div>
          <ProjectJournal
            projectId={selectedJournalProject.id}
            projectName={selectedJournalProject.name}
          />
        </div>
      ) : projects.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <div className="card">
            <div className="card-title">Proje Notlari</div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 8,
              }}
            >
              {projects.map((p) => (
                <button
                  key={p.id}
                  className="btn"
                  style={{ fontSize: 12, padding: "6px 14px" }}
                  onClick={() => setSelectedJournalProject(p)}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                marginTop: 12,
              }}
            >
              Notlarini gormek icin bir proje sec
            </div>
          </div>
        </div>
      ) : null}

      {/* ============ QUICK PROJECT SWITCHER (floating) ============ */}
      <QuickProjectSwitcher />
    </div>
  );
}
