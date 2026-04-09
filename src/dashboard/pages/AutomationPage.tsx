import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import PatternCard from "../components/PatternCard";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface RuleCondition {
  condition_type: string;
  value: string;
}

interface RuleAction {
  action_type: string;
  value: string;
}

interface AutomationRule {
  id: number;
  name: string;
  enabled: boolean;
  condition: RuleCondition;
  action: RuleAction;
  last_triggered: string | null;
  trigger_count: number;
}

interface WorkPattern {
  pattern_type: string;
  description: string;
  confidence: number;
  data: Record<string, unknown>;
}

interface CategorySuggestion {
  process_name: string;
  suggested_category: string;
  confidence: number;
  reason: string;
}

/* ------------------------------------------------------------------ */
/*  Condition / Action Presets                                         */
/* ------------------------------------------------------------------ */

const CONDITION_PRESETS = [
  {
    label: "Proje suresi asildiginda",
    type: "time_exceeded",
    defaultValue: '{"minutes": 120}',
  },
  {
    label: "Verimlilik dusunce",
    type: "productivity_below",
    defaultValue: '{"percentage": 40}',
  },
  {
    label: "Dikkat dagitici uygulamada",
    type: "distracting_app",
    defaultValue: "{}",
  },
  {
    label: "Bosta kalinca",
    type: "idle_detected",
    defaultValue: "{}",
  },
  {
    label: "Commit yapilmayinca",
    type: "no_commits",
    defaultValue: '{"hours": 2}',
  },
];

const ACTION_PRESETS = [
  {
    label: "Bildirim gonder",
    type: "notify",
    defaultValue: '{"message": "Dikkat!"}',
  },
  {
    label: "Proje degistir oner",
    type: "switch_project",
    defaultValue: "{}",
  },
  {
    label: "Pomodoro baslat",
    type: "start_pomodoro",
    defaultValue: '{"work_minutes": 25}',
  },
];

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

const IconPlus = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconTrash = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const IconCheck = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const categoryColors: Record<string, string> = {
  productive: "var(--accent-green)",
  distracting: "var(--accent-red)",
  neutral: "var(--text-muted)",
};

const categoryLabels: Record<string, string> = {
  productive: "Verimli",
  distracting: "Dikkat Dagitici",
  neutral: "Notr",
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function AutomationPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [patterns, setPatterns] = useState<WorkPattern[]>([]);
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "rules" | "patterns" | "categories"
  >("rules");

  // Create form state
  const [newName, setNewName] = useState("");
  const [selectedCondition, setSelectedCondition] = useState(0);
  const [selectedAction, setSelectedAction] = useState(0);

  const fetchRules = async () => {
    try {
      const r = await invoke<AutomationRule[]>("get_automation_rules");
      setRules(r);
    } catch (err) {
      console.error("Failed to fetch rules:", err);
    }
  };

  const fetchPatterns = async () => {
    try {
      const p = await invoke<WorkPattern[]>("get_detected_patterns");
      setPatterns(p);
    } catch (err) {
      console.error("Failed to fetch patterns:", err);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const s = await invoke<CategorySuggestion[]>(
        "get_auto_category_suggestions"
      );
      setSuggestions(s);
    } catch (err) {
      console.error("Failed to fetch suggestions:", err);
    }
  };

  useEffect(() => {
    fetchRules();
    fetchPatterns();
    fetchSuggestions();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const cond = CONDITION_PRESETS[selectedCondition];
    const act = ACTION_PRESETS[selectedAction];

    try {
      await invoke("create_automation_rule", {
        name: newName,
        conditionJson: JSON.stringify({
          condition_type: cond.type,
          value: cond.defaultValue,
        }),
        actionJson: JSON.stringify({
          action_type: act.type,
          value: act.defaultValue,
        }),
      });
      setNewName("");
      setShowCreate(false);
      fetchRules();
    } catch (err) {
      console.error("Failed to create rule:", err);
    }
  };

  const handleToggle = async (id: number, enabled: boolean) => {
    try {
      await invoke("update_automation_rule", { id, enabled: !enabled });
      fetchRules();
    } catch (err) {
      console.error("Failed to toggle rule:", err);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await invoke("delete_automation_rule", { id });
      fetchRules();
    } catch (err) {
      console.error("Failed to delete rule:", err);
    }
  };

  const handleCreateFromPattern = (pattern: WorkPattern) => {
    // Pre-fill a rule based on the pattern
    setActiveTab("rules");
    setShowCreate(true);

    switch (pattern.pattern_type) {
      case "productive_hours": {
        setNewName("Verimli saatlerde bildirim");
        setSelectedCondition(1); // productivity_below
        setSelectedAction(0); // notify
        break;
      }
      case "distraction_triggers": {
        setNewName("Dikkat dagitici uygulama uyarisi");
        setSelectedCondition(2); // distracting_app
        setSelectedAction(0); // notify
        break;
      }
      case "context_switching": {
        setNewName("Cok fazla uygulama degisimi");
        setSelectedCondition(1); // productivity_below
        setSelectedAction(2); // start_pomodoro
        break;
      }
      case "session_sweet_spot": {
        setNewName("Optimal calisma suresi asimi");
        setSelectedCondition(0); // time_exceeded
        setSelectedAction(0); // notify
        break;
      }
      case "weekly_rhythm": {
        setNewName("Dusuk verimlilik gunu uyarisi");
        setSelectedCondition(1); // productivity_below
        setSelectedAction(2); // start_pomodoro
        break;
      }
      default: {
        setNewName("Yeni otomasyon kurali");
      }
    }
  };

  const conditionLabel = (type: string) =>
    CONDITION_PRESETS.find((c) => c.type === type)?.label || type;
  const actionLabel = (type: string) =>
    ACTION_PRESETS.find((a) => a.type === type)?.label || type;

  return (
    <div>
      <h1 className="page-title">Otomasyon</h1>

      {/* Tab navigation */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          background: "var(--card-bg)",
          borderRadius: "var(--radius)",
          padding: 4,
        }}
      >
        {(
          [
            ["rules", "Kurallar"],
            ["patterns", "Patternler"],
            ["categories", "Kategori Onerileri"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: "calc(var(--radius) - 2px)",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              background:
                activeTab === key ? "var(--accent-blue)" : "transparent",
              color: activeTab === key ? "#fff" : "var(--text-secondary)",
              transition: "all 0.2s ease",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Rules Tab */}
      {activeTab === "rules" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
              }}
            >
              {rules.length} kural tanimli
            </span>
            <button
              onClick={() => setShowCreate(!showCreate)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: "var(--radius)",
                border: "none",
                background: "var(--accent-blue)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <IconPlus />
              Yeni Kural
            </button>
          </div>

          {/* Create form */}
          {showCreate && (
            <div
              className="card"
              style={{
                padding: 20,
                marginBottom: 16,
                borderLeft: "3px solid var(--accent-blue)",
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Kural Adi
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ornek: Uzun calisma uyarisi"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    color: "var(--text-primary)",
                    fontSize: 13,
                    outline: "none",
                  }}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Kosul
                  </label>
                  <select
                    value={selectedCondition}
                    onChange={(e) =>
                      setSelectedCondition(Number(e.target.value))
                    }
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--border)",
                      background: "var(--bg)",
                      color: "var(--text-primary)",
                      fontSize: 13,
                      outline: "none",
                    }}
                  >
                    {CONDITION_PRESETS.map((c, i) => (
                      <option key={c.type} value={i}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Aksiyon
                  </label>
                  <select
                    value={selectedAction}
                    onChange={(e) => setSelectedAction(Number(e.target.value))}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--border)",
                      background: "var(--bg)",
                      color: "var(--text-primary)",
                      fontSize: 13,
                      outline: "none",
                    }}
                  >
                    {ACTION_PRESETS.map((a, i) => (
                      <option key={a.type} value={i}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "var(--radius)",
                    border: "none",
                    background: newName.trim()
                      ? "var(--accent-green)"
                      : "var(--border)",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: newName.trim() ? "pointer" : "default",
                    opacity: newName.trim() ? 1 : 0.5,
                  }}
                >
                  Olustur
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Iptal
                </button>
              </div>
            </div>
          )}

          {/* Rule list */}
          {rules.length === 0 && !showCreate && (
            <div className="empty-state">
              <div className="empty-icon">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-muted)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
              <h3>Henuz otomasyon kurali yok</h3>
              <p>
                "Yeni Kural" butonuyla ilk kuralini olustur. Kurallar
                calisma durumuna gore otomatik aksiyonlar tetikler.
              </p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="card"
                style={{
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  opacity: rule.enabled ? 1 : 0.55,
                  borderLeft: `3px solid ${
                    rule.enabled ? "var(--accent-blue)" : "var(--border)"
                  }`,
                }}
              >
                {/* Toggle */}
                <button
                  onClick={() => handleToggle(rule.id, rule.enabled)}
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    border: "none",
                    background: rule.enabled
                      ? "var(--accent-green)"
                      : "var(--border)",
                    cursor: "pointer",
                    position: "relative",
                    flexShrink: 0,
                    transition: "background 0.2s ease",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      left: rule.enabled ? 20 : 2,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "#fff",
                      transition: "left 0.2s ease",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }}
                  />
                </button>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      marginBottom: 2,
                    }}
                  >
                    {rule.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      display: "flex",
                      gap: 8,
                    }}
                  >
                    <span>{conditionLabel(rule.condition.condition_type)}</span>
                    <span style={{ color: "var(--border)" }}>|</span>
                    <span>{actionLabel(rule.action.action_type)}</span>
                  </div>
                </div>

                {/* Stats */}
                {rule.trigger_count > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      background: "var(--bg)",
                      padding: "2px 8px",
                      borderRadius: 100,
                      flexShrink: 0,
                    }}
                  >
                    {rule.trigger_count}x tetiklendi
                  </span>
                )}

                {/* Delete */}
                <button
                  onClick={() => handleDelete(rule.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    padding: 4,
                    borderRadius: 4,
                    display: "flex",
                    opacity: 0.5,
                    transition: "opacity 0.2s",
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                    (e.currentTarget as HTMLButtonElement).style.color =
                      "var(--accent-red)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.opacity = "0.5";
                    (e.currentTarget as HTMLButtonElement).style.color =
                      "var(--text-muted)";
                  }}
                  title="Sil"
                >
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Patterns Tab */}
      {activeTab === "patterns" && (
        <div>
          {patterns.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-muted)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <h3>Henuz pattern tespit edilmedi</h3>
              <p>
                Birkaç gun calistiktan sonra calisma patternlerin
                otomatik olarak tespit edilecek.
              </p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {patterns.map((pattern, idx) => (
              <PatternCard
                key={idx}
                pattern={pattern}
                onCreateRule={() => handleCreateFromPattern(pattern)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Category Suggestions Tab */}
      {activeTab === "categories" && (
        <div>
          {suggestions.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-muted)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h3>Tum uygulamalar kategorize edilmis</h3>
              <p>
                Yeni bir uygulama kullanmaya basladiginda burada
                kategori onerileri goreceksin.
              </p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {suggestions.map((s, idx) => (
              <div
                key={idx}
                className="card"
                style={{
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  borderLeft: `3px solid ${
                    categoryColors[s.suggested_category] || "var(--border)"
                  }`,
                }}
              >
                {/* App name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      marginBottom: 2,
                    }}
                  >
                    {s.process_name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                    }}
                  >
                    {s.reason}
                  </div>
                </div>

                {/* Suggested category badge */}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 10px",
                    borderRadius: 100,
                    background: `${
                      categoryColors[s.suggested_category] || "var(--border)"
                    }20`,
                    color:
                      categoryColors[s.suggested_category] || "var(--text-muted)",
                    flexShrink: 0,
                  }}
                >
                  {categoryLabels[s.suggested_category] || s.suggested_category}
                </span>

                {/* Confidence */}
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    flexShrink: 0,
                    minWidth: 35,
                    textAlign: "right",
                  }}
                >
                  %{Math.round(s.confidence * 100)}
                </span>

                {/* Approve button */}
                <button
                  onClick={() => {
                    // TODO: Save category via invoke
                    setSuggestions((prev) => prev.filter((_, i) => i !== idx));
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "6px 12px",
                    borderRadius: "var(--radius)",
                    border: "none",
                    background: "var(--accent-green)",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <IconCheck />
                  Onayla
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
