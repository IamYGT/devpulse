import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ScheduleBlock } from "./ScheduleTimeline";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function formatCountdown(minutes: number): string {
  if (minutes <= 0) return "Bitti";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}s ${m}dk`;
  return `${m}dk`;
}

const PROJECT_COLORS = [
  "#6366f1", "#22c55e", "#f97316", "#a855f7", "#ef4444",
  "#eab308", "#06b6d4", "#ec4899", "#14b8a6", "#f43f5e",
];

function getProjectColor(projectId: number): string {
  return PROJECT_COLORS[projectId % PROJECT_COLORS.length];
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

const IconPlay = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const IconSkip = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polygon points="5 4 15 12 5 20 5 4" />
    <line x1="19" y1="5" x2="19" y2="19" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface Props {
  onRefresh?: () => void;
}

export default function NextUpCard({ onRefresh }: Props) {
  const [block, setBlock] = useState<ScheduleBlock | null>(null);
  const [now, setNow] = useState(new Date());
  const [pulsing, setPulsing] = useState(false);

  const fetchNext = async () => {
    try {
      const result = await invoke<ScheduleBlock | null>("get_next_scheduled_project");
      setBlock(result);
    } catch {
      setBlock(null);
    }
  };

  useEffect(() => {
    fetchNext();
    const iv = setInterval(() => {
      setNow(new Date());
      fetchNext();
    }, 30_000);
    return () => clearInterval(iv);
  }, []);

  // Determine if current block is active and user might not be working on it
  useEffect(() => {
    if (!block) {
      setPulsing(false);
      return;
    }
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const blockStart = parseTime(block.start_time);
    const blockEnd = parseTime(block.end_time);
    const isCurrentBlock = nowMin >= blockStart && nowMin < blockEnd;
    setPulsing(isCurrentBlock && block.status === "planned");
  }, [block, now]);

  const handleStart = async () => {
    if (!block) return;
    try {
      await invoke("update_schedule_block", {
        id: block.id,
        startTime: block.start_time,
        endTime: block.end_time,
        priority: block.priority,
        status: "active",
      });
      fetchNext();
      onRefresh?.();
    } catch { /* ignore */ }
  };

  const handleSkip = async () => {
    if (!block) return;
    try {
      await invoke("update_schedule_block", {
        id: block.id,
        startTime: block.start_time,
        endTime: block.end_time,
        priority: block.priority,
        status: "skipped",
      });
      fetchNext();
      onRefresh?.();
    } catch { /* ignore */ }
  };

  if (!block) {
    return (
      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "20px 16px",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>
          Siradaki Gorev
        </div>
        <div style={{ fontSize: 15, color: "var(--text-secondary)" }}>
          Bugune planlanmis gorev yok
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
          "Otomatik Planla" ile gun planini olustur
        </div>
      </div>
    );
  }

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const blockStart = parseTime(block.start_time);
  const blockEnd = parseTime(block.end_time);
  const isCurrentBlock = nowMin >= blockStart && nowMin < blockEnd;
  const minutesRemaining = isCurrentBlock ? blockEnd - nowMin : blockStart - nowMin;
  const color = getProjectColor(block.project_id);
  const blockDuration = blockEnd - blockStart;

  // Progress if active
  const elapsed = isCurrentBlock ? nowMin - blockStart : 0;
  const progress = blockDuration > 0 ? Math.min((elapsed / blockDuration) * 100, 100) : 0;

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${pulsing ? color : "var(--border)"}`,
        borderRadius: 12,
        padding: "16px",
        position: "relative",
        overflow: "hidden",
        transition: "border-color 0.3s ease",
        animation: pulsing ? "pulse-border 2s ease-in-out infinite" : "none",
      }}
    >
      {/* Pulse animation style */}
      {pulsing && (
        <style>{`
          @keyframes pulse-border {
            0%, 100% { box-shadow: 0 0 0 0 ${color}44; }
            50% { box-shadow: 0 0 12px 4px ${color}44; }
          }
        `}</style>
      )}

      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
      }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
          {isCurrentBlock ? "Simdi" : "Siradaki"}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#fff",
            background: block.priority === "P0" ? "var(--accent-red)"
              : block.priority === "P1" ? "var(--accent-orange)"
              : "var(--accent-blue)",
            borderRadius: 4,
            padding: "2px 6px",
          }}
        >
          {block.priority}
        </span>
      </div>

      {/* Project name */}
      <div style={{
        fontSize: 18,
        fontWeight: 700,
        color,
        marginBottom: 6,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>
        {block.project_name}
      </div>

      {/* Time info */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 12,
        fontSize: 12,
      }}>
        <span style={{ color: "var(--text-secondary)", fontFamily: "monospace" }}>
          {block.start_time} - {block.end_time}
        </span>
        <span style={{ color: "var(--text-muted)" }}>
          {blockDuration} dk
        </span>
      </div>

      {/* Countdown */}
      <div style={{
        fontSize: 24,
        fontWeight: 800,
        color: isCurrentBlock ? color : "var(--text-primary)",
        fontFamily: "monospace",
        marginBottom: 12,
      }}>
        {isCurrentBlock ? (
          <>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>Kalan: </span>
            {formatCountdown(minutesRemaining)}
          </>
        ) : (
          <>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>Baslamaya: </span>
            {minutesRemaining > 0 ? formatCountdown(minutesRemaining) : "Hazir"}
          </>
        )}
      </div>

      {/* Progress bar (only for active blocks) */}
      {isCurrentBlock && (
        <div style={{
          width: "100%",
          height: 4,
          background: "var(--border)",
          borderRadius: 2,
          marginBottom: 12,
          overflow: "hidden",
        }}>
          <div style={{
            width: `${progress}%`,
            height: "100%",
            background: color,
            borderRadius: 2,
            transition: "width 0.5s ease",
          }} />
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleStart}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "8px 12px",
            border: "none",
            borderRadius: 8,
            background: color,
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            transition: "opacity 0.2s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
        >
          <IconPlay />
          {block.status === "active" ? "Devam Et" : "Baslat"}
        </button>
        <button
          onClick={handleSkip}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            padding: "8px 14px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "transparent",
            color: "var(--text-secondary)",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
        >
          <IconSkip />
          Gec
        </button>
      </div>
    </div>
  );
}
