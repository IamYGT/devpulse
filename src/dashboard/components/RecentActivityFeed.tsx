import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useInterval } from "../../hooks/useInterval";
import type { TimelineEntry } from "../../types";

function categoryColor(cat: string): string {
  if (cat === "productive") return "var(--accent-green)";
  if (cat === "distracting") return "var(--accent-red)";
  return "var(--text-muted)";
}

function timeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return `${diffSec}sn once`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}dk once`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}s once`;
  return `${Math.floor(diffHour / 24)}g once`;
}

function categoryLabel(cat: string): string {
  if (cat === "productive") return "Uretken";
  if (cat === "distracting") return "Dikkat Dagitici";
  if (cat === "idle") return "Bosta";
  return "Notr";
}

export default function RecentActivityFeed() {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [tooltipEntry, setTooltipEntry] = useState<{
    entry: TimelineEntry;
    top: number;
    left: number;
  } | null>(null);

  const fetchTimeline = useCallback(async () => {
    try {
      const data = await invoke<TimelineEntry[]>("get_today_timeline");
      // Take the last 20 entries, newest first
      const recent = data.slice(-20).reverse();
      setEntries(recent);
    } catch {
      // silent fail
    }
  }, []);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  // Auto-update every 5 seconds
  useInterval(fetchTimeline, 5000);

  if (entries.length === 0) {
    return (
      <div
        style={{
          color: "var(--text-muted)",
          fontSize: 13,
          padding: "20px 0",
          textAlign: "center",
        }}
      >
        Henuz aktivite yok
      </div>
    );
  }

  return (
    <div
      style={{
        maxHeight: 400,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        position: "relative",
      }}
    >
      {entries.map((entry, i) => (
        <div
          key={`${entry.timestamp}-${i}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            borderRadius: "var(--radius)",
            cursor: "pointer",
            transition: "background 0.15s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.background =
              "var(--bg-hover)";
            const rect = e.currentTarget.getBoundingClientRect();
            setTooltipEntry({
              entry,
              top: rect.top,
              left: rect.right + 8,
            });
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = "transparent";
            setTooltipEntry(null);
          }}
        >
          {/* Category colored dot */}
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: categoryColor(entry.category),
              flexShrink: 0,
            }}
          />

          {/* App icon placeholder */}
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              color: "var(--text-muted)",
              flexShrink: 0,
              textTransform: "uppercase",
            }}
          >
            {entry.process_name.charAt(0)}
          </div>

          {/* Description */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontWeight: 600 }}>{entry.process_name}</span>
              <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>
                gecis yapildi
              </span>
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                marginTop: 1,
              }}
            >
              {categoryLabel(entry.category)}
            </div>
          </div>

          {/* Time ago */}
          <div
            style={{
              flexShrink: 0,
              fontSize: 11,
              color: "var(--text-muted)",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {timeAgo(entry.timestamp)}
          </div>
        </div>
      ))}

      {/* Click/hover tooltip showing window title */}
      {tooltipEntry && (
        <div
          style={{
            position: "fixed",
            top: tooltipEntry.top,
            left: tooltipEntry.left,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "8px 12px",
            fontSize: 11,
            color: "var(--text-primary)",
            maxWidth: 320,
            zIndex: 1000,
            pointerEvents: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            wordBreak: "break-word",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              marginBottom: 2,
              color: "var(--text-muted)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Pencere Basligi
          </div>
          <div>{tooltipEntry.entry.window_title || "Bilinmiyor"}</div>
        </div>
      )}
    </div>
  );
}
