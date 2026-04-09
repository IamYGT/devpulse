import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Project, DailySummary } from "../../types";

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
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function QuickProjectSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<number[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load recent project order from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("devpulse_recent_projects");
      if (stored) {
        setRecentIds(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch data when opening
  useEffect(() => {
    if (isOpen) {
      Promise.all([
        invoke<Project[]>("get_projects"),
        invoke<DailySummary[]>("get_today_summary"),
      ])
        .then(([p, s]) => {
          setProjects(p);
          setSummaries(s);
        })
        .catch(() => {});

      // Focus input after a tick
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global keyboard shortcut: Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setSearch("");
        setSelectedIndex(0);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Sort: recent first, then alphabetical
  const sortedProjects = [...projects].sort((a, b) => {
    const aIdx = recentIds.indexOf(a.id);
    const bIdx = recentIds.indexOf(b.id);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.name.localeCompare(b.name);
  });

  // Filter by search
  const filtered = sortedProjects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  // Get summary for a project
  const getSummary = (projectId: number): DailySummary | undefined =>
    summaries.find((s) => s.project_id === projectId);

  // Switch project
  const switchProject = useCallback(
    async (project: Project) => {
      try {
        await invoke("set_active_project", { projectId: project.id });
      } catch (err) {
        console.error("Proje degistirilemedi:", err);
      }

      // Update recent list
      const newRecent = [project.id, ...recentIds.filter((id) => id !== project.id)].slice(0, 10);
      setRecentIds(newRecent);
      localStorage.setItem("devpulse_recent_projects", JSON.stringify(newRecent));

      setIsOpen(false);
    },
    [recentIds],
  );

  // Keyboard navigation within the list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      switchProject(filtered[selectedIndex]);
    }
  };

  // Reset selected index when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  if (!isOpen) {
    // Floating trigger button
    return (
      <button
        onClick={() => {
          setIsOpen(true);
          setSearch("");
          setSelectedIndex(0);
        }}
        title="Hizli proje degistir (Ctrl+K)"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "var(--accent-blue)",
          border: "none",
          color: "#fff",
          fontSize: 20,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 16px rgba(99, 102, 241, 0.4)",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
          zIndex: 999,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "scale(1.1)";
          (e.currentTarget as HTMLElement).style.boxShadow =
            "0 6px 24px rgba(99, 102, 241, 0.6)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "scale(1)";
          (e.currentTarget as HTMLElement).style.boxShadow =
            "0 4px 16px rgba(99, 102, 241, 0.4)";
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </button>
    );
  }

  // Modal overlay
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "15vh",
        zIndex: 1000,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        ref={containerRef}
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          width: "100%",
          maxWidth: 480,
          maxHeight: "60vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 16px 48px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Proje ara..."
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              color: "var(--text-primary)",
              fontSize: 14,
              outline: "none",
              padding: 0,
            }}
          />
          <span
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              padding: "2px 6px",
              borderRadius: 4,
              border: "1px solid var(--border)",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            ESC
          </span>
        </div>

        {/* Project list */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {filtered.length === 0 ? (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: 13,
              }}
            >
              Proje bulunamadi
            </div>
          ) : (
            filtered.map((project, index) => {
              const summary = getSummary(project.id);
              const usedMinutes = summary?.total_minutes ?? 0;
              const budgetMinutes = project.daily_budget_minutes;
              const remaining =
                budgetMinutes > 0
                  ? Math.max(budgetMinutes - usedMinutes, 0)
                  : 0;
              const isSelected = index === selectedIndex;
              const isRecent = recentIds.includes(project.id);

              return (
                <div
                  key={project.id}
                  onClick={() => switchProject(project)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    padding: "10px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    cursor: "pointer",
                    background: isSelected
                      ? "rgba(99, 102, 241, 0.12)"
                      : "transparent",
                    borderLeft: isSelected
                      ? "3px solid var(--accent-blue)"
                      : "3px solid transparent",
                    transition: "all 0.1s ease",
                  }}
                >
                  {/* Project info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {project.name}
                      </span>
                      {isRecent && (
                        <span
                          style={{
                            fontSize: 9,
                            color: "var(--accent-blue)",
                            fontWeight: 600,
                            letterSpacing: 0.5,
                          }}
                        >
                          SON
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginTop: 2,
                      }}
                    >
                      {project.category}
                      {project.path && (
                        <span
                          className="mono"
                          style={{ marginLeft: 8, fontSize: 10 }}
                        >
                          {project.path.length > 30
                            ? "..." + project.path.slice(-30)
                            : project.path}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Time info */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div
                      className="mono"
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {formatMinutes(usedMinutes)}
                    </div>
                    {budgetMinutes > 0 && (
                      <div
                        className="mono"
                        style={{
                          fontSize: 10,
                          color:
                            remaining > 0
                              ? "var(--accent-green)"
                              : "var(--accent-red)",
                        }}
                      >
                        {remaining > 0
                          ? `${formatMinutes(remaining)} kaldi`
                          : "Butce doldu"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: "8px 16px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 16,
            fontSize: 10,
            color: "var(--text-muted)",
          }}
        >
          <span>
            <span
              className="mono"
              style={{
                padding: "1px 4px",
                border: "1px solid var(--border)",
                borderRadius: 3,
                marginRight: 4,
              }}
            >
              &#8593;&#8595;
            </span>
            Gezin
          </span>
          <span>
            <span
              className="mono"
              style={{
                padding: "1px 4px",
                border: "1px solid var(--border)",
                borderRadius: 3,
                marginRight: 4,
              }}
            >
              Enter
            </span>
            Sec
          </span>
          <span>
            <span
              className="mono"
              style={{
                padding: "1px 4px",
                border: "1px solid var(--border)",
                borderRadius: 3,
                marginRight: 4,
              }}
            >
              Esc
            </span>
            Kapat
          </span>
        </div>
      </div>
    </div>
  );
}
