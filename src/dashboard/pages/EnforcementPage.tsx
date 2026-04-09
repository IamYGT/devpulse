import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import OvertimeReport from "../components/OvertimeReport";

interface EnforcementStatus {
  active_warnings: ActiveWarning[];
  enforcement_level: string;
  break_due: boolean;
  minutes_since_break: number;
  daily_overtime_minutes: number;
}

interface ActiveWarning {
  project_name: string;
  project_id: number;
  level: string;
  message: string;
  percentage: number;
  suggested_project: string | null;
}

interface EmergencyOverride {
  project_id: number;
  reason: string;
  timestamp: string;
  extra_minutes: number;
}

interface BreakStatus {
  minutes_since_break: number;
  break_recommended: boolean;
  break_enforced: boolean;
  last_break_time: string | null;
}

type EnforcementLevel = "gentle" | "strict" | "extreme";

const ENFORCEMENT_LEVELS: { key: EnforcementLevel; label: string; description: string }[] = [
  {
    key: "gentle",
    label: "Hafif",
    description: "Sadece bildirim gosterir, overlay yok",
  },
  {
    key: "strict",
    label: "Normal",
    description: "Butce asiminda overlay gosterir, override mumkun",
  },
  {
    key: "extreme",
    label: "Maksimum",
    description: "Agresif uyarilar, override icin sebep zorunlu",
  },
];

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return isoString;
  }
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return `${h}s ${m}dk`;
  return `${m}dk`;
}

/**
 * EnforcementPage - Settings and status page for the enforcement system.
 * Includes: enforcement level toggle, override history, break settings,
 * daily max hours, past warnings, and current status.
 */
export default function EnforcementPage() {
  const [status, setStatus] = useState<EnforcementStatus | null>(null);
  const [breakStatus, setBreakStatus] = useState<BreakStatus | null>(null);
  const [overrides, setOverrides] = useState<EmergencyOverride[]>([]);
  const [currentLevel, setCurrentLevel] = useState<EnforcementLevel>("strict");
  const [breakInterval, setBreakInterval] = useState("90");
  const [dailyMaxHours, setDailyMaxHours] = useState("10");
  const [soundEnabled, setSoundEnabled] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [s, b, o] = await Promise.all([
        invoke<EnforcementStatus>("get_enforcement_status"),
        invoke<BreakStatus>("get_break_status"),
        invoke<EmergencyOverride[]>("get_override_history"),
      ]);
      setStatus(s);
      setBreakStatus(b);
      setOverrides(o);
      if (s.enforcement_level) {
        setCurrentLevel(s.enforcement_level as EnforcementLevel);
      }
    } catch (err) {
      console.error("Enforcement page data fetch failed:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Load saved settings
    invoke<string | null>("get_setting", { key: "enforcement_break_interval" }).then((v) => {
      if (v) setBreakInterval(v);
    });
    invoke<string | null>("get_setting", { key: "enforcement_daily_max_hours" }).then((v) => {
      if (v) setDailyMaxHours(v);
    });
    invoke<string | null>("get_setting", { key: "enforcement_sound_enabled" }).then((v) => {
      if (v) setSoundEnabled(v === "true");
    });
  }, [fetchData]);

  const handleLevelChange = async (level: EnforcementLevel) => {
    try {
      await invoke("set_enforcement_level", { level });
      setCurrentLevel(level);
      await invoke("save_setting", { key: "enforcement_level", value: level });
    } catch (err) {
      console.error("Set enforcement level failed:", err);
    }
  };

  const handleSaveBreakInterval = async () => {
    const minutes = parseInt(breakInterval, 10);
    if (isNaN(minutes) || minutes < 15) return;
    try {
      await invoke("set_break_interval", { minutes });
      await invoke("save_setting", { key: "enforcement_break_interval", value: breakInterval });
    } catch (err) {
      console.error("Set break interval failed:", err);
    }
  };

  const handleSaveDailyMax = async () => {
    const hours = parseInt(dailyMaxHours, 10);
    if (isNaN(hours) || hours < 1) return;
    try {
      await invoke("set_daily_max_hours", { hours });
      await invoke("save_setting", { key: "enforcement_daily_max_hours", value: dailyMaxHours });
    } catch (err) {
      console.error("Set daily max hours failed:", err);
    }
  };

  const handleSoundToggle = async () => {
    const newVal = !soundEnabled;
    setSoundEnabled(newVal);
    await invoke("save_setting", { key: "enforcement_sound_enabled", value: String(newVal) });
  };

  const getLevelColor = (level: string): string => {
    switch (level) {
      case "critical": return "var(--accent-red)";
      case "aggressive": return "var(--accent-orange)";
      case "firm": return "var(--accent-yellow)";
      case "gentle": return "var(--accent-green)";
      default: return "var(--text-muted)";
    }
  };

  return (
    <div>
      <h1 className="page-title">Zorlama Sistemi</h1>

      {/* Current Status Summary */}
      {status && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Mevcut Durum</span>
            <div style={{
              padding: "4px 12px",
              borderRadius: "var(--radius)",
              background: status.active_warnings.length > 0 ? "rgba(239, 68, 68, 0.15)" : "rgba(34, 197, 94, 0.15)",
              color: status.active_warnings.length > 0 ? "var(--accent-red)" : "var(--accent-green)",
              fontSize: 12,
              fontWeight: 600,
            }}>
              {status.active_warnings.length > 0
                ? `${status.active_warnings.length} aktif uyari`
                : "Sorun yok"}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Son Moladan Beri</div>
              <div className="mono" style={styles.statValue}>
                {formatMinutes(status.minutes_since_break)}
              </div>
              {status.break_due && (
                <div style={{ fontSize: 11, color: "var(--accent-orange)", marginTop: 4 }}>
                  Mola oneriliyor
                </div>
              )}
            </div>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Gunluk Fazla Mesai</div>
              <div className="mono" style={{
                ...styles.statValue,
                color: status.daily_overtime_minutes > 0 ? "var(--accent-red)" : "var(--accent-green)",
              }}>
                {status.daily_overtime_minutes > 0
                  ? `+${formatMinutes(status.daily_overtime_minutes)}`
                  : "Yok"}
              </div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Zorlama Seviyesi</div>
              <div style={{ ...styles.statValue, textTransform: "capitalize" as const }}>
                {ENFORCEMENT_LEVELS.find((l) => l.key === currentLevel)?.label || currentLevel}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Warnings */}
      {status && status.active_warnings.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
            Aktif Uyarilar
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {status.active_warnings.map((warning, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  background: "var(--bg-primary)",
                  borderRadius: "var(--radius)",
                  borderLeft: `3px solid ${getLevelColor(warning.level)}`,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{warning.project_name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                    {warning.message}
                  </div>
                </div>
                <div style={{
                  padding: "4px 10px",
                  borderRadius: "var(--radius)",
                  background: `${getLevelColor(warning.level)}20`,
                  color: getLevelColor(warning.level),
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase" as const,
                }}>
                  {warning.level}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overtime Report */}
      <OvertimeReport />

      {/* Enforcement Level Toggle */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
          Zorlama Seviyesi
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {ENFORCEMENT_LEVELS.map((level) => (
            <button
              key={level.key}
              onClick={() => handleLevelChange(level.key)}
              style={{
                flex: 1,
                padding: "12px 16px",
                background: currentLevel === level.key ? "rgba(99, 102, 241, 0.15)" : "var(--bg-primary)",
                border: currentLevel === level.key ? "1px solid var(--accent-blue)" : "1px solid var(--border)",
                borderRadius: "var(--radius)",
                color: currentLevel === level.key ? "#fff" : "var(--text-secondary)",
                cursor: "pointer",
                textAlign: "left" as const,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>{level.label}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                {level.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Ayarlar</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Break interval */}
          <div style={styles.settingRow}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Mola Araligi</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                Kac dakikada bir mola hatirlatmasi yapilsin
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="number"
                value={breakInterval}
                onChange={(e) => setBreakInterval(e.target.value)}
                onBlur={handleSaveBreakInterval}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveBreakInterval(); }}
                style={styles.input}
              />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>dk</span>
            </div>
          </div>

          {/* Daily max hours */}
          <div style={styles.settingRow}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Gunluk Maksimum</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                Gunluk maksimum calisma saati
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="number"
                value={dailyMaxHours}
                onChange={(e) => setDailyMaxHours(e.target.value)}
                onBlur={handleSaveDailyMax}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveDailyMax(); }}
                style={styles.input}
              />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>saat</span>
            </div>
          </div>

          {/* Sound toggle */}
          <div style={styles.settingRow}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Sesli Uyari</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                Uyarilarda ses calsin mi
              </div>
            </div>
            <button
              onClick={handleSoundToggle}
              style={{
                padding: "6px 16px",
                background: soundEnabled ? "rgba(34, 197, 94, 0.15)" : "var(--bg-primary)",
                border: soundEnabled ? "1px solid #22c55e" : "1px solid var(--border)",
                borderRadius: "var(--radius)",
                color: soundEnabled ? "#22c55e" : "var(--text-muted)",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              {soundEnabled ? "Acik" : "Kapali"}
            </button>
          </div>
        </div>
      </div>

      {/* Break Status */}
      {breakStatus && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
            Mola Durumu
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Son Moladan Beri</div>
              <div className="mono" style={styles.statValue}>
                {formatMinutes(breakStatus.minutes_since_break)}
              </div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Son Mola</div>
              <div style={styles.statValue}>
                {breakStatus.last_break_time
                  ? formatTime(breakStatus.last_break_time)
                  : "Henuz mola alinmadi"}
              </div>
            </div>
          </div>
          {breakStatus.break_recommended && (
            <div style={{
              marginTop: 12,
              padding: "10px 14px",
              background: breakStatus.break_enforced
                ? "rgba(239, 68, 68, 0.1)"
                : "rgba(234, 179, 8, 0.1)",
              border: `1px solid ${breakStatus.break_enforced ? "rgba(239, 68, 68, 0.3)" : "rgba(234, 179, 8, 0.3)"}`,
              borderRadius: "var(--radius)",
              fontSize: 13,
              color: breakStatus.break_enforced ? "var(--accent-red)" : "var(--accent-yellow)",
            }}>
              {breakStatus.break_enforced
                ? "Mola zorunlu! Uzun suredir aralik vermedin."
                : "Kisa bir mola almani oneriyoruz."}
            </div>
          )}
        </div>
      )}

      {/* Override History */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
          Gecmis Override'lar (Bugun)
        </div>
        {overrides.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {overrides.map((override, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  background: "var(--bg-primary)",
                  borderRadius: "var(--radius)",
                  borderLeft: "3px solid var(--accent-orange)",
                }}
              >
                <div>
                  <div style={{ fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>Proje #{override.project_id}</span>
                    {" - "}
                    <span style={{ color: "var(--text-secondary)" }}>{override.reason}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    {formatTime(override.timestamp)} | +{override.extra_minutes}dk ek sure
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
            Bugun override kullanilmadi. Harika!
          </div>
        )}
      </div>
    </div>
  );
}

// --- Styles ---

const styles: Record<string, React.CSSProperties> = {
  statBox: {
    background: "var(--bg-primary)",
    borderRadius: "var(--radius)",
    padding: "12px 16px",
  },
  statLabel: {
    fontSize: 11,
    color: "var(--text-muted)",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  settingRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid var(--border)",
  },
  input: {
    width: 70,
    padding: "6px 10px",
    background: "var(--bg-primary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    color: "var(--text-primary)",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13,
    textAlign: "center" as const,
  },
};
