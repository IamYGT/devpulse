import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import TodoItem, { type Todo } from "./TodoItem";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type FilterTab = "all" | "active" | "done";
type SortKey = "priority" | "due_date" | "created_at";

interface TodoListProps {
  projectId?: number;
}

interface ProjectGroup {
  projectName: string | null;
  todos: Todo[];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function TodoList({ projectId }: TodoListProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [sortBy, setSortBy] = useState<SortKey>("priority");
  const [groupByProject, setGroupByProject] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Fetch ────────────────────────────────────────────────── */
  const fetchTodos = useCallback(async () => {
    setLoading(true);
    try {
      const isDone =
        filter === "active" ? false : filter === "done" ? true : undefined;
      const result = await invoke<Todo[]>("get_todos", {
        projectId: projectId ?? null,
        isDone: isDone ?? null,
      });
      setTodos(result);
    } catch {
      setTodos([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, filter]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  /* ── Add new ──────────────────────────────────────────────── */
  const handleAdd = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    try {
      await invoke("create_todo", {
        title: trimmed,
        projectId: projectId ?? null,
        priority: 3,
      });
      setNewTitle("");
      await fetchTodos();
      inputRef.current?.focus();
    } catch (err) {
      console.error("Gorev eklenemedi:", err);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  /* ── Delete ───────────────────────────────────────────────── */
  const handleDelete = async (id: number) => {
    try {
      await invoke("delete_todo", { id });
      await fetchTodos();
    } catch (err) {
      console.error("Gorev silinemedi:", err);
    }
  };

  /* ── Drag & drop reorder ──────────────────────────────────── */
  const dragItemId = useRef<number | null>(null);

  const handleDragStart = (_e: React.DragEvent, id: number) => {
    dragItemId.current = id;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (_e: React.DragEvent, targetId: number) => {
    const sourceId = dragItemId.current;
    dragItemId.current = null;
    if (sourceId === null || sourceId === targetId) return;

    // Local reorder
    const updated = [...todos];
    const sourceIdx = updated.findIndex((t) => t.id === sourceId);
    const targetIdx = updated.findIndex((t) => t.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const [moved] = updated.splice(sourceIdx, 1);
    updated.splice(targetIdx, 0, moved);

    // Update positions
    const reordered = updated.map((t, i) => ({ ...t, position: i }));
    setTodos(reordered);

    try {
      await invoke("reorder_todos", {
        ids: reordered.map((t) => t.id),
      });
    } catch {
      // Revert on failure
      await fetchTodos();
    }
  };

  /* ── Sort ─────────────────────────────────────────────────── */
  const sortedTodos = [...todos].sort((a, b) => {
    if (sortBy === "priority") return a.priority - b.priority;
    if (sortBy === "due_date") {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    // created_at
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  /* ── Group by project ─────────────────────────────────────── */
  const grouped: ProjectGroup[] = [];
  if (groupByProject) {
    const map = new Map<string | null, Todo[]>();
    for (const t of sortedTodos) {
      const key = t.project_name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    for (const [projectName, items] of map) {
      grouped.push({ projectName, todos: items });
    }
  }

  /* ── Filter tabs ──────────────────────────────────────────── */
  const filterTabs: { id: FilterTab; label: string }[] = [
    { id: "all", label: "Tumu" },
    { id: "active", label: "Aktif" },
    { id: "done", label: "Tamamlandi" },
  ];

  const sortOptions: { id: SortKey; label: string }[] = [
    { id: "priority", label: "Oncelik" },
    { id: "due_date", label: "Tarih" },
    { id: "created_at", label: "Olusturma" },
  ];

  /* ── Styles ───────────────────────────────────────────────── */
  const containerStyle: CSSProperties = {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };

  const tabBarStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 0,
    borderBottom: "1px solid var(--border)",
    paddingBottom: 0,
  };

  const tabBtnStyle = (active: boolean): CSSProperties => ({
    padding: "8px 16px",
    fontSize: 12,
    fontWeight: active ? 600 : 500,
    color: active ? "var(--text-primary)" : "var(--text-secondary)",
    background: "transparent",
    border: "none",
    borderBottom: active ? "2px solid var(--accent-blue)" : "2px solid transparent",
    cursor: "pointer",
    transition: "all 0.2s ease",
    fontFamily: "inherit",
  });

  const toolbarStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  };

  const selectStyle: CSSProperties = {
    fontSize: 11,
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--bg-secondary)",
    color: "var(--text-secondary)",
    cursor: "pointer",
    fontFamily: "inherit",
  };

  const inputStyle: CSSProperties = {
    flex: 1,
    fontSize: 13,
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
    outline: "none",
    fontFamily: "inherit",
    transition: "border-color 0.2s ease",
  };

  const groupHeaderStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    padding: "8px 12px 4px",
  };

  const emptyStyle: CSSProperties = {
    textAlign: "center",
    padding: "24px 0",
    fontSize: 13,
    color: "var(--text-muted)",
  };

  /* ── Render ───────────────────────────────────────────────── */
  const renderTodoList = (items: Todo[]) =>
    items.map((todo) => (
      <TodoItem
        key={todo.id}
        todo={todo}
        onUpdate={fetchTodos}
        onDelete={handleDelete}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      />
    ));

  return (
    <div style={containerStyle}>
      {/* Input */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          ref={inputRef}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Yeni Gorev..."
          style={inputStyle}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--accent-blue)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        />
        <button
          className="btn btn-primary"
          onClick={handleAdd}
          disabled={!newTitle.trim()}
          style={{ fontSize: 12, padding: "6px 16px", flexShrink: 0 }}
        >
          Ekle
        </button>
      </div>

      {/* Filter tabs */}
      <div style={tabBarStyle}>
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            style={tabBtnStyle(filter === tab.id)}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Toolbar: sort + group toggle */}
      <div style={toolbarStyle}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Sirala:</span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          style={selectStyle}
        >
          {sortOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>

        {!projectId && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              color: "var(--text-muted)",
              cursor: "pointer",
              marginLeft: "auto",
            }}
          >
            <input
              type="checkbox"
              checked={groupByProject}
              onChange={(e) => setGroupByProject(e.target.checked)}
              style={{ accentColor: "var(--accent-blue)" }}
            />
            Projeye gore grupla
          </label>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div style={emptyStyle}>Yukleniyor...</div>
      ) : sortedTodos.length === 0 ? (
        <div style={emptyStyle}>
          {filter === "done"
            ? "Tamamlanan gorev yok."
            : filter === "active"
            ? "Aktif gorev yok. Harika!"
            : "Henuz gorev eklenmedi."}
        </div>
      ) : groupByProject ? (
        grouped.map((g, i) => (
          <div key={g.projectName ?? `no-project-${i}`}>
            <div style={groupHeaderStyle}>
              {g.projectName ?? "Projsiz"}
            </div>
            {renderTodoList(g.todos)}
          </div>
        ))
      ) : (
        renderTodoList(sortedTodos)
      )}

      {/* Count */}
      {sortedTodos.length > 0 && (
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            textAlign: "right",
            paddingTop: 4,
          }}
        >
          {sortedTodos.filter((t) => !t.is_done).length} aktif /{" "}
          {sortedTodos.length} toplam
        </div>
      )}
    </div>
  );
}
