import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Project, DailySummary } from "../../types";

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return `${h}s ${m}dk`;
  return `${m}dk`;
}

export default function BudgetPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [budgetInput, setBudgetInput] = useState("");

  const fetchData = async () => {
    try {
      const [p, s] = await Promise.all([
        invoke<Project[]>("get_projects"),
        invoke<DailySummary[]>("get_today_summary"),
      ]);
      setProjects(p);
      setSummaries(s);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveBudget = async (projectId: number) => {
    const minutes = parseInt(budgetInput, 10);
    if (isNaN(minutes) || minutes < 0) return;
    try {
      await invoke("set_project_budget", { projectId, minutes });
      setEditingId(null);
      setBudgetInput("");
      await fetchData();
    } catch (err) {
      console.error("Budget kaydetme hatasi:", err);
    }
  };

  return (
    <div>
      <h1 className="page-title">Proje Butceleri</h1>

      {projects.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {projects.map((project) => {
            const summary = summaries.find((s) => s.project_id === project.id);
            const usedMinutes = summary?.total_minutes || 0;
            const budget = project.daily_budget_minutes;
            const pct = budget > 0 ? (usedMinutes / budget) * 100 : 0;

            const barColor =
              pct > 100
                ? "red"
                : pct >= 80
                  ? "orange"
                  : pct >= 50
                    ? "yellow"
                    : "green";

            return (
              <div key={project.id} className="card">
                {/* Header: project info left, time info right */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>
                      {project.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginTop: 2,
                      }}
                    >
                      {project.path || "Yol belirtilmemis"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      className="mono"
                      style={{ fontSize: 20, fontWeight: 700 }}
                    >
                      {formatMinutes(usedMinutes)}
                    </div>
                    {budget > 0 && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          marginTop: 2,
                        }}
                      >
                        / {formatMinutes(budget)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {budget > 0 && (
                  <>
                    <div className="progress-bar" style={{ marginTop: 12 }}>
                      <div
                        className={`progress-bar-fill ${barColor}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        marginTop: 4,
                        textAlign: "right",
                      }}
                    >
                      %{pct.toFixed(0)}
                    </div>
                  </>
                )}

                {/* Edit budget controls */}
                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  {editingId === project.id ? (
                    <>
                      <input
                        type="number"
                        value={budgetInput}
                        onChange={(e) => setBudgetInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveBudget(project.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        placeholder="Dakika orn: 120"
                        autoFocus
                        style={{
                          padding: "6px 10px",
                          background: "var(--bg-primary)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius)",
                          color: "var(--text-primary)",
                          fontFamily: "var(--font-mono, monospace)",
                          fontSize: 13,
                          width: 160,
                        }}
                      />
                      <button
                        className="btn btn-primary"
                        onClick={() => handleSaveBudget(project.id)}
                      >
                        Kaydet
                      </button>
                      <button
                        className="btn"
                        onClick={() => {
                          setEditingId(null);
                          setBudgetInput("");
                        }}
                      >
                        Iptal
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn"
                      onClick={() => {
                        setEditingId(project.id);
                        setBudgetInput(budget > 0 ? budget.toString() : "");
                      }}
                    >
                      {budget > 0 ? "Butceyi Duzenle" : "Butce Belirle"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          Henuz proje yok - VS Code'da calismaya basladiginda projeler otomatik
          olusturulacak
        </div>
      )}
    </div>
  );
}
