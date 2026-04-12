import { useState, useEffect, useCallback, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface JournalEntry {
  id: number;
  date: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface TodaySummary {
  total_hours: number;
  total_minutes: number;
  productivity_percentage: number;
  commit_count: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDateTR(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("tr-TR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function JournalView() {
  const todayStr = toISODate(new Date());
  const [date, setDate] = useState(todayStr);
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState<TodaySummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  /* ── Fetch journal entry ──────────────────────────────────── */
  const fetchEntry = useCallback(async () => {
    try {
      const result = await invoke<JournalEntry>("get_today_journal", { date });
      setEntry(result);
      setContent(result.content ?? "");
      setDirty(false);
    } catch {
      setEntry(null);
      setContent("");
      setDirty(false);
    }
  }, [date]);

  /* ── Fetch activity summary ───────────────────────────────── */
  const fetchSummary = useCallback(async () => {
    try {
      const result = await invoke<TodaySummary>("get_day_summary", { date });
      setSummary(result);
    } catch {
      setSummary(null);
    }
  }, [date]);

  useEffect(() => {
    fetchEntry();
    fetchSummary();
  }, [fetchEntry, fetchSummary]);

  /* ── Save ─────────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await invoke("save_journal_entry", {
        date,
        content: content.trim(),
      });
      setDirty(false);
      await fetchEntry();
    } catch (err) {
      console.error("Jurnal kaydedilemedi:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    setDirty(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  /* ── Navigation ───────────────────────────────────────────── */
  const goYesterday = () => {
    setDate(shiftDate(date, -1));
  };

  const goTomorrow = () => {
    const next = shiftDate(date, 1);
    if (next <= todayStr) setDate(next);
  };

  const goToday = () => {
    setDate(todayStr);
  };

  const isToday = date === todayStr;
  const canGoForward = date < todayStr;

  /* ── Summary text ─────────────────────────────────────────── */
  const summaryText = summary
    ? `Bugun ${Math.floor(summary.total_minutes / 60)}s ${Math.round(summary.total_minutes % 60)}dk calisti, %${Math.round(summary.productivity_percentage)} verimlilik, ${summary.commit_count} commit`
    : null;

  /* ── Styles ───────────────────────────────────────────────── */
  const containerStyle: CSSProperties = {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  };

  const navStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  };

  const navBtnStyle = (disabled?: boolean): CSSProperties => ({
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: 6,
    color: disabled ? "var(--text-muted)" : "var(--text-primary)",
    cursor: disabled ? "default" : "pointer",
    padding: "6px 12px",
    fontSize: 14,
    fontWeight: 500,
    transition: "all 0.15s ease",
    opacity: disabled ? 0.4 : 1,
    fontFamily: "inherit",
  });

  const dateLabelStyle: CSSProperties = {
    fontSize: 15,
    fontWeight: 600,
    color: "var(--text-primary)",
    minWidth: 200,
    textAlign: "center",
  };

  const summaryCardStyle: CSSProperties = {
    background: "var(--bg-secondary)",
    borderRadius: 8,
    padding: "12px 16px",
    borderLeft: "3px solid var(--accent-blue)",
  };

  const summaryTextStyle: CSSProperties = {
    fontSize: 13,
    color: "var(--text-secondary)",
    lineHeight: 1.5,
  };

  const textareaStyle: CSSProperties = {
    width: "100%",
    minHeight: 200,
    resize: "vertical",
    fontSize: 13,
    lineHeight: 1.7,
    padding: 16,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color 0.2s ease",
  };

  const footerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  };

  return (
    <div style={containerStyle}>
      {/* Date navigation */}
      <div style={navStyle}>
        <button
          style={navBtnStyle()}
          onClick={goYesterday}
          aria-label="Onceki gun"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "none";
          }}
        >
          &lt;
        </button>

        <span style={dateLabelStyle}>{formatDateTR(date)}</span>

        <button
          style={navBtnStyle(!canGoForward)}
          onClick={goTomorrow}
          disabled={!canGoForward}
          aria-label="Sonraki gun"
          onMouseEnter={(e) => {
            if (canGoForward)
              e.currentTarget.style.background = "var(--bg-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "none";
          }}
        >
          &gt;
        </button>
      </div>

      {/* Today button if not today */}
      {!isToday && (
        <div style={{ textAlign: "center" }}>
          <button
            onClick={goToday}
            style={{
              fontSize: 12,
              color: "var(--accent-blue)",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
              fontFamily: "inherit",
            }}
          >
            Bugune don
          </button>
        </div>
      )}

      {/* Activity summary */}
      {summaryText && (
        <div style={summaryCardStyle}>
          <div style={summaryTextStyle}>{summaryText}</div>
        </div>
      )}

      {/* Editor */}
      <textarea
        value={content}
        onChange={(e) => handleContentChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Gunluk notlarinizi buraya yazin..."
        style={textareaStyle}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--accent-blue)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--border)";
        }}
      />

      {/* Footer */}
      <div style={footerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {!isToday && (
            <button
              onClick={() => setDate(shiftDate(date, -1))}
              style={{
                fontSize: 12,
                color: "var(--accent-blue)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Dunku notlara git
            </button>
          )}
          {dirty && (
            <span
              style={{
                fontSize: 11,
                color: "var(--accent-yellow)",
                fontWeight: 500,
              }}
            >
              Kaydedilmemis degisiklikler
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Ctrl+S ile kaydet
          </span>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!dirty || saving}
            style={{
              fontSize: 12,
              padding: "8px 20px",
              opacity: !dirty || saving ? 0.5 : 1,
            }}
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>

      {/* Last edit info */}
      {entry?.updated_at && (
        <div
          style={{
            fontSize: 10,
            color: "var(--text-muted)",
            textAlign: "right",
          }}
        >
          Son duzenleme:{" "}
          {new Date(entry.updated_at).toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}
    </div>
  );
}
