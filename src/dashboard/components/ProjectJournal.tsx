import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface JournalNote {
  id: number;
  project_id: number;
  text: string;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const day = d.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
    });
    const time = d.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${day} ${time}`;
  } catch {
    return iso;
  }
}

function timeAgo(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / (1000 * 60));
    const diffHour = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMin < 60) return `${diffMin} dk once`;
    if (diffHour < 24) return `${diffHour} saat once`;
    return `${diffDay} gun once`;
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface ProjectJournalProps {
  projectId: number;
  projectName: string;
}

export default function ProjectJournal({
  projectId,
  projectName,
}: ProjectJournalProps) {
  const [notes, setNotes] = useState<JournalNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchNotes = async () => {
    try {
      const result = await invoke<JournalNote[]>("get_project_notes", {
        projectId,
        limit: 5,
      });
      setNotes(result);
    } catch {
      // Command may not exist yet - graceful fallback
      setNotes([]);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [projectId]);

  const handleSave = async () => {
    if (!newNote.trim() || saving) return;
    setSaving(true);
    try {
      await invoke("save_project_note", {
        projectId,
        text: newNote.trim(),
      });
      setNewNote("");
      await fetchNotes();
    } catch (err) {
      console.error("Not kaydedilemedi:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 20,
        marginBottom: 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div className="card-title" style={{ margin: 0 }}>
          <span style={{ marginRight: 8 }}>&#128221;</span>
          {projectName} - Notlar
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: 12,
            transition: "color 0.2s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
          }}
        >
          {expanded ? "Kucult" : "Genislet"}
        </button>
      </div>

      {/* New note input */}
      <div style={{ marginBottom: 12 }}>
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nerede kalmistim? Not ekle... (Ctrl+Enter ile kaydet)"
          rows={expanded ? 4 : 2}
          style={{
            width: "100%",
            resize: "vertical",
            marginBottom: 8,
            minHeight: expanded ? 80 : 48,
          }}
        />
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={!newNote.trim() || saving}
          style={{
            fontSize: 12,
            padding: "6px 16px",
            opacity: !newNote.trim() || saving ? 0.5 : 1,
          }}
        >
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>

      {/* Notes list */}
      {notes.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notes.map((note) => (
            <div
              key={note.id}
              style={{
                background: "var(--bg-secondary)",
                borderRadius: "var(--radius)",
                padding: "10px 14px",
                borderLeft: "3px solid var(--accent-blue)",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-primary)",
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {note.text}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  marginTop: 6,
                  display: "flex",
                  gap: 12,
                }}
              >
                <span>{formatDateTime(note.created_at)}</span>
                <span>{timeAgo(note.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            textAlign: "center",
            padding: "12px 0",
          }}
        >
          Henuz not yok. Projeye dair notlarini buraya yaz.
        </div>
      )}
    </div>
  );
}
