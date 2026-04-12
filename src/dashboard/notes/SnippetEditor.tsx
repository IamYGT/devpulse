import { useState, useRef, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

// ── Types ────────────────────────────────────────────────────
interface SnippetEditorProps {
  noteId: number;
  initialContent: string;
  initialLanguage: string;
}

type SaveStatus = "saved" | "saving" | "idle";

const LANGUAGES = [
  "typescript",
  "rust",
  "python",
  "javascript",
  "css",
  "html",
  "json",
  "bash",
  "sql",
  "go",
  "other",
] as const;

type Language = (typeof LANGUAGES)[number];

// ── Main component ───────────────────────────────────────────
export default function SnippetEditor({
  noteId,
  initialContent,
  initialLanguage,
}: SnippetEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [language, setLanguage] = useState<Language>(
    (LANGUAGES.includes(initialLanguage as Language)
      ? initialLanguage
      : "other") as Language
  );
  const [filename, setFilename] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [copied, setCopied] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when noteId changes
  useEffect(() => {
    setContent(initialContent);
    setLanguage(
      (LANGUAGES.includes(initialLanguage as Language)
        ? initialLanguage
        : "other") as Language
    );
    setSaveStatus("idle");
    setCopied(false);
  }, [noteId, initialContent, initialLanguage]);

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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("Panoya kopyalanamadi");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab -> 2 spaces
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

  // Line count for line numbers
  const lineCount = content.split("\n").length;

  // ── Shared button style ────────────────────────────────────
  const actionBtnStyle: React.CSSProperties = {
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 500,
    fontFamily: "'JetBrains Mono', monospace",
    color: "var(--text-secondary)",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    cursor: "pointer",
    transition: "all 0.15s ease",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 400,
        gap: 8,
      }}
    >
      {/* Top bar: language selector, filename, copy, save status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {/* Language selector */}
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          style={{
            padding: "6px 10px",
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 500,
            color: "var(--text-primary)",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            outline: "none",
            cursor: "pointer",
            appearance: "none",
            paddingRight: 28,
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238888aa' fill='none' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 10px center",
          }}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>

        {/* Filename input */}
        <input
          type="text"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          placeholder="dosya_adi (istege bagli)"
          style={{
            padding: "6px 10px",
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            color: "var(--text-primary)",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 6,
            outline: "none",
            width: 180,
          }}
        />

        <div style={{ flex: 1 }} />

        {/* Save status */}
        <span
          style={{
            fontSize: 10,
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

        {/* Copy button */}
        <button
          onClick={handleCopy}
          style={{
            ...actionBtnStyle,
            color: copied ? "var(--accent-green)" : "var(--text-secondary)",
            borderColor: copied ? "var(--accent-green)" : "var(--border)",
          }}
          onMouseEnter={(e) => {
            if (!copied) {
              e.currentTarget.style.color = "var(--text-primary)";
              e.currentTarget.style.background = "var(--bg-hover)";
              e.currentTarget.style.borderColor = "var(--accent-blue)";
            }
          }}
          onMouseLeave={(e) => {
            if (!copied) {
              e.currentTarget.style.color = "var(--text-secondary)";
              e.currentTarget.style.background = "var(--bg-secondary)";
              e.currentTarget.style.borderColor = "var(--border)";
            }
          }}
        >
          {copied ? "Kopyalandi!" : "Kopyala"}
        </button>
      </div>

      {/* Editor area with line numbers */}
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
        {/* Line numbers */}
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

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          placeholder="Kod yazin..."
          spellCheck={false}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            minHeight: 400,
            padding: "12px 16px 12px 52px",
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
