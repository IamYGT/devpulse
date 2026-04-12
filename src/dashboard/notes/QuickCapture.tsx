import { useState, useEffect, useRef, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Project } from "../../types";
// Toast removed for stability - using simple state instead
import TagPicker from "./TagPicker";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type CaptureType = "not" | "gorev" | "snippet" | "karalama";

interface CaptureTypeOption {
  id: CaptureType;
  label: string;
  icon: string;
}

const captureTypes: CaptureTypeOption[] = [
  { id: "not", label: "Not", icon: "\uD83D\uDCDD" },
  { id: "gorev", label: "Gorev", icon: "\u2611" },
  { id: "snippet", label: "Snippet", icon: "\uD83D\uDCCB" },
  { id: "karalama", label: "Karalama", icon: "\u270F" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CaptureType>("not");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  /* ── Keyboard shortcut: Ctrl+Shift+N ──────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "N") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* ── Fetch projects on open ───────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const p = await invoke<Project[]>("get_projects");
        setProjects(p);
      } catch {
        setProjects([]);
      }
    })();
    // Focus title when opened
    setTimeout(() => titleRef.current?.focus(), 100);
  }, [open]);

  /* ── Lock body scroll when open ───────────────────────────── */
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  /* ── Save ─────────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await invoke("create_note", {
        noteType: type,
        title: title.trim(),
        content: content.trim() || null,
        projectId,
        tagIds,
      });
      setSaveMsg("Not kaydedildi"); setTimeout(() => setSaveMsg(null), 2000);
      resetAndClose();
    } catch (err) {
      console.error("Not kaydedilemedi:", err);
      setSaveMsg("Hata: Not kaydedilemedi"); setTimeout(() => setSaveMsg(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const resetAndClose = () => {
    setTitle("");
    setContent("");
    setType("not");
    setProjectId(null);
    setTagIds([]);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      resetAndClose();
    }
  };

  /* ── Placeholder text per type ────────────────────────────── */
  const placeholders: Record<CaptureType, string> = {
    not: "Notunuzu yazin...",
    gorev: "Gorev aciklamasi...",
    snippet: "Kod veya metin snippet...",
    karalama: "Fikirlerinizi serbestce yazin...",
  };

  /* ── Styles ───────────────────────────────────────────────── */
  const fabStyle: CSSProperties = {
    position: "fixed",
    bottom: 72,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "var(--accent-blue)",
    color: "#fff",
    border: "none",
    fontSize: 22,
    fontWeight: 300,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 16px rgba(99,102,241,0.4)",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    zIndex: 8000,
    lineHeight: 1,
  };

  const backdropStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 9000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(4px)",
    animation: "qc-fade-in 0.2s ease",
  };

  const modalStyle: CSSProperties = {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    width: "90vw",
    maxWidth: 480,
    maxHeight: "85vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
    animation: "qc-scale-in 0.2s ease",
    overflow: "hidden",
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    borderBottom: "1px solid var(--border)",
  };

  const bodyStyle: CSSProperties = {
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    overflowY: "auto",
    flex: 1,
  };

  const typeSelectorStyle: CSSProperties = {
    display: "flex",
    gap: 6,
  };

  const typeBtn = (active: boolean): CSSProperties => ({
    flex: 1,
    padding: "6px 8px",
    fontSize: 11,
    fontWeight: active ? 600 : 500,
    background: active ? "var(--accent-blue)" : "var(--bg-secondary)",
    color: active ? "#fff" : "var(--text-secondary)",
    border: active ? "none" : "1px solid var(--border)",
    borderRadius: 6,
    cursor: "pointer",
    transition: "all 0.15s ease",
    fontFamily: "inherit",
    textAlign: "center",
  });

  const inputStyle: CSSProperties = {
    fontSize: 14,
    padding: "10px 12px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
    outline: "none",
    fontFamily: "inherit",
    transition: "border-color 0.2s ease",
  };

  const textareaStyle: CSSProperties = {
    ...inputStyle,
    resize: "vertical",
    minHeight: type === "snippet" ? 120 : 80,
    fontFamily: type === "snippet" ? "'JetBrains Mono', monospace" : "inherit",
    fontSize: type === "snippet" ? 12 : 13,
  };

  const selectStyle: CSSProperties = {
    fontSize: 12,
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
    fontFamily: "inherit",
    cursor: "pointer",
  };

  const footerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    borderTop: "1px solid var(--border)",
  };

  return (
    <>
      {saveMsg && (
        <div style={{ position: "fixed", bottom: 80, right: 20, padding: "8px 16px", background: "var(--accent-green)", color: "#fff", borderRadius: 8, fontSize: 13, zIndex: 10001 }}>
          {saveMsg}
        </div>
      )}
      <style>{`
        @keyframes qc-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes qc-scale-in {
          from { transform: scale(0.95); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* FAB button */}
      {!open && (
        <button
          style={fabStyle}
          onClick={() => setOpen(true)}
          aria-label="Hizli not ekle"
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.boxShadow = "0 6px 20px rgba(99,102,241,0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 4px 16px rgba(99,102,241,0.4)";
          }}
        >
          +
        </button>
      )}

      {/* Modal */}
      {open && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div style={backdropStyle} onClick={resetAndClose}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Hizli yakalama"
            style={modalStyle}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            {/* Header */}
            <div style={headerStyle}>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                Hizli Yakalama
              </span>
              <button
                onClick={resetAndClose}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  fontSize: 18,
                  cursor: "pointer",
                  padding: "2px 6px",
                  lineHeight: 1,
                }}
                aria-label="Kapat"
              >
                &#x2715;
              </button>
            </div>

            {/* Body */}
            <div style={bodyStyle}>
              {/* Type selector */}
              <div style={typeSelectorStyle}>
                {captureTypes.map((ct) => (
                  <button
                    key={ct.id}
                    style={typeBtn(type === ct.id)}
                    onClick={() => setType(ct.id)}
                  >
                    {ct.icon} {ct.label}
                  </button>
                ))}
              </div>

              {/* Title */}
              <input
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Baslik"
                style={inputStyle}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent-blue)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
              />

              {/* Content */}
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={placeholders[type]}
                style={textareaStyle}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent-blue)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
              />

              {/* Project selector */}
              <select
                value={projectId ?? ""}
                onChange={(e) =>
                  setProjectId(e.target.value ? Number(e.target.value) : null)
                }
                style={selectStyle}
              >
                <option value="">Proje sec (opsiyonel)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              {/* Tag picker */}
              <TagPicker
                noteId={0}
                selectedTagIds={tagIds}
                onChange={setTagIds}
              />
            </div>

            {/* Footer */}
            <div style={footerStyle}>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                }}
              >
                Ctrl+Enter ile kaydet
              </span>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={!title.trim() || saving}
                style={{
                  fontSize: 12,
                  padding: "8px 24px",
                  opacity: !title.trim() || saving ? 0.5 : 1,
                }}
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
