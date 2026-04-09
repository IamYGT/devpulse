import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface WizardProject {
  name: string;
  budgetMinutes: number;
  priority: "P0" | "P1" | "P2";
}

type EnforcementLevel = "hafif" | "normal" | "sert";

interface Preferences {
  enforcement: EnforcementLevel;
  breakInterval: number;
  autostart: boolean;
  minibarPosition: "top" | "bottom";
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "var(--bg-primary)",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "auto",
};

const wizardBox: React.CSSProperties = {
  width: "100%",
  maxWidth: 560,
  padding: "40px 36px",
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
};

const inputStyle: React.CSSProperties = {
  padding: "10px 14px",
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--text-primary)",
  fontSize: 14,
  width: "100%",
  outline: "none",
};

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  background: "rgba(99,102,241,0.15)",
  border: "1px solid rgba(99,102,241,0.3)",
  borderRadius: 20,
  fontSize: 13,
  color: "var(--accent-blue)",
  fontWeight: 500,
};

const stepIndicator: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 8,
  marginBottom: 28,
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div style={stepIndicator}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? 24 : 8,
            height: 8,
            borderRadius: 4,
            background: i === current ? "var(--accent-blue)" : i < current ? "var(--accent-green)" : "var(--border)",
            transition: "all 0.3s",
          }}
        />
      ))}
    </div>
  );
}

function SliderWithLabel({
  value,
  min,
  max,
  step,
  label,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  label: string;
  onChange: (v: number) => void;
}) {
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  const display = hours > 0 ? `${hours}s ${mins}dk` : `${mins}dk`;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span style={{ color: "var(--accent-blue)", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--accent-blue)" }}
      />
    </div>
  );
}

function ToggleSwitch({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        border: `1px solid ${active ? "var(--accent-green)" : "var(--border)"}`,
        borderRadius: "var(--radius)",
        background: active ? "rgba(34,197,94,0.08)" : "var(--bg-secondary)",
        color: active ? "var(--accent-green)" : "var(--text-secondary)",
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        transition: "all 0.2s",
        width: "100%",
        textAlign: "left",
      }}
    >
      <span
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          background: active ? "var(--accent-green)" : "var(--text-muted)",
          position: "relative",
          display: "inline-block",
          flexShrink: 0,
          transition: "background 0.2s",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: active ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.2s",
          }}
        />
      </span>
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main WelcomePage Component                                         */
/* ------------------------------------------------------------------ */

interface WelcomePageProps {
  onComplete: () => void;
}

export default function WelcomePage({ onComplete }: WelcomePageProps) {
  const [step, setStep] = useState(0);
  const [projects, setProjects] = useState<WizardProject[]>([]);
  const [projectInput, setProjectInput] = useState("");
  const [preferences, setPreferences] = useState<Preferences>({
    enforcement: "normal",
    breakInterval: 90,
    autostart: true,
    minibarPosition: "top",
  });

  const TOTAL_STEPS = 5;

  /* -- Handlers ------------------------------------------------------ */

  const addProject = () => {
    const name = projectInput.trim();
    if (!name || projects.some((p) => p.name.toLowerCase() === name.toLowerCase())) return;
    setProjects([...projects, { name, budgetMinutes: 120, priority: "P1" }]);
    setProjectInput("");
  };

  const removeProject = (idx: number) => {
    setProjects(projects.filter((_, i) => i !== idx));
  };

  const updateProjectBudget = (idx: number, minutes: number) => {
    const updated = [...projects];
    updated[idx] = { ...updated[idx], budgetMinutes: minutes };
    setProjects(updated);
  };

  const updateProjectPriority = (idx: number, priority: "P0" | "P1" | "P2") => {
    const updated = [...projects];
    updated[idx] = { ...updated[idx], priority };
    setProjects(updated);
  };

  const handleFinish = async () => {
    try {
      // Save preferences
      await invoke("save_setting", { key: "enforcement_level", value: preferences.enforcement });
      await invoke("save_setting", { key: "break_interval", value: String(preferences.breakInterval) });
      await invoke("save_setting", { key: "autostart", value: String(preferences.autostart) });
      await invoke("save_setting", { key: "minibar_position", value: preferences.minibarPosition });
      await invoke("save_setting", { key: "wizard_completed", value: "true" });

      // Save projects (budgets)
      for (const p of projects) {
        await invoke("save_setting", { key: `project_priority_${p.name}`, value: p.priority });
      }
    } catch (err) {
      console.error("Ayarlar kaydedilemedi:", err);
    }

    onComplete();
  };

  const totalAllocated = projects.reduce((a, p) => a + p.budgetMinutes, 0);
  const availableHours = 10; // assume 10 working hours

  /* ------------------------------------------------------------------ */
  /*  Step Renderers                                                     */
  /* ------------------------------------------------------------------ */

  const renderStep0 = () => (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>&#128640;</div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: "var(--text-primary)" }}>
        DevPulse'a Hosgeldin!
      </h2>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: 24, maxWidth: 420, margin: "0 auto 24px" }}>
        DevPulse, yazilim gelistirme surecini otomatik olarak takip eder.
        Hangi projelerde ne kadar calistiginizi, verimlilik oraninizi ve
        kodlama aliskanliklarnizi analiz eder.
      </p>
      <button className="btn btn-primary" onClick={() => setStep(1)} style={{ fontSize: 15, padding: "12px 32px" }}>
        Baslayalim
      </button>
    </div>
  );

  const renderStep1 = () => (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
        Hangi projelerde calisiyorsun?
      </h2>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
        Aktif projelerini ekle. DevPulse otomatik olarak hangi projede calistiginizi algilar.
      </p>

      {/* Input */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Proje adi..."
          value={projectInput}
          onChange={(e) => setProjectInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addProject()}
          style={inputStyle}
        />
        <button
          className="btn btn-primary"
          onClick={addProject}
          style={{ flexShrink: 0, padding: "10px 20px" }}
        >
          Ekle
        </button>
      </div>

      {/* Project chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20, minHeight: 40 }}>
        {projects.map((p, i) => (
          <div key={i} style={chipStyle}>
            {p.name}
            <button
              onClick={() => removeProject(i)}
              style={{
                background: "none",
                border: "none",
                color: "var(--accent-red)",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 700,
                padding: 0,
                lineHeight: 1,
              }}
            >
              &#215;
            </button>
          </div>
        ))}
        {projects.length === 0 && (
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
            Henuz proje eklenmedi
          </span>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button className="btn" onClick={() => setStep(0)} style={{ color: "var(--text-muted)" }}>
          Geri
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn"
            onClick={() => setStep(2)}
            style={{ color: "var(--text-muted)", fontSize: 12 }}
          >
            Sonra ekleyebilirsin
          </button>
          {projects.length > 0 && (
            <button className="btn btn-primary" onClick={() => setStep(2)}>
              Devam
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
        Gunluk Butceler
      </h2>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
        Her proje icin gunluk ne kadar zaman ayirmak istediginizi belirleyin.
      </p>

      {projects.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
          {projects.map((p, i) => (
            <div
              key={i}
              style={{
                padding: 16,
                background: "var(--bg-secondary)",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {(["P0", "P1", "P2"] as const).map((pr) => (
                    <button
                      key={pr}
                      onClick={() => updateProjectPriority(i, pr)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 12,
                        border: "none",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        background: p.priority === pr
                          ? pr === "P0" ? "rgba(239,68,68,0.2)" : pr === "P1" ? "rgba(234,179,8,0.2)" : "rgba(107,114,128,0.2)"
                          : "var(--bg-primary)",
                        color: p.priority === pr
                          ? pr === "P0" ? "var(--accent-red)" : pr === "P1" ? "var(--accent-yellow)" : "var(--text-muted)"
                          : "var(--text-muted)",
                        transition: "all 0.2s",
                      }}
                    >
                      {pr}
                    </button>
                  ))}
                </div>
              </div>
              <SliderWithLabel
                value={p.budgetMinutes}
                min={30}
                max={480}
                step={15}
                label="Gunluk butce"
                onChange={(v) => updateProjectBudget(i, v)}
              />
            </div>
          ))}

          {/* Total allocation bar */}
          <div style={{ padding: 12, background: "var(--bg-primary)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: "var(--text-secondary)" }}>Toplam Ayirilan</span>
              <span style={{ color: totalAllocated > availableHours * 60 ? "var(--accent-red)" : "var(--accent-green)", fontWeight: 600 }}>
                {Math.floor(totalAllocated / 60)}s {totalAllocated % 60}dk / {availableHours}s
              </span>
            </div>
            <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min((totalAllocated / (availableHours * 60)) * 100, 100)}%`,
                  background: totalAllocated > availableHours * 60 ? "var(--accent-red)" : "var(--accent-green)",
                  borderRadius: 3,
                  transition: "width 0.3s, background 0.3s",
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>
          Proje eklenmedi. Butceleri daha sonra ayarlayabilirsin.
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button className="btn" onClick={() => setStep(1)} style={{ color: "var(--text-muted)" }}>
          Geri
        </button>
        <button className="btn btn-primary" onClick={() => setStep(3)}>
          Devam
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
        Tercihler
      </h2>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
        DevPulse'un davranisini kendinize gore ayarlayin.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
        {/* Enforcement Level */}
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, display: "block" }}>
            Uygulama Sertligi
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {([
              { value: "hafif" as const, label: "Hafif", desc: "Sadece bildirim" },
              { value: "normal" as const, label: "Normal", desc: "Bildirim + uyari" },
              { value: "sert" as const, label: "Sert", desc: "Bildirim + engelleme" },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPreferences({ ...preferences, enforcement: opt.value })}
                style={{
                  flex: 1,
                  padding: "12px 8px",
                  borderRadius: "var(--radius)",
                  border: `1px solid ${preferences.enforcement === opt.value ? "var(--accent-blue)" : "var(--border)"}`,
                  background: preferences.enforcement === opt.value ? "rgba(99,102,241,0.1)" : "var(--bg-secondary)",
                  color: preferences.enforcement === opt.value ? "var(--accent-blue)" : "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: "center",
                  transition: "all 0.2s",
                }}
              >
                <div>{opt.label}</div>
                <div style={{ fontSize: 10, fontWeight: 400, marginTop: 4, color: "var(--text-muted)" }}>
                  {opt.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Break Reminder */}
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, display: "block" }}>
            Mola Hatirlatma Araligi
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {[60, 90, 120].map((mins) => (
              <button
                key={mins}
                onClick={() => setPreferences({ ...preferences, breakInterval: mins })}
                style={{
                  flex: 1,
                  padding: "10px 8px",
                  borderRadius: "var(--radius)",
                  border: `1px solid ${preferences.breakInterval === mins ? "var(--accent-blue)" : "var(--border)"}`,
                  background: preferences.breakInterval === mins ? "rgba(99,102,241,0.1)" : "var(--bg-secondary)",
                  color: preferences.breakInterval === mins ? "var(--accent-blue)" : "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  transition: "all 0.2s",
                }}
              >
                {mins} dk
              </button>
            ))}
          </div>
        </div>

        {/* Autostart */}
        <ToggleSwitch
          active={preferences.autostart}
          onClick={() => setPreferences({ ...preferences, autostart: !preferences.autostart })}
          label="Windows ile birlikte baslat"
        />

        {/* MiniBar Position */}
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, display: "block" }}>
            MiniBar Konumu
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {([
              { value: "top" as const, label: "Ust" },
              { value: "bottom" as const, label: "Alt" },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPreferences({ ...preferences, minibarPosition: opt.value })}
                style={{
                  flex: 1,
                  padding: "10px 8px",
                  borderRadius: "var(--radius)",
                  border: `1px solid ${preferences.minibarPosition === opt.value ? "var(--accent-blue)" : "var(--border)"}`,
                  background: preferences.minibarPosition === opt.value ? "rgba(99,102,241,0.1)" : "var(--bg-secondary)",
                  color: preferences.minibarPosition === opt.value ? "var(--accent-blue)" : "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  transition: "all 0.2s",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button className="btn" onClick={() => setStep(2)} style={{ color: "var(--text-muted)" }}>
          Geri
        </button>
        <button className="btn btn-primary" onClick={() => setStep(4)}>
          Devam
        </button>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>&#127881;</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        Harika! Hazirsin.
      </h2>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: 24 }}>
        DevPulse seni takip etmeye basladi.
      </p>

      {/* Summary */}
      <div
        style={{
          textAlign: "left",
          padding: 20,
          background: "var(--bg-secondary)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          marginBottom: 24,
          fontSize: 13,
          lineHeight: 2,
        }}
      >
        <div style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
          Ayar Ozeti
        </div>
        <div>
          <span style={{ color: "var(--text-muted)" }}>Projeler:</span>{" "}
          <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
            {projects.length > 0 ? projects.map((p) => p.name).join(", ") : "Henuz yok"}
          </span>
        </div>
        <div>
          <span style={{ color: "var(--text-muted)" }}>Sertlik:</span>{" "}
          <span style={{ color: "var(--accent-blue)", fontWeight: 500 }}>
            {preferences.enforcement === "hafif" ? "Hafif" : preferences.enforcement === "normal" ? "Normal" : "Sert"}
          </span>
        </div>
        <div>
          <span style={{ color: "var(--text-muted)" }}>Mola araligi:</span>{" "}
          <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{preferences.breakInterval} dakika</span>
        </div>
        <div>
          <span style={{ color: "var(--text-muted)" }}>Otomatik baslatma:</span>{" "}
          <span style={{ color: preferences.autostart ? "var(--accent-green)" : "var(--text-muted)", fontWeight: 500 }}>
            {preferences.autostart ? "Acik" : "Kapali"}
          </span>
        </div>
        <div>
          <span style={{ color: "var(--text-muted)" }}>MiniBar:</span>{" "}
          <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
            {preferences.minibarPosition === "top" ? "Ust" : "Alt"}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button className="btn" onClick={() => setStep(3)} style={{ color: "var(--text-muted)" }}>
          Geri
        </button>
        <button
          className="btn btn-primary"
          onClick={handleFinish}
          style={{ fontSize: 15, padding: "12px 32px" }}
        >
          Dashboard'a Git
        </button>
      </div>
    </div>
  );

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  const steps = [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4];

  return (
    <div style={overlayStyle}>
      <div style={wizardBox}>
        {step > 0 && <StepDots current={step - 1} total={TOTAL_STEPS - 1} />}
        {steps[step]()}
      </div>
    </div>
  );
}
