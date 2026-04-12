import { useState, useEffect, useRef, useCallback } from "react";
import { useNotes } from "../../hooks/useNotes";
import NoteListItem from "./NoteListItem";

const NOTE_TYPES = [
  { key: "all", label: "Tumu" },
  { key: "scratch", label: "Notlar" },
  { key: "todo", label: "Gorevler" },
  { key: "snippet", label: "Snippetler" },
  { key: "daily", label: "Gunluk" },
];

interface NotesSidebarProps {
  onSelect: (id: number) => void;
  activeNoteId: number | null;
}

export default function NotesSidebar({ onSelect, activeNoteId }: NotesSidebarProps) {
  const { notes, loading, fetchNotes } = useNotes();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeType, setActiveType] = useState("all");
  const [contextMenu, setContextMenu] = useState<{
    noteId: number;
    x: number;
    y: number;
  } | null>(null);
  const contextRef = useRef<HTMLDivElement>(null);

  // Fetch notes when filters change
  useEffect(() => {
    fetchNotes({
      noteType: activeType === "all" ? undefined : activeType,
      searchQuery: searchQuery || undefined,
    });
  }, [fetchNotes, activeType, searchQuery]);

  // Close context menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    }
    if (contextMenu) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [contextMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent, noteId: number) => {
    e.preventDefault();
    setContextMenu({ noteId, x: e.clientX, y: e.clientY });
  }, []);

  const handleContextAction = useCallback(async (action: string) => {
    if (!contextMenu) return;
    const { noteId } = contextMenu;
    const { invoke } = await import("@tauri-apps/api/core");

    try {
      switch (action) {
        case "pin":
          await invoke("update_note", { id: noteId, isPinned: true });
          break;
        case "archive":
          await invoke("update_note", { id: noteId, isArchived: true });
          break;
        case "delete":
          await invoke("delete_note", { id: noteId });
          break;
        case "color":
          // Color picker would open here; for now toggle a default
          await invoke("update_note", { id: noteId, color: "#4fc3f7" });
          break;
      }
      fetchNotes({
        noteType: activeType === "all" ? undefined : activeType,
        searchQuery: searchQuery || undefined,
      });
    } catch (e) {
      console.error("Context action failed:", e);
    }
    setContextMenu(null);
  }, [contextMenu, fetchNotes, activeType, searchQuery]);

  // Sort: pinned first, then by updated_at DESC
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return (
    <div
      style={{
        width: 260,
        minWidth: 260,
        height: "100%",
        background: "var(--bg-secondary, #1a1a2e)",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Search */}
      <div style={{ padding: "12px 12px 8px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,0.05)",
            borderRadius: 6,
            padding: "6px 10px",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted, #888)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Notlarda ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary, #e0e0e0)",
              fontSize: 12,
            }}
          />
        </div>
      </div>

      {/* Type Filters */}
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: "0 12px 8px",
          flexWrap: "wrap",
        }}
      >
        {NOTE_TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveType(t.key)}
            style={{
              padding: "3px 8px",
              borderRadius: 4,
              border: "none",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 500,
              background:
                activeType === t.key
                  ? "var(--accent-blue, #4fc3f7)"
                  : "rgba(255,255,255,0.06)",
              color:
                activeType === t.key
                  ? "#000"
                  : "var(--text-secondary, #aaa)",
              transition: "all 0.15s ease",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Note List */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {loading && notes.length === 0 && (
          <div
            style={{
              padding: 20,
              textAlign: "center",
              fontSize: 12,
              color: "var(--text-muted, #666)",
            }}
          >
            Yukleniyor...
          </div>
        )}
        {!loading && sortedNotes.length === 0 && (
          <div
            style={{
              padding: 20,
              textAlign: "center",
              fontSize: 12,
              color: "var(--text-muted, #666)",
            }}
          >
            Not bulunamadi
          </div>
        )}
        {sortedNotes.map((note) => (
          <div
            key={note.id}
            onContextMenu={(e) => handleContextMenu(e, note.id)}
          >
            <NoteListItem
              note={note}
              isActive={activeNoteId === note.id}
              onClick={() => onSelect(note.id)}
            />
          </div>
        ))}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextRef}
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            background: "var(--bg-tertiary, #252540)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6,
            padding: 4,
            zIndex: 9999,
            minWidth: 140,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          {[
            { action: "pin", label: "Sabitle", icon: "M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2z" },
            { action: "archive", label: "Arsivle", icon: "M21 8v13H3V8M1 3h22v5H1zM10 12h4" },
            { action: "delete", label: "Sil", icon: "M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" },
            { action: "color", label: "Renk Degistir", icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" },
          ].map((item) => (
            <button
              key={item.action}
              onClick={() => handleContextAction(item.action)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "6px 10px",
                border: "none",
                background: "transparent",
                color:
                  item.action === "delete"
                    ? "#ef5350"
                    : "var(--text-primary, #e0e0e0)",
                fontSize: 12,
                cursor: "pointer",
                borderRadius: 4,
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={item.icon} />
              </svg>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
