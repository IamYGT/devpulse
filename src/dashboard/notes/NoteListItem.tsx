import type { Note } from "../../hooks/useNotes";

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "simdi";
  if (diffMin < 60) return `${diffMin}dk once`;
  if (diffHour < 24) return `${diffHour}sa once`;
  if (diffDay === 1) return "dun";
  if (diffDay < 7) return `${diffDay}g once`;
  return new Date(dateStr).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

interface NoteListItemProps {
  note: Note;
  isActive: boolean;
  onClick: () => void;
}

export default function NoteListItem({ note, isActive, onClick }: NoteListItemProps) {
  const preview = note.content
    ? note.content.replace(/[#*`>\-\[\]]/g, "").slice(0, 60)
    : "";

  return (
    <div
      className={`note-list-item ${isActive ? "note-list-item--active" : ""}`}
      onClick={onClick}
      style={{
        padding: 10,
        cursor: "pointer",
        borderLeft: isActive ? "3px solid var(--accent-blue, #4fc3f7)" : "3px solid transparent",
        background: isActive ? "rgba(79, 195, 247, 0.08)" : "transparent",
        transition: "background 0.15s ease",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = "transparent";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        {note.is_pinned && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="none"
            style={{ color: "var(--accent-blue, #4fc3f7)", flexShrink: 0 }}
          >
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2z" />
          </svg>
        )}
        {note.color && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: note.color,
              flexShrink: 0,
            }}
          />
        )}
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-primary, #e0e0e0)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {note.title || "Baslıksız"}
        </span>
      </div>

      {preview && (
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted, #888)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginBottom: 4,
          }}
        >
          {preview}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 10, color: "var(--text-muted, #666)" }}>
          {formatRelativeTime(note.updated_at)}
        </span>
        {note.project_id && (
          <span
            style={{
              fontSize: 9,
              padding: "1px 5px",
              borderRadius: 3,
              background: "rgba(79, 195, 247, 0.12)",
              color: "var(--accent-blue, #4fc3f7)",
              fontWeight: 500,
            }}
          >
            Proje
          </span>
        )}
      </div>
    </div>
  );
}
