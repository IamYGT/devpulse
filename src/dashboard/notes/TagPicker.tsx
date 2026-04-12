import { useState, useEffect, useRef, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Tag {
  id: number;
  name: string;
  color: string;
}

interface TagPickerProps {
  noteId: number;
  selectedTagIds: number[];
  onChange: (ids: number[]) => void;
}

/* ------------------------------------------------------------------ */
/*  Tag color palette                                                  */
/* ------------------------------------------------------------------ */

const tagColors = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6",
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function TagPicker({
  noteId: _noteId,
  selectedTagIds,
  onChange,
}: TagPickerProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Fetch tags ───────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const tags = await invoke<Tag[]>("get_tags");
        setAllTags(tags);
      } catch {
        setAllTags([]);
      }
    })();
  }, []);

  /* ── Close dropdown on outside click ──────────────────────── */
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  /* ── Toggle tag ───────────────────────────────────────────── */
  const toggleTag = (tagId: number) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  /* ── Create new tag ───────────────────────────────────────── */
  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const color = tagColors[allTags.length % tagColors.length];
      const newTag = await invoke<Tag>("create_tag", { name, color });
      setAllTags((prev) => [...prev, newTag]);
      onChange([...selectedTagIds, newTag.id]);
      setNewTagName("");
    } catch (err) {
      console.error("Etiket olusturulamadi:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateTag();
    }
  };

  /* ── Derived ──────────────────────────────────────────────── */
  const selectedTags = allTags.filter((t) => selectedTagIds.includes(t.id));

  /* ── Styles ───────────────────────────────────────────────── */
  const wrapperStyle: CSSProperties = {
    position: "relative",
  };

  const chipsRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    minHeight: 32,
    padding: "4px 0",
  };

  const chipStyle = (color: string): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 10px",
    fontSize: 11,
    fontWeight: 500,
    borderRadius: 999,
    background: `${color}20`,
    color,
    cursor: "pointer",
    transition: "opacity 0.15s ease",
    whiteSpace: "nowrap",
  });

  const addBtnStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 10px",
    fontSize: 11,
    fontWeight: 500,
    borderRadius: 999,
    background: "var(--bg-secondary)",
    color: "var(--text-muted)",
    border: "1px dashed var(--border)",
    cursor: "pointer",
    transition: "all 0.15s ease",
  };

  const dropdownStyle: CSSProperties = {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    zIndex: 100,
    marginTop: 4,
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
    padding: 8,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    maxHeight: 200,
    overflowY: "auto",
  };

  const tagRowStyle = (selected: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    fontSize: 12,
    borderRadius: 6,
    cursor: "pointer",
    background: selected ? "var(--bg-hover)" : "transparent",
    color: "var(--text-primary)",
    transition: "background 0.15s ease",
    fontWeight: selected ? 600 : 400,
  });

  const dotStyle = (color: string): CSSProperties => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: color,
    flexShrink: 0,
  });

  const createRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    borderTop: allTags.length > 0 ? "1px solid var(--border)" : "none",
    paddingTop: allTags.length > 0 ? 6 : 0,
    marginTop: allTags.length > 0 ? 2 : 0,
  };

  const createInputStyle: CSSProperties = {
    flex: 1,
    fontSize: 12,
    padding: "5px 8px",
    borderRadius: 4,
    border: "1px solid var(--border)",
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
    outline: "none",
    fontFamily: "inherit",
  };

  return (
    <div ref={containerRef} style={wrapperStyle}>
      {/* Selected chips + add button */}
      <div style={chipsRowStyle}>
        {selectedTags.map((tag) => (
          <span
            key={tag.id}
            style={chipStyle(tag.color)}
            onClick={() => toggleTag(tag.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") toggleTag(tag.id);
            }}
          >
            <span style={dotStyle(tag.color)} />
            {tag.name}
            <span style={{ marginLeft: 2, opacity: 0.6 }}>&#x2715;</span>
          </span>
        ))}
        <button
          style={addBtnStyle}
          onClick={() => {
            setDropdownOpen(!dropdownOpen);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent-blue)";
            e.currentTarget.style.color = "var(--accent-blue)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--text-muted)";
          }}
        >
          + Etiket
        </button>
      </div>

      {/* Dropdown */}
      {dropdownOpen && (
        <div style={dropdownStyle}>
          {allTags.map((tag) => {
            const selected = selectedTagIds.includes(tag.id);
            return (
              <div
                key={tag.id}
                style={tagRowStyle(selected)}
                onClick={() => toggleTag(tag.id)}
                role="option"
                aria-selected={selected}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = selected
                    ? "var(--bg-hover)"
                    : "transparent";
                }}
              >
                <span style={dotStyle(tag.color)} />
                <span style={{ flex: 1 }}>{tag.name}</span>
                {selected && (
                  <span style={{ color: "var(--accent-green)", fontSize: 13 }}>
                    &#x2713;
                  </span>
                )}
              </div>
            );
          })}

          {/* Create new tag */}
          <div style={createRowStyle}>
            <input
              ref={inputRef}
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Yeni etiket..."
              style={createInputStyle}
            />
            <button
              onClick={handleCreateTag}
              disabled={!newTagName.trim() || creating}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 4,
                border: "none",
                background: "var(--accent-blue)",
                color: "#fff",
                cursor: newTagName.trim() ? "pointer" : "default",
                opacity: newTagName.trim() && !creating ? 1 : 0.5,
                fontFamily: "inherit",
                fontWeight: 600,
              }}
            >
              Ekle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
