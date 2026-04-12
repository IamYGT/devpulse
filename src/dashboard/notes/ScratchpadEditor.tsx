import { useState, useRef, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

// ── Types ────────────────────────────────────────────────────
interface ScratchpadEditorProps {
  noteId: number;
  initialContent: string;
}

type SaveStatus = "saved" | "saving" | "idle";

// ── Main component ───────────────────────────────────────────
export default function ScratchpadEditor({
  noteId,
  initialContent,
}: ScratchpadEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when noteId changes
  useEffect(() => {
    setContent(initialContent);
    setSaveStatus("idle");
  }, [noteId, initialContent]);

  // ── Save logic ─────────────────────────────────────────────
  const doSave = useCallback(
    async (c: string) => {
      setSaveStatus("saving");
      try {
        await invoke("update_note", { id: noteId, content: c });
        setSaveStatus("saved");
      } catch (err) {
        console.error("Kaydedilemedi:", err);
        setSaveStatus("idle");
      }
    },
    [noteId]
  );

  const scheduleSave = useCallback(
    (c: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => doSave(c), 500);
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
  const handleChange = (newContent: string) => {
    setContent(newContent);
    setSaveStatus("idle");
    scheduleSave(newContent);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab -> 2 spaces indent
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const text = ta.value;
      const newText = text.substring(0, start) + "  " + text.substring(end);
      ta.value = newText;
      ta.selectionStart = ta.selectionEnd = start + 2;
      ta.focus();
      handleChange(newText);
    }
    // Ctrl+S -> force save
    if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      doSave(content);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        height: "100%",
        position: "relative",
      }}
    >
      {/* Save indicator - subtle top-right */}
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 12,
          fontSize: 10,
          fontFamily: "'JetBrains Mono', monospace",
          color:
            saveStatus === "saved"
              ? "var(--accent-green)"
              : saveStatus === "saving"
              ? "var(--accent-yellow)"
              : "transparent",
          zIndex: 1,
          pointerEvents: "none",
          transition: "color 0.2s ease",
        }}
      >
        {saveStatus === "saved"
          ? "Kaydedildi"
          : saveStatus === "saving"
          ? "Kaydediliyor..."
          : ""}
      </div>

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Hizli not yaz..."
        spellCheck={false}
        style={{
          display: "block",
          width: "100%",
          flex: 1,
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
    </div>
  );
}
