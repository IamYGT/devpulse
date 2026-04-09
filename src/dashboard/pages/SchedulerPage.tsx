import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Project } from "../../types";
import ScheduleTimeline from "../components/ScheduleTimeline";
import type { ScheduleBlock } from "../components/ScheduleTimeline";
import NextUpCard from "../components/NextUpCard";
import BurndownChart from "../components/BurndownChart";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DaySchedule {
  date: string;
  blocks: ScheduleBlock[];
  total_planned_minutes: number;
  total_actual_minutes: number;
  adherence_score: number;
}

interface ScheduleSuggestion {
  project_name: string;
  project_id: number;
  suggested_minutes: number;
  reason: string;
  priority: string;
}

interface ScheduleTemplate {
  id: number;
  name: string;
  blocks: { project_id: number; start_time: string; end_time: string; day_of_week: number }[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function displayDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["Paz", "Pzt", "Sal", "Car", "Per", "Cum", "Cmt"];
  const months = ["Oca", "Sub", "Mar", "Nis", "May", "Haz", "Tem", "Agu", "Eyl", "Eki", "Kas", "Ara"];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function isToday(dateStr: string): boolean {
  return dateStr === formatDate(new Date());
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
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
/*  SVG Icons                                                          */
/* ------------------------------------------------------------------ */

const IconCalendar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const IconZap = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const IconSave = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
  </svg>
);

const IconChevronLeft = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const IconChevronRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Block Edit Modal                                                   */
/* ------------------------------------------------------------------ */

function BlockModal({
  block,
  projects,
  onSave,
  onDelete,
  onClose,
}: {
  block: Partial<ScheduleBlock> & { date?: string };
  projects: Project[];
  onSave: (data: { project_id: number; start_time: string; end_time: string; priority: string; status: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [projectId, setProjectId] = useState(block.project_id || (projects[0]?.id ?? 0));
  const [startTime, setStartTime] = useState(block.start_time || "09:00");
  const [endTime, setEndTime] = useState(block.end_time || "10:00");
  const [priority, setPriority] = useState(block.priority || "P1");
  const [status, setStatus] = useState(block.status || "planned");

  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 24,
          width: 380,
          maxWidth: "90vw",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: "var(--text-primary)" }}>
            {block.id ? "Blogu Duzenle" : "Yeni Blok"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <IconX />
          </button>
        </div>

        {/* Project select */}
        <label style={{ display: "block", marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Proje</span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(Number(e.target.value))}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              fontSize: 13,
            }}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>

        {/* Time inputs */}
        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <label style={{ flex: 1 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Baslangic</span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                fontSize: 13,
              }}
            />
          </label>
          <label style={{ flex: 1 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Bitis</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                fontSize: 13,
              }}
            />
          </label>
        </div>

        {/* Priority */}
        <label style={{ display: "block", marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Oncelik</span>
          <div style={{ display: "flex", gap: 8 }}>
            {["P0", "P1", "P2"].map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  borderRadius: 6,
                  border: priority === p ? "2px solid" : "1px solid var(--border)",
                  borderColor: priority === p
                    ? (p === "P0" ? "var(--accent-red)" : p === "P1" ? "var(--accent-orange)" : "var(--accent-blue)")
                    : "var(--border)",
                  background: priority === p ? `${p === "P0" ? "var(--accent-red)" : p === "P1" ? "var(--accent-orange)" : "var(--accent-blue)"}22` : "transparent",
                  color: priority === p ? "var(--text-primary)" : "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: priority === p ? 700 : 500,
                  cursor: "pointer",
                }}
              >
                {p} {p === "P0" ? "Kritik" : p === "P1" ? "Normal" : "Dusuk"}
              </button>
            ))}
          </div>
        </label>

        {/* Status (only for editing) */}
        {block.id && (
          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Durum</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                fontSize: 13,
              }}
            >
              <option value="planned">Planli</option>
              <option value="active">Aktif</option>
              <option value="completed">Tamamlandi</option>
              <option value="skipped">Atlandi</option>
            </select>
          </label>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button
            onClick={() => onSave({ project_id: projectId, start_time: startTime, end_time: endTime, priority, status })}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              background: "var(--accent-blue)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {block.id ? "Guncelle" : "Olustur"}
          </button>
          {block.id && onDelete && (
            <button
              onClick={onDelete}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid var(--accent-red)",
                background: "transparent",
                color: "var(--accent-red)",
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <IconTrash /> Sil
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Suggestion Card                                                    */
/* ------------------------------------------------------------------ */

function SuggestionCard({ suggestion }: { suggestion: ScheduleSuggestion }) {
  const color = getProjectColor(suggestion.project_id);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        marginBottom: 6,
      }}
    >
      <div style={{ width: 4, height: 32, borderRadius: 2, background: color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {suggestion.project_name}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
          {suggestion.reason}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: "monospace" }}>
          {formatMinutes(suggestion.suggested_minutes)}
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#fff",
            background: suggestion.priority === "P0" ? "var(--accent-red)"
              : suggestion.priority === "P1" ? "var(--accent-orange)"
              : "var(--accent-blue)",
            borderRadius: 3,
            padding: "1px 5px",
          }}
        >
          {suggestion.priority}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Adherence gauge                                                    */
/* ------------------------------------------------------------------ */

function AdherenceGauge({ score }: { score: number }) {
  const color = score >= 70 ? "var(--accent-green)"
    : score >= 40 ? "var(--accent-yellow)"
    : "var(--accent-red)";
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div style={{ textAlign: "center" }}>
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r="36" fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle
          cx="44" cy="44" r="36"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 44 44)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text x="44" y="44" textAnchor="middle" dominantBaseline="central"
          style={{ fontSize: 18, fontWeight: 800, fill: color, fontFamily: "monospace" }}>
          {Math.round(score)}
        </text>
      </svg>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Uyum Skoru</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Planned vs Actual bars                                             */
/* ------------------------------------------------------------------ */

function PlannedVsActual({ blocks }: { blocks: ScheduleBlock[] }) {
  // Aggregate by project
  const projectMap = new Map<number, { name: string; planned: number; actual: number }>();
  for (const b of blocks) {
    const [sh, sm] = b.start_time.split(":").map(Number);
    const [eh, em] = b.end_time.split(":").map(Number);
    const planned = (eh * 60 + em) - (sh * 60 + sm);
    const existing = projectMap.get(b.project_id) || { name: b.project_name, planned: 0, actual: 0 };
    existing.planned += planned;
    existing.actual += b.actual_minutes;
    projectMap.set(b.project_id, existing);
  }

  const entries = Array.from(projectMap.entries());
  if (entries.length === 0) return null;

  const maxMinutes = Math.max(...entries.map(([, v]) => Math.max(v.planned, v.actual)), 1);

  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
        Planli vs Gercek
      </div>
      {entries.map(([pid, data]) => {
        const color = getProjectColor(pid);
        return (
          <div key={pid} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {data.name}
            </div>
            {/* Planned bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <div style={{ width: 40, fontSize: 10, color: "var(--text-muted)", textAlign: "right" }}>Planli</div>
              <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${(data.planned / maxMinutes) * 100}%`, height: "100%", background: `${color}66`, borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace", width: 40, textAlign: "right" }}>{data.planned}dk</span>
            </div>
            {/* Actual bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 40, fontSize: 10, color: "var(--text-muted)", textAlign: "right" }}>Gercek</div>
              <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${(data.actual / maxMinutes) * 100}%`, height: "100%", background: color, borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace", width: 40, textAlign: "right" }}>{data.actual}dk</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN PAGE                                                          */
/* ------------------------------------------------------------------ */

export default function SchedulerPage() {
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [schedule, setSchedule] = useState<DaySchedule | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [suggestions, setSuggestions] = useState<ScheduleSuggestion[]>([]);
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [editingBlock, setEditingBlock] = useState<(Partial<ScheduleBlock> & { date?: string }) | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchSchedule = useCallback(async () => {
    try {
      const result = await invoke<DaySchedule>("get_schedule_for_date", { date: selectedDate });
      setSchedule(result);
    } catch {
      setSchedule(null);
    }
  }, [selectedDate]);

  const fetchProjects = async () => {
    try {
      const result = await invoke<Project[]>("get_projects");
      setProjects(result);
    } catch { /* ignore */ }
  };

  const fetchSuggestions = async () => {
    try {
      const result = await invoke<ScheduleSuggestion[]>("get_schedule_suggestions");
      setSuggestions(result);
    } catch { /* ignore */ }
  };

  const fetchTemplates = async () => {
    try {
      const result = await invoke<ScheduleTemplate[]>("get_schedule_templates");
      setTemplates(result);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchSchedule();
    fetchProjects();
    fetchSuggestions();
    fetchTemplates();
  }, [fetchSchedule]);

  // Auto-refresh every 60s
  useEffect(() => {
    const iv = setInterval(() => { fetchSchedule(); fetchSuggestions(); }, 60_000);
    return () => clearInterval(iv);
  }, [fetchSchedule]);

  const goToday = () => setSelectedDate(formatDate(new Date()));
  const goTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setSelectedDate(formatDate(d));
  };
  const goPrev = () => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() - 1);
    setSelectedDate(formatDate(d));
  };
  const goNext = () => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + 1);
    setSelectedDate(formatDate(d));
  };

  const handleAutoGenerate = async () => {
    setLoading(true);
    try {
      await invoke("auto_generate_schedule", { date: selectedDate });
      await fetchSchedule();
      await fetchSuggestions();
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleApplyTemplate = async (name: string) => {
    try {
      await invoke("apply_schedule_template", { templateName: name, date: selectedDate });
      await fetchSchedule();
    } catch { /* ignore */ }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !schedule) return;
    const blocksData = schedule.blocks.map((b) => ({
      project_id: b.project_id,
      start_time: b.start_time,
      end_time: b.end_time,
      day_of_week: -1, // applies to all days
    }));
    try {
      await invoke("save_schedule_template", {
        name: templateName.trim(),
        blocksJson: JSON.stringify(blocksData),
      });
      setShowSaveTemplate(false);
      setTemplateName("");
      await fetchTemplates();
    } catch { /* ignore */ }
  };

  const handleBlockClick = (block: ScheduleBlock) => {
    setEditingBlock(block);
  };

  const handleSlotClick = (hour: number) => {
    setEditingBlock({
      date: selectedDate,
      start_time: `${String(hour).padStart(2, "0")}:00`,
      end_time: `${String(hour + 1).padStart(2, "0")}:00`,
      priority: "P1",
      status: "planned",
    });
  };

  const handleSaveBlock = async (data: { project_id: number; start_time: string; end_time: string; priority: string; status: string }) => {
    if (editingBlock?.id) {
      // Update
      await invoke("update_schedule_block", {
        id: editingBlock.id,
        startTime: data.start_time,
        endTime: data.end_time,
        priority: data.priority,
        status: data.status,
      });
    } else {
      // Create
      await invoke("create_schedule_block", {
        date: selectedDate,
        projectId: data.project_id,
        startTime: data.start_time,
        endTime: data.end_time,
        priority: data.priority,
      });
    }
    setEditingBlock(null);
    await fetchSchedule();
  };

  const handleDeleteBlock = async () => {
    if (!editingBlock?.id) return;
    await invoke("delete_schedule_block", { id: editingBlock.id });
    setEditingBlock(null);
    await fetchSchedule();
  };

  const blocks = schedule?.blocks || [];
  const totalPlanned = schedule?.total_planned_minutes || 0;
  const totalActual = schedule?.total_actual_minutes || 0;
  const adherence = schedule?.adherence_score || 0;
  const completedCount = blocks.filter((b) => b.status === "completed").length;
  const skippedCount = blocks.filter((b) => b.status === "skipped").length;

  return (
    <div style={{ display: "flex", height: "100%", gap: 0 }}>
      {/* ═════════ LEFT: Timeline ═════════ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {/* Date navigation */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={goPrev} style={navBtnStyle}><IconChevronLeft /></button>
            <button
              onClick={goToday}
              style={{
                ...pillBtnStyle,
                background: isToday(selectedDate) ? "var(--accent-blue)" : "var(--bg-card)",
                color: isToday(selectedDate) ? "#fff" : "var(--text-secondary)",
                fontWeight: 600,
              }}
            >
              Bugun
            </button>
            <button
              onClick={goTomorrow}
              style={{
                ...pillBtnStyle,
                background: "var(--bg-card)",
                color: "var(--text-secondary)",
              }}
            >
              Yarin
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: "5px 8px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--bg-card)",
                color: "var(--text-secondary)",
                fontSize: 12,
              }}
            />
            <button onClick={goNext} style={navBtnStyle}><IconChevronRight /></button>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Auto-generate button */}
            <button
              onClick={handleAutoGenerate}
              disabled={loading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 14px",
                borderRadius: 8,
                border: "none",
                background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                cursor: loading ? "wait" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              <IconZap />
              {loading ? "Olusturuluyor..." : "Otomatik Planla"}
            </button>

            {/* Template dropdown */}
            {templates.length > 0 && (
              <select
                onChange={(e) => { if (e.target.value) handleApplyTemplate(e.target.value); e.target.value = ""; }}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-card)",
                  color: "var(--text-secondary)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
                defaultValue=""
              >
                <option value="" disabled>Sablondan Uygula</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            )}

            {/* Save as template */}
            {blocks.length > 0 && (
              <button
                onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                <IconSave /> Sablon Kaydet
              </button>
            )}
          </div>
        </div>

        {/* Save template inline */}
        {showSaveTemplate && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-secondary)",
          }}>
            <input
              type="text"
              placeholder="Sablon adi..."
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                fontSize: 12,
              }}
            />
            <button
              onClick={handleSaveTemplate}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "none",
                background: "var(--accent-green)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Kaydet
            </button>
            <button
              onClick={() => setShowSaveTemplate(false)}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-muted)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Iptal
            </button>
          </div>
        )}

        {/* Date display */}
        <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <IconCalendar />
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
            {displayDate(selectedDate)}
          </span>
          {isToday(selectedDate) && (
            <span style={{ fontSize: 10, background: "var(--accent-green)", color: "#fff", borderRadius: 4, padding: "2px 6px", fontWeight: 700 }}>
              BUGUN
            </span>
          )}
          <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>
            {blocks.length} blok / {formatMinutes(totalPlanned)} planli
          </span>
        </div>

        {/* Timeline */}
        <div style={{ flex: 1, overflow: "hidden", padding: "0 8px 8px 0" }}>
          {blocks.length === 0 ? (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 12,
              color: "var(--text-muted)",
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <div style={{ fontSize: 14 }}>Bu gun icin plan yok</div>
              <div style={{ fontSize: 12 }}>Zaman slotuna tiklayarak blok olusturun veya "Otomatik Planla"yi deneyin</div>
            </div>
          ) : (
            <ScheduleTimeline
              blocks={blocks}
              onBlockClick={handleBlockClick}
              onSlotClick={handleSlotClick}
            />
          )}
        </div>
      </div>

      {/* ═════════ RIGHT: Sidebar ═════════ */}
      <div
        style={{
          width: 300,
          borderLeft: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          padding: 16,
          overflowY: "auto",
          flexShrink: 0,
        }}
      >
        {/* Next Up */}
        <NextUpCard onRefresh={fetchSchedule} />

        {/* Burndown Chart - show if there's an active block with a project */}
        {(() => {
          const activeBlock = blocks.find((b) => b.status === "active");
          if (!activeBlock) return null;
          const project = projects.find((p) => p.id === activeBlock.project_id);
          if (!project || !project.daily_budget_minutes) return null;
          return (
            <div style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 16,
            }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                Butce Yakim Grafigi
              </div>
              <BurndownChart projectId={activeBlock.project_id} budgetMinutes={project.daily_budget_minutes} />
            </div>
          );
        })()}

        {/* Day summary */}
        <div style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 16,
        }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
            Bugunun Ozeti
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <AdherenceGauge score={adherence} />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Planli</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", fontFamily: "monospace" }}>{formatMinutes(totalPlanned)}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>Gerceklesen</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent-green)", fontFamily: "monospace" }}>{formatMinutes(totalActual)}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <MiniStat label="Tamamlanan" value={String(completedCount)} color="var(--accent-green)" />
            <MiniStat label="Atlanan" value={String(skippedCount)} color="var(--accent-red)" />
            <MiniStat label="Toplam" value={String(blocks.length)} color="var(--accent-blue)" />
          </div>
        </div>

        {/* Planned vs Actual */}
        {blocks.length > 0 && (
          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 16,
          }}>
            <PlannedVsActual blocks={blocks} />
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
              Oneriler
            </div>
            {suggestions.slice(0, 5).map((s, i) => (
              <SuggestionCard key={i} suggestion={s} />
            ))}
          </div>
        )}
      </div>

      {/* ═════════ Block Edit Modal ═════════ */}
      {editingBlock && (
        <BlockModal
          block={editingBlock}
          projects={projects}
          onSave={handleSaveBlock}
          onDelete={editingBlock.id ? handleDeleteBlock : undefined}
          onClose={() => setEditingBlock(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      flex: 1,
      textAlign: "center",
      padding: "6px 4px",
      borderRadius: 6,
      background: `${color}11`,
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 30,
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text-secondary)",
  cursor: "pointer",
};

const pillBtnStyle: React.CSSProperties = {
  padding: "5px 12px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  fontSize: 12,
  cursor: "pointer",
};
