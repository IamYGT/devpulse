import { useState, useRef, useEffect, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface Todo {
  id: number;
  title: string;
  is_done: boolean;
  priority: number; // 1-4
  due_date: string | null;
  project_id: number | null;
  project_name: string | null;
  created_at: string;
  position: number;
}

interface TodoItemProps {
  todo: Todo;
  onUpdate: () => void;
  onDelete: (id: number) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, id: number) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, id: number) => void;
}

/* ------------------------------------------------------------------ */
/*  Priority config                                                    */
/* ------------------------------------------------------------------ */

const priorityConfig: Record<number, { label: string; bg: string; fg: string }> = {
  1: { label: "P1", bg: "rgba(239,68,68,0.15)", fg: "var(--accent-red)" },
  2: { label: "P2", bg: "rgba(249,115,22,0.15)", fg: "#f97316" },
  3: { label: "P3", bg: "rgba(99,102,241,0.15)", fg: "var(--accent-blue)" },
  4: { label: "P4", bg: "rgba(136,136,170,0.12)", fg: "var(--text-muted)" },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getDueDateStatus(dueDate: string | null): "overdue" | "today" | "future" | null {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = due.getTime() - today.getTime();
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  return "future";
}

function formatDueDate(dueDate: string): string {
  try {
    const d = new Date(dueDate);
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  } catch {
    return dueDate;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function TodoItem({
  todo,
  onUpdate,
  onDelete,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
}: TodoItemProps) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(todo.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const toggleDone = async () => {
    try {
      await invoke("update_todo", { id: todo.id, isDone: !todo.is_done });
      onUpdate();
    } catch (err) {
      console.error("Todo guncellenemedi:", err);
    }
  };

  const saveEdit = async () => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === todo.title) {
      setEditText(todo.title);
      setEditing(false);
      return;
    }
    try {
      await invoke("update_todo", { id: todo.id, title: trimmed });
      onUpdate();
    } catch (err) {
      console.error("Todo guncellenemedi:", err);
    }
    setEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      setEditText(todo.title);
      setEditing(false);
    }
  };

  const dueStatus = getDueDateStatus(todo.due_date);
  const prio = priorityConfig[todo.priority] || priorityConfig[4];

  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    height: 36,
    padding: "0 12px",
    borderRadius: 6,
    background: hovered ? "var(--bg-hover)" : "transparent",
    transition: "background 0.15s ease",
    cursor: draggable ? "grab" : "default",
    opacity: todo.is_done ? 0.6 : 1,
  };

  const checkboxStyle: CSSProperties = {
    width: 16,
    height: 16,
    borderRadius: 4,
    border: todo.is_done
      ? "none"
      : "2px solid var(--text-muted)",
    background: todo.is_done ? "var(--accent-green)" : "transparent",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "all 0.15s ease",
    fontSize: 10,
    color: "#fff",
    fontWeight: 700,
  };

  const textStyle: CSSProperties = {
    flex: 1,
    fontSize: 13,
    color: "var(--text-primary)",
    textDecoration: todo.is_done ? "line-through" : "none",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  };

  const badgeBase: CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    padding: "1px 6px",
    borderRadius: 999,
    whiteSpace: "nowrap",
    flexShrink: 0,
  };

  const dueDateColor =
    dueStatus === "overdue"
      ? "var(--accent-red)"
      : dueStatus === "today"
      ? "var(--accent-yellow)"
      : "var(--text-muted)";

  const dueDateBg =
    dueStatus === "overdue"
      ? "rgba(239,68,68,0.12)"
      : dueStatus === "today"
      ? "rgba(234,179,8,0.12)"
      : "rgba(136,136,170,0.08)";

  const deleteBtnStyle: CSSProperties = {
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: 14,
    padding: "2px 4px",
    borderRadius: 4,
    opacity: hovered ? 1 : 0,
    transition: "opacity 0.15s ease, color 0.15s ease",
    flexShrink: 0,
    lineHeight: 1,
  };

  return (
    <div
      style={rowStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      draggable={draggable}
      onDragStart={draggable ? (e) => onDragStart?.(e, todo.id) : undefined}
      onDragOver={draggable ? (e) => onDragOver?.(e) : undefined}
      onDrop={draggable ? (e) => onDrop?.(e, todo.id) : undefined}
    >
      {/* Checkbox */}
      <div
        role="checkbox"
        aria-checked={todo.is_done}
        tabIndex={0}
        style={checkboxStyle}
        onClick={toggleDone}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            toggleDone();
          }
        }}
      >
        {todo.is_done && "\u2713"}
      </div>

      {/* Title */}
      {editing ? (
        <input
          ref={inputRef}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={handleEditKeyDown}
          style={{
            flex: 1,
            fontSize: 13,
            background: "var(--bg-secondary)",
            border: "1px solid var(--accent-blue)",
            borderRadius: 4,
            padding: "2px 6px",
            color: "var(--text-primary)",
            outline: "none",
            minWidth: 0,
          }}
        />
      ) : (
        <span
          style={textStyle}
          onDoubleClick={() => {
            if (!todo.is_done) {
              setEditText(todo.title);
              setEditing(true);
            }
          }}
        >
          {todo.title}
        </span>
      )}

      {/* Priority badge */}
      <span style={{ ...badgeBase, background: prio.bg, color: prio.fg }}>
        {prio.label}
      </span>

      {/* Due date */}
      {todo.due_date && (
        <span style={{ ...badgeBase, background: dueDateBg, color: dueDateColor }}>
          {formatDueDate(todo.due_date)}
        </span>
      )}

      {/* Project badge */}
      {todo.project_name && (
        <span
          style={{
            ...badgeBase,
            background: "rgba(99,102,241,0.1)",
            color: "var(--accent-blue)",
            maxWidth: 80,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {todo.project_name}
        </span>
      )}

      {/* Delete button */}
      <button
        style={deleteBtnStyle}
        onClick={() => onDelete(todo.id)}
        aria-label="Gorevi sil"
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--accent-red)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--text-muted)";
        }}
      >
        &#x2715;
      </button>
    </div>
  );
}
