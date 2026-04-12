import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNotes, type Note } from "../../hooks/useNotes";
import ErrorBoundary from "../../components/ErrorBoundary";
import NoteEditor from "../notes/NoteEditor";
import NotePreview from "../notes/NotePreview";
import NoteListItem from "../notes/NoteListItem";
import TodoItem, { type Todo } from "../notes/TodoItem";

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface OpenTab {
  id: number;
  title: string;
}

interface SidebarFilter {
  noteType: string | null;
  projectId: number | null;
  searchQuery: string;
  tagId: number | null;
}

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

const NOTE_TYPES = [
  { value: null, label: "Tumunu Goster" },
  { value: "scratch", label: "Karalama" },
  { value: "structured", label: "Yapilandirilmis" },
  { value: "snippet", label: "Kod Parcasi" },
  { value: "journal", label: "Gunluk" },
] as const;

const NOTE_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280",
];

const SETTINGS_KEY = "open_note_tabs";

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

/* ================================================================== */
/*  ScratchpadEditor – minimal, no toolbar                             */
/* ================================================================== */

function ScratchpadEditor({
  noteId,
  initialContent,
  initialTitle,
  onSave,
}: {
  noteId: number;
  initialContent: string;
  initialTitle: string;
  onSave?: () => void;
}) {
  const [content, setContent] = useState(initialContent);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setContent(initialContent);
  }, [noteId, initialContent]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const handleChange = (val: string) => {
    setContent(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await invoke("update_note", { id: noteId, title: initialTitle, content: val });
        onSave?.();
      } catch (err) {
        console.error("Karalama kaydedilemedi:", err);
      }
    }, 500);
  };

  return (
    <textarea
      value={content}
      onChange={(e) => handleChange(e.target.value)}
      spellCheck={false}
      placeholder="Yazmaya basla..."
      style={{
        flex: 1,
        width: "100%",
        minHeight: 400,
        padding: "16px 20px",
        fontSize: 14,
        lineHeight: "22px",
        fontFamily: "'JetBrains Mono', monospace",
        color: "var(--text-primary)",
        background: "var(--bg-primary)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        outline: "none",
        resize: "none",
        tabSize: 2,
      }}
    />
  );
}

/* ================================================================== */
/*  SnippetEditor – with language badge                                */
/* ================================================================== */

function SnippetEditor({
  noteId,
  initialContent,
  initialTitle,
  language,
  onSave,
}: {
  noteId: number;
  initialContent: string;
  initialTitle: string;
  language: string | null;
  onSave?: () => void;
}) {
  const [content, setContent] = useState(initialContent);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setContent(initialContent);
  }, [noteId, initialContent]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const handleChange = (val: string) => {
    setContent(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await invoke("update_note", { id: noteId, title: initialTitle, content: val });
        onSave?.();
      } catch (err) {
        console.error("Snippet kaydedilemedi:", err);
      }
    }, 500);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
      {language && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 4,
              background: "rgba(139,92,246,0.15)",
              color: "var(--accent-purple, #a78bfa)",
              fontFamily: "'JetBrains Mono', monospace",
              textTransform: "uppercase",
            }}
          >
            {language}
          </span>
        </div>
      )}
      <textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        spellCheck={false}
        placeholder="// Kod parcasi..."
        style={{
          flex: 1,
          width: "100%",
          minHeight: 400,
          padding: "14px 16px",
          fontSize: 13,
          lineHeight: "20px",
          fontFamily: "'JetBrains Mono', monospace",
          color: "var(--text-primary)",
          background: "var(--bg-card, var(--bg-primary))",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          outline: "none",
          resize: "none",
          tabSize: 2,
        }}
      />
    </div>
  );
}

/* ================================================================== */
/*  JournalView – read-only timeline                                   */
/* ================================================================== */

function JournalView({ note }: { note: Note }) {
  return (
    <div
      style={{
        flex: 1,
        padding: "20px 24px",
        overflowY: "auto",
        background: "var(--bg-primary)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
      }}
    >
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
        Olusturulma: {formatDate(note.created_at)} &middot; Son guncelleme: {formatDate(note.updated_at)}
      </div>
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.8,
          color: "var(--text-primary)",
          whiteSpace: "pre-wrap",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {note.content || (
          <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
            Gunluk kaydi bos.
          </span>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  TodoList – inline todos for a note                                 */
/* ================================================================== */

function TodoList({ noteId }: { noteId: number }) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTitle, setNewTitle] = useState("");

  const fetchTodos = useCallback(async () => {
    try {
      const result = await invoke<Todo[]>("get_todos", { noteId });
      setTodos(result);
    } catch {
      // not all notes have todos
    }
  }, [noteId]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const addTodo = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    try {
      await invoke("create_todo", { title: trimmed, noteId });
      setNewTitle("");
      fetchTodos();
    } catch (err) {
      console.error("Todo eklenemedi:", err);
    }
  };

  const deleteTodo = async (id: number) => {
    try {
      await invoke("delete_todo", { id });
      fetchTodos();
    } catch (err) {
      console.error("Todo silinemedi:", err);
    }
  };

  if (todos.length === 0 && !newTitle) return null;

  return (
    <div
      style={{
        marginTop: 12,
        padding: "10px 12px",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
        Gorevler
      </div>
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} onUpdate={fetchTodos} onDelete={deleteTodo} />
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addTodo(); }}
          placeholder="Yeni gorev ekle..."
          style={{
            flex: 1,
            padding: "4px 8px",
            fontSize: 12,
            background: "var(--bg-primary)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            color: "var(--text-primary)",
            outline: "none",
          }}
        />
        <button
          onClick={addTodo}
          style={{
            padding: "4px 10px",
            fontSize: 12,
            fontWeight: 600,
            background: "var(--accent-blue)",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Ekle
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Main – NotesPage                                                   */
/* ================================================================== */

export default function NotesPage() {
  const { notes, loading, fetchNotes, createNote, updateNote, deleteNote } = useNotes();

  // Tab & active state
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);

  // Preview
  const [showPreview, setShowPreview] = useState(false);

  // Sidebar filter
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>({
    noteType: null,
    projectId: null,
    searchQuery: "",
    tagId: null,
  });

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Color picker
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Search debounce
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Restore tabs from settings on mount ──────────────────────── */
  useEffect(() => {
    (async () => {
      await fetchNotes();
      try {
        const saved = await invoke<string | null>("get_setting", { key: SETTINGS_KEY });
        if (saved) {
          const parsed: OpenTab[] = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setOpenTabs(parsed);
            setActiveTabId(parsed[parsed.length - 1].id);
          }
        }
      } catch {
        // no saved tabs
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Fetch active note data when activeTabId changes ──────────── */
  useEffect(() => {
    if (activeTabId == null) {
      setActiveNote(null);
      return;
    }
    const found = notes.find((n) => n.id === activeTabId);
    if (found) {
      setActiveNote(found);
    }
  }, [activeTabId, notes]);

  /* ── Persist open tabs ────────────────────────────────────────── */
  useEffect(() => {
    invoke("save_setting", { key: SETTINGS_KEY, value: JSON.stringify(openTabs) }).catch(() => {});
  }, [openTabs]);

  /* ── Refetch when filter changes ──────────────────────────────── */
  useEffect(() => {
    const filters: Record<string, unknown> = {};
    if (sidebarFilter.noteType) filters.noteType = sidebarFilter.noteType;
    if (sidebarFilter.projectId) filters.projectId = sidebarFilter.projectId;
    if (sidebarFilter.tagId) filters.tagId = sidebarFilter.tagId;
    if (sidebarFilter.searchQuery) filters.searchQuery = sidebarFilter.searchQuery;
    fetchNotes(filters as Parameters<typeof fetchNotes>[0]);
  }, [sidebarFilter, fetchNotes]);

  /* ── Search handler with debounce ─────────────────────────────── */
  const handleSearchChange = (query: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSidebarFilter((prev) => ({ ...prev, searchQuery: query }));
    }, 300);
  };

  /* ── Open / activate a note tab ───────────────────────────────── */
  const openNoteTab = useCallback(
    (note: Note) => {
      setOpenTabs((prev) => {
        const exists = prev.find((t) => t.id === note.id);
        if (exists) return prev;
        return [...prev, { id: note.id, title: note.title || "Baslıksız" }];
      });
      setActiveTabId(note.id);
    },
    []
  );

  /* ── Close a tab ──────────────────────────────────────────────── */
  const closeTab = useCallback(
    (tabId: number, e?: React.MouseEvent) => {
      e?.stopPropagation();
      setOpenTabs((prev) => {
        const next = prev.filter((t) => t.id !== tabId);
        if (activeTabId === tabId) {
          const newActive = next.length > 0 ? next[next.length - 1].id : null;
          setActiveTabId(newActive);
        }
        return next;
      });
    },
    [activeTabId]
  );

  /* ── Create new note ──────────────────────────────────────────── */
  const handleCreateNote = async (noteType: string = "scratch") => {
    const typeLabels: Record<string, string> = {
      scratch: "Yeni Karalama",
      structured: "Yeni Not",
      snippet: "Yeni Snippet",
      journal: "Gunluk Kaydi",
    };
    const note = await createNote({
      title: typeLabels[noteType] || "Yeni Not",
      noteType,
    });
    if (note) {
      await fetchNotes();
      openNoteTab(note);
    }
  };

  /* ── Delete a note ────────────────────────────────────────────── */
  const handleDeleteNote = async (id: number) => {
    await deleteNote(id);
    closeTab(id);
    setDeleteConfirmId(null);
    fetchNotes();
  };

  /* ── Toggle pin ───────────────────────────────────────────────── */
  const togglePin = async () => {
    if (!activeNote) return;
    await updateNote(activeNote.id, { is_pinned: !activeNote.is_pinned } as Partial<Note>);
    fetchNotes();
  };

  /* ── Set color ────────────────────────────────────────────────── */
  const setNoteColor = async (color: string | null) => {
    if (!activeNote) return;
    await updateNote(activeNote.id, { color } as Partial<Note>);
    setShowColorPicker(false);
    fetchNotes();
  };

  /* ── Update tab title when note title changes ─────────────────── */
  const handleNoteSaved = () => {
    fetchNotes();
    // Sync tab titles
    if (activeNote) {
      setOpenTabs((prev) =>
        prev.map((t) =>
          t.id === activeNote.id ? { ...t, title: activeNote.title || "Baslıksız" } : t
        )
      );
    }
  };

  /* ── Sorted notes: pinned first ───────────────────────────────── */
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  /* ── Render the type-based editor ─────────────────────────────── */
  const renderEditor = () => {
    if (!activeNote) return null;

    switch (activeNote.note_type) {
      case "scratch":
        return (
          <ScratchpadEditor
            key={activeNote.id}
            noteId={activeNote.id}
            initialContent={activeNote.content}
            initialTitle={activeNote.title}
            onSave={handleNoteSaved}
          />
        );
      case "snippet":
        return (
          <SnippetEditor
            key={activeNote.id}
            noteId={activeNote.id}
            initialContent={activeNote.content}
            initialTitle={activeNote.title}
            language={activeNote.language}
            onSave={handleNoteSaved}
          />
        );
      case "journal":
        return <JournalView key={activeNote.id} note={activeNote} />;
      case "structured":
      default:
        return (
          <NoteEditor
            key={activeNote.id}
            noteId={activeNote.id}
            initialContent={activeNote.content}
            initialTitle={activeNote.title}
            onSave={handleNoteSaved}
          />
        );
    }
  };

  /* ================================================================ */
  /*  STYLES                                                           */
  /* ================================================================ */

  const pageStyle: CSSProperties = {
    display: "flex",
    height: "100%",
    minHeight: 0,
    overflow: "hidden",
    background: "var(--bg-primary)",
  };

  const sidebarStyle: CSSProperties = {
    width: 260,
    minWidth: 260,
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid var(--border)",
    background: "var(--bg-secondary)",
    overflow: "hidden",
  };

  const mainAreaStyle: CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    overflow: "hidden",
  };

  const tabBarStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 0,
    minHeight: 36,
    background: "var(--bg-card, var(--bg-secondary))",
    borderBottom: "1px solid var(--border)",
    overflowX: "auto",
    overflowY: "hidden",
    flexShrink: 0,
  };

  const headerBarStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 16px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-secondary)",
    flexWrap: "wrap",
    flexShrink: 0,
  };

  const editorAreaStyle: CSSProperties = {
    flex: 1,
    display: "flex",
    padding: 16,
    gap: 12,
    minHeight: 0,
    overflow: "hidden",
  };

  const iconBtnStyle: CSSProperties = {
    background: "none",
    border: "1px solid var(--border)",
    color: "var(--text-secondary)",
    cursor: "pointer",
    borderRadius: 6,
    padding: "4px 8px",
    fontSize: 12,
    fontWeight: 600,
    transition: "all 0.15s ease",
    whiteSpace: "nowrap",
  };

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <div style={pageStyle}>
      {/* ─── SIDEBAR ─────────────────────────────────────────────── */}
      <div style={sidebarStyle}>
        {/* Search */}
        <div style={{ padding: "12px 12px 8px" }}>
          <input
            type="text"
            placeholder="Notlarda ara..."
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 10px",
              fontSize: 12,
              background: "var(--bg-primary)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
        </div>

        {/* Type filter */}
        <div style={{ padding: "0 12px 8px", display: "flex", flexWrap: "wrap", gap: 4 }}>
          {NOTE_TYPES.map((nt) => (
            <button
              key={nt.value ?? "all"}
              onClick={() =>
                setSidebarFilter((prev) => ({ ...prev, noteType: nt.value }))
              }
              style={{
                padding: "3px 8px",
                fontSize: 10,
                fontWeight: 600,
                borderRadius: 4,
                border: "1px solid var(--border)",
                background:
                  sidebarFilter.noteType === nt.value
                    ? "var(--accent-blue)"
                    : "var(--bg-primary)",
                color:
                  sidebarFilter.noteType === nt.value
                    ? "#fff"
                    : "var(--text-secondary)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {nt.label}
            </button>
          ))}
        </div>

        {/* New note buttons */}
        <div style={{ padding: "0 12px 8px", display: "flex", gap: 4 }}>
          <button
            onClick={() => handleCreateNote("scratch")}
            title="Yeni karalama"
            style={{
              flex: 1,
              padding: "5px 0",
              fontSize: 11,
              fontWeight: 600,
              background: "var(--accent-blue)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              transition: "opacity 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            + Yeni Not
          </button>
          <button
            onClick={() => handleCreateNote("snippet")}
            title="Yeni kod parcasi"
            style={{
              padding: "5px 8px",
              fontSize: 11,
              fontWeight: 600,
              background: "rgba(139,92,246,0.15)",
              color: "var(--accent-purple, #a78bfa)",
              border: "1px solid rgba(139,92,246,0.3)",
              borderRadius: 6,
              cursor: "pointer",
              transition: "opacity 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            {"</>"}
          </button>
        </div>

        {/* Note list */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {loading && notes.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
              Yukleniyor...
            </div>
          ) : sortedNotes.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
              {sidebarFilter.searchQuery
                ? "Sonuc bulunamadi."
                : "Henuz not yok."}
            </div>
          ) : (
            sortedNotes.map((note) => (
              <NoteListItem
                key={note.id}
                note={note}
                isActive={activeTabId === note.id}
                onClick={() => openNoteTab(note)}
              />
            ))
          )}
        </div>
      </div>

      {/* ─── MAIN AREA ───────────────────────────────────────────── */}
      <div style={mainAreaStyle}>
        {/* Tab bar */}
        <div style={tabBarStyle}>
          {openTabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "0 14px",
                  height: 36,
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                  background: isActive ? "var(--bg-primary)" : "transparent",
                  borderBottom: isActive ? "2px solid var(--accent-blue)" : "2px solid transparent",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                  maxWidth: 180,
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = "var(--bg-hover)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                >
                  {tab.title || "Baslıksız"}
                </span>
                <span
                  onClick={(e) => closeTab(tab.id, e)}
                  style={{
                    fontSize: 14,
                    lineHeight: 1,
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    flexShrink: 0,
                    padding: "0 2px",
                    borderRadius: 3,
                    transition: "color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--accent-red)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-muted)";
                  }}
                >
                  &#x2715;
                </span>
              </div>
            );
          })}
          {/* New tab button */}
          <button
            onClick={() => handleCreateNote("scratch")}
            title="Yeni sekme"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 16,
              padding: "0 10px",
              height: 36,
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--accent-blue)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            +
          </button>
        </div>

        {/* ── Content area ──────────────────────────────────────── */}
        {activeNote ? (
          <>
            {/* Header bar */}
            <div style={headerBarStyle}>
              {/* Inline editable title */}
              <input
                type="text"
                value={activeNote.title}
                onChange={(e) => {
                  const newTitle = e.target.value;
                  setActiveNote((prev) => (prev ? { ...prev, title: newTitle } : prev));
                  updateNote(activeNote.id, { title: newTitle } as Partial<Note>);
                  setOpenTabs((prev) =>
                    prev.map((t) =>
                      t.id === activeNote.id ? { ...t, title: newTitle || "Baslıksız" } : t
                    )
                  );
                }}
                style={{
                  flex: 1,
                  minWidth: 120,
                  padding: "4px 8px",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  background: "transparent",
                  border: "1px solid transparent",
                  borderRadius: 4,
                  outline: "none",
                  transition: "border-color 0.15s ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent-blue)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "transparent";
                }}
              />

              {/* Tag chips */}
              {activeNote.tags.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {activeNote.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "rgba(99,102,241,0.12)",
                        color: "var(--accent-blue)",
                        fontWeight: 500,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Color picker */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setShowColorPicker((v) => !v)}
                  style={iconBtnStyle}
                  title="Renk sec"
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: activeNote.color || "var(--text-muted)",
                      marginRight: 4,
                      verticalAlign: "middle",
                    }}
                  />
                  Renk
                </button>
                {showColorPicker && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      right: 0,
                      marginTop: 4,
                      padding: 8,
                      background: "var(--bg-card, var(--bg-secondary))",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      display: "flex",
                      gap: 6,
                      zIndex: 100,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                    }}
                  >
                    {NOTE_COLORS.map((c) => (
                      <span
                        key={c}
                        onClick={() => setNoteColor(c)}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: c,
                          cursor: "pointer",
                          border:
                            activeNote.color === c
                              ? "2px solid #fff"
                              : "2px solid transparent",
                          transition: "border-color 0.15s ease",
                        }}
                      />
                    ))}
                    <span
                      onClick={() => setNoteColor(null)}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "var(--bg-primary)",
                        border: "2px dashed var(--text-muted)",
                        cursor: "pointer",
                        fontSize: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--text-muted)",
                      }}
                      title="Rengi kaldir"
                    >
                      &#x2715;
                    </span>
                  </div>
                )}
              </div>

              {/* Pin button */}
              <button
                onClick={togglePin}
                style={{
                  ...iconBtnStyle,
                  color: activeNote.is_pinned
                    ? "var(--accent-blue)"
                    : "var(--text-secondary)",
                  borderColor: activeNote.is_pinned
                    ? "var(--accent-blue)"
                    : "var(--border)",
                }}
                title={activeNote.is_pinned ? "Sabitlemeyi kaldir" : "Sabitle"}
              >
                {activeNote.is_pinned ? "Sabitlendi" : "Sabitle"}
              </button>

              {/* Preview toggle (only structured) */}
              {activeNote.note_type === "structured" && (
                <button
                  onClick={() => setShowPreview((v) => !v)}
                  style={{
                    ...iconBtnStyle,
                    color: showPreview
                      ? "var(--accent-blue)"
                      : "var(--text-secondary)",
                    borderColor: showPreview
                      ? "var(--accent-blue)"
                      : "var(--border)",
                  }}
                  title={showPreview ? "Onizlemeyi kapat" : "Onizleme"}
                >
                  Onizleme
                </button>
              )}

              {/* Delete button */}
              {deleteConfirmId === activeNote.id ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={() => handleDeleteNote(activeNote.id)}
                    style={{
                      ...iconBtnStyle,
                      background: "rgba(239,68,68,0.15)",
                      color: "var(--accent-red)",
                      borderColor: "rgba(239,68,68,0.3)",
                    }}
                  >
                    Onayla
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    style={iconBtnStyle}
                  >
                    Iptal
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirmId(activeNote.id)}
                  style={{
                    ...iconBtnStyle,
                    color: "var(--text-muted)",
                  }}
                  title="Notu sil"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--accent-red)";
                    e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-muted)";
                    e.currentTarget.style.borderColor = "var(--border)";
                  }}
                >
                  Sil
                </button>
              )}
            </div>

            {/* Editor + optional preview */}
            <div style={editorAreaStyle}>
              <ErrorBoundary>
                <div
                  style={{
                    flex: showPreview && activeNote.note_type === "structured" ? "0 0 50%" : 1,
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                    overflow: "auto",
                  }}
                >
                  {renderEditor()}
                  <TodoList noteId={activeNote.id} />
                </div>

                {showPreview && activeNote.note_type === "structured" && (
                  <div
                    style={{
                      flex: "0 0 50%",
                      minWidth: 0,
                      overflow: "auto",
                    }}
                  >
                    <NotePreview content={activeNote.content} />
                  </div>
                )}
              </ErrorBoundary>
            </div>
          </>
        ) : (
          /* ── Empty states ─────────────────────────────────────── */
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              color: "var(--text-muted)",
            }}
          >
            {notes.length === 0 && !loading ? (
              <>
                <div style={{ fontSize: 40, opacity: 0.3 }}>&#128221;</div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>
                  Henuz not yok. Yeni bir not olustur!
                </div>
                <button
                  onClick={() => handleCreateNote("scratch")}
                  style={{
                    padding: "8px 20px",
                    fontSize: 13,
                    fontWeight: 600,
                    background: "var(--accent-blue)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "opacity 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "0.85";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "1";
                  }}
                >
                  + Yeni Not Olustur
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 36, opacity: 0.3 }}>&#128196;</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  Bir not sec veya yeni olustur
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
