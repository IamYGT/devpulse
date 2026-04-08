import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Project, GitEvent } from "../../types";

export default function GitPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [events, setEvents] = useState<GitEvent[]>([]);

  useEffect(() => {
    invoke<Project[]>("get_projects")
      .then((p) => {
        setProjects(p);
        if (p.length > 0) {
          setSelectedProject(p[0].id);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedProject === null) return;
    const today = new Date().toISOString().split("T")[0];
    invoke<GitEvent[]>("get_git_events", {
      projectId: selectedProject,
      date: today,
    })
      .then(setEvents)
      .catch(console.error);
  }, [selectedProject]);

  return (
    <div>
      <h1 className="page-title">Git Activity</h1>

      {/* Project selector */}
      {projects.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {projects.map((p) => (
            <button
              key={p.id}
              className={`btn ${selectedProject === p.id ? "btn-primary" : ""}`}
              onClick={() => setSelectedProject(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Commit list */}
      {events.length > 0 ? (
        <div className="card">
          <div className="card-title">Today's Commits</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {events.map((e) => (
              <div
                key={e.id}
                style={{
                  padding: "12px 14px",
                  background: "var(--bg-secondary)",
                  borderRadius: "var(--radius)",
                  borderLeft: "3px solid var(--accent-purple)",
                }}
              >
                {/* Header row: hash + branch/time */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <code
                    style={{
                      fontSize: 11,
                      color: "var(--accent-blue)",
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {e.commit_hash?.substring(0, 7)}
                  </code>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {e.branch && <>{e.branch} &middot; </>}
                    {e.timestamp.substring(11, 16)}
                  </span>
                </div>

                {/* Commit message */}
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    lineHeight: 1.4,
                  }}
                >
                  {e.message || "(no message)"}
                </div>

                {/* Lines added/removed */}
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                  <span style={{ color: "var(--accent-green)", fontWeight: 600 }}>
                    +{e.lines_added}
                  </span>
                  {" / "}
                  <span style={{ color: "var(--accent-red)", fontWeight: 600 }}>
                    -{e.lines_removed}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <h3>No commits today</h3>
          <p>
            {selectedProject
              ? "No commits have been made in this project today."
              : "Select a project to view commits."}
          </p>
        </div>
      )}
    </div>
  );
}
