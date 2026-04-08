import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";

interface TimelineEntry {
  timestamp: string;
  duration_seconds: number;
  process_name: string;
  window_title: string;
  project_name: string | null;
  category: string;
  is_idle: boolean;
}

type SortField = "timestamp" | "process_name" | "window_title" | "project_name" | "category" | "duration_seconds";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 50;

const categoryBadgeStyle = (category: string): React.CSSProperties => {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 100,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 0.3,
  };

  switch (category) {
    case "productive":
      return { ...base, background: "rgba(34, 197, 94, 0.12)", color: "var(--accent-green)" };
    case "distracting":
      return { ...base, background: "rgba(239, 68, 68, 0.12)", color: "var(--accent-red)" };
    default:
      return { ...base, background: "rgba(85, 85, 119, 0.2)", color: "var(--text-secondary)" };
  }
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}sn`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}dk ${s}sn` : `${m}dk`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}s ${rm}dk`;
}

function formatTime(timestamp: string): string {
  try {
    const d = new Date(timestamp);
    return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return timestamp;
  }
}

const sortIcon = (field: SortField, sortField: SortField, sortDir: SortDir) => {
  if (field !== sortField) return " ";
  return sortDir === "asc" ? " ↑" : " ↓";
};

export default function ActivityLogTable() {
  const [data, setData] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const result = await invoke<TimelineEntry[]>("get_today_timeline");
        setData(result);
      } catch (err) {
        console.error("Failed to load timeline:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    let items = [...data];

    // Filter by category
    if (filterCategory !== "all") {
      items = items.filter((i) => i.category === filterCategory);
    }

    // Search by window title
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          (i.window_title && i.window_title.toLowerCase().includes(q)) ||
          (i.process_name && i.process_name.toLowerCase().includes(q))
      );
    }

    // Sort
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "timestamp":
          cmp = a.timestamp.localeCompare(b.timestamp);
          break;
        case "process_name":
          cmp = (a.process_name || "").localeCompare(b.process_name || "");
          break;
        case "window_title":
          cmp = (a.window_title || "").localeCompare(b.window_title || "");
          break;
        case "project_name":
          cmp = (a.project_name || "").localeCompare(b.project_name || "");
          break;
        case "category":
          cmp = a.category.localeCompare(b.category);
          break;
        case "duration_seconds":
          cmp = a.duration_seconds - b.duration_seconds;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return items;
  }, [data, filterCategory, search, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [filterCategory, search, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const thStyle: React.CSSProperties = {
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
  };

  if (loading) {
    return (
      <div className="card">
        <div className="card-title">Aktivite Kayitlari</div>
        <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "20px 0" }}>
          Yukleniyor...
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">Aktivite Kayitlari</div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 14,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          style={{ width: "auto", minWidth: 140 }}
        >
          <option value="all">Tum Kategoriler</option>
          <option value="productive">Uretken</option>
          <option value="distracting">Dikkat Dagitici</option>
          <option value="neutral">Notr</option>
        </select>

        <input
          type="text"
          placeholder="Pencere basligi veya uygulama ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 300 }}
        />

        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginLeft: "auto",
          }}
        >
          {filtered.length} kayit
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th style={thStyle} onClick={() => handleSort("timestamp")}>
                Zaman{sortIcon("timestamp", sortField, sortDir)}
              </th>
              <th style={thStyle} onClick={() => handleSort("process_name")}>
                Uygulama{sortIcon("process_name", sortField, sortDir)}
              </th>
              <th style={thStyle} onClick={() => handleSort("window_title")}>
                Pencere Basligi{sortIcon("window_title", sortField, sortDir)}
              </th>
              <th style={thStyle} onClick={() => handleSort("project_name")}>
                Proje{sortIcon("project_name", sortField, sortDir)}
              </th>
              <th style={thStyle} onClick={() => handleSort("category")}>
                Kategori{sortIcon("category", sortField, sortDir)}
              </th>
              <th style={thStyle} onClick={() => handleSort("duration_seconds")}>
                Sure{sortIcon("duration_seconds", sortField, sortDir)}
              </th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    textAlign: "center",
                    color: "var(--text-muted)",
                    padding: "24px 0",
                  }}
                >
                  Kayit bulunamadi
                </td>
              </tr>
            ) : (
              paged.map((entry, idx) => (
                <tr key={`${entry.timestamp}-${idx}`}>
                  <td
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 12,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatTime(entry.timestamp)}
                  </td>
                  <td style={{ fontWeight: 500, fontSize: 12 }}>
                    {entry.process_name || "-"}
                  </td>
                  <td
                    style={{
                      fontSize: 12,
                      maxWidth: 280,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={entry.window_title || ""}
                  >
                    {entry.window_title || "-"}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {entry.project_name || "-"}
                  </td>
                  <td>
                    <span style={categoryBadgeStyle(entry.category)}>
                      {entry.category === "productive"
                        ? "Uretken"
                        : entry.category === "distracting"
                          ? "Dagitici"
                          : "Notr"}
                    </span>
                  </td>
                  <td
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 12,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatDuration(entry.duration_seconds)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: 14,
            paddingTop: 14,
            borderTop: "1px solid var(--border)",
          }}
        >
          <button
            className="btn"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            style={{ padding: "4px 12px", fontSize: 12 }}
          >
            Onceki
          </button>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {page + 1} / {totalPages}
          </span>
          <button
            className="btn"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            style={{ padding: "4px 12px", fontSize: 12 }}
          >
            Sonraki
          </button>
        </div>
      )}
    </div>
  );
}
