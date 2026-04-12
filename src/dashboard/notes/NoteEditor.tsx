import { useState, useRef, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

// ── Types ────────────────────────────────────────────────────
interface NoteEditorProps {
  noteId: number;
  initialContent: string;
  initialTitle: string;
  onSave?: () => void;
}

type SaveStatus = "saved" | "saving" | "idle";

// ── Toolbar button helper ────────────────────────────────────
function insertMarkdown(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string = ""
): string {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selected = text.substring(start, end);
  const newText =
    text.substring(0, start) + before + selected + after + text.substring(end);
  textarea.value = newText;
  textarea.selectionStart = start + before.length;
  textarea.selectionEnd = start + before.length + selected.length;
  textarea.focus();
  return newText;
}

// ── Toolbar actions ──────────────────────────────────────────
interface ToolbarAction {
  label: string;
  title: string;
  before: string;
  after: string;
}

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { label: "B", title: "Kalin", before: "**", after: "**" },
  { label: "I", title: "Italik", before: "_", after: "_" },
  { label: "<>", title: "Kod", before: "`", after: "`" },
  { label: "Link", title: "Baglanti", before: "[", after: "](url)" },
  { label: "Liste", title: "Liste", before: "- ", after: "" },
  { label: "[ ]", title: "Onay Kutusu", before: "- [ ] ", after: "" },
  { label: "H1", title: "Baslik 1", before: "# ", after: "" },
  { label: "H2", title: "Baslik 2", before: "## ", after: "" },
  { label: "H3", title: "Baslik 3", before: "### ", after: "" },
];

// ── Line numbers component ───────────────────────────────────
function LineNumbers({
  content,
  scrollTop,
}: {
  content: string;
  scrollTop: number;
}) {
  const lineCount = content.split("\n").length;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 44,
        paddingTop: 12,
        paddingRight: 8,
        transform: `translateY(-${scrollTop}px)`,
        textAlign: "right",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
        lineHeight: "20px",
        color: "var(--text-muted)",
        userSelect: "none",
        pointerEvents: "none",
      }}
    >
      {Array.from({ length: lineCount }, (_, i) => (
        <div key={i}>{i + 1}</div>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────
export default function NoteEditor({
  noteId,
  initialContent,
  initialTitle,
  onSave,
}: NoteEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [title, setTitle] = useState(initialTitle);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [scrollTop, setScrollTop] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when noteId changes
  useEffect(() => {
    setContent(initialContent);
    setTitle(initialTitle);
    setSaveStatus("idle");
  }, [noteId, initialContent, initialTitle]);

  // ── Save logic ─────────────────────────────────────────────
  const doSave = useCallback(
    async (t: string, c: string) => {
      setSaveStatus("saving");
      try {
        await invoke("update_note", { id: noteId, title: t, content: c });
        setSaveStatus("saved");
        onSave?.();
      } catch (err) {
        console.error("Not kaydedilemedi:", err);
        setSaveStatus("idle");
      }
    },
    [noteId, onSave]
  );

  const scheduleSave = useCallback(
    (t: string, c: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => doSave(t, c), 500);
    },
    [doSave]
  );

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // ── Handlers ───────────────────────────────────────────────
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setSaveStatus("idle");
    scheduleSave(title, newContent);
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setSaveStatus("idle");
    scheduleSave(newTitle, content);
  };

  const handleToolbarClick = (action: ToolbarAction) => {
    if (!textareaRef.current) return;
    const newText = insertMarkdown(
      textareaRef.current,
      action.before,
      action.after
    );
    handleContentChange(newText);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab -> 2 spaces
    if (e.key === "Tab") {
      e.preventDefault();
      if (!textareaRef.current) return;
      const newText = insertMarkdown(textareaRef.current, "  ");
      handleContentChange(newText);
    }
    // Ctrl+S -> force save
    if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      doSave(title, content);
    }
  };

  // ── Styles ─────────────────────────────────────────────────
  const toolbarBtnStyle: React.CSSProperties = {
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', monospace",
    color: "var(--text-secondary)",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    cursor: "pointer",
    transition: "all 0.15s ease",
    lineHeight: 1.4,
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 400,
      }}
    >
      {/* Header: title + save status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Baslik..."
          style={{
            flex: 1,
            padding: "8px 12px",
            fontSize: 16,
            fontWeight: 600,
            fontFamily: "inherit",
            color: "var(--text-primary)",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            outline: "none",
          }}
        />
        <span
          style={{
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
            color:
              saveStatus === "saved"
                ? "var(--accent-green)"
                : saveStatus === "saving"
                ? "var(--accent-yellow)"
                : "var(--text-muted)",
            minWidth: 70,
            textAlign: "right",
          }}
        >
          {saveStatus === "saved"
            ? "Kaydedildi"
            : saveStatus === "saving"
            ? "Kaydediliyor..."
            : ""}
        </span>
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "6px 0",
          marginBottom: 6,
          flexWrap: "wrap",
        }}
      >
        {TOOLBAR_ACTIONS.map((action) => (
          <button
            key={action.label}
            title={action.title}
            onClick={() => handleToolbarClick(action)}
            style={toolbarBtnStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-primary)";
              e.currentTarget.style.background = "var(--bg-hover)";
              e.currentTarget.style.borderColor = "var(--accent-blue)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-secondary)";
              e.currentTarget.style.background = "var(--bg-secondary)";
              e.currentTarget.style.borderColor = "var(--border)";
            }}
          >
            {action.label}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        <button
          title={showLineNumbers ? "Satir numaralarini gizle" : "Satir numaralarini goster"}
          onClick={() => setShowLineNumbers((v) => !v)}
          style={{
            ...toolbarBtnStyle,
            opacity: showLineNumbers ? 1 : 0.5,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--text-primary)";
            e.currentTarget.style.background = "var(--bg-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-secondary)";
            e.currentTarget.style.background = "var(--bg-secondary)";
          }}
        >
          #
        </button>
      </div>

      {/* Editor area with optional line numbers */}
      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          background: "var(--bg-primary)",
          overflow: "hidden",
        }}
      >
        {showLineNumbers && (
          <LineNumbers content={content} scrollTop={scrollTop} />
        )}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          spellCheck={false}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            minHeight: 400,
            padding: showLineNumbers ? "12px 16px 12px 52px" : "12px 16px",
            fontSize: 13,
            lineHeight: "20px",
            fontFamily: "'JetBrains Mono', monospace",
            color: "var(--text-primary)",
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "none",
            tabSize: 2,
          }}
        />
      </div>
    </div>
  );
}
