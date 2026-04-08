import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ExtensionStatus {
  chrome_connected: boolean;
  chrome_last_event: string | null;
  chrome_today_events: number;
  vscode_connected: boolean;
  vscode_last_event: string | null;
  vscode_today_events: number;
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-muted)",
  marginTop: 8,
  lineHeight: 1.6,
};

const sectionGap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const codeStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 12,
  background: "var(--bg-primary)",
  padding: "3px 8px",
  borderRadius: 4,
  color: "var(--accent-blue)",
  display: "inline-block",
};

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 14px",
        borderRadius: 20,
        fontSize: 13,
        fontWeight: 600,
        background: connected ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
        color: connected ? "var(--accent-green)" : "var(--accent-red)",
        border: `1px solid ${connected ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: connected ? "var(--accent-green)" : "var(--accent-red)",
          boxShadow: connected ? "0 0 6px rgba(34,197,94,0.5)" : "none",
        }}
      />
      {connected ? "Bagli" : "Bagli degil"}
    </span>
  );
}

function StepItem({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: "10px 0",
      }}
    >
      <span
        style={{
          minWidth: 28,
          height: 28,
          borderRadius: "50%",
          background: "rgba(59,130,246,0.15)",
          color: "var(--accent-blue)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {number}
      </span>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, paddingTop: 3 }}>
        {children}
      </div>
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        padding: "10px 16px",
        background: "var(--bg-primary)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minWidth: 120,
      }}
    >
      <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </span>
      <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'JetBrains Mono', monospace" }}>
        {value}
      </span>
    </div>
  );
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return "Henuz veri yok";
  try {
    const date = new Date(ts);
    if (isNaN(date.getTime())) return ts;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec} saniye once`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} dakika once`;
    return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts;
  }
}

export default function ExtensionsPage() {
  const [status, setStatus] = useState<ExtensionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = async () => {
    try {
      const result = await invoke<ExtensionStatus>("check_extension_status");
      setStatus(result);
    } catch {
      setStatus({
        chrome_connected: false,
        chrome_last_event: null,
        chrome_today_events: 0,
        vscode_connected: false,
        vscode_last_event: null,
        vscode_today_events: 0,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleOpenChromeFolder = async () => {
    try {
      await invoke("open_extensions_folder", { folder: "chrome" });
    } catch {
      // fallback silently
    }
  };

  const handleOpenVscodeFolder = async () => {
    try {
      await invoke("open_extensions_folder", { folder: "vscode" });
    } catch {
      // fallback silently
    }
  };

  if (loading) {
    return (
      <div>
        <h1 className="page-title">Eklentiler</h1>
        <div className="card">
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            Durum kontrol ediliyor...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Eklentiler</h1>

      {/* ── Chrome Extension ── */}
      <div className="card">
        <div className="card-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>&#127760;</span>
            Chrome Eklentisi
          </span>
          <StatusDot connected={status?.chrome_connected ?? false} />
        </div>
        <div style={sectionGap}>
          {/* Stats */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <StatBadge label="Son Veri" value={formatTimestamp(status?.chrome_last_event ?? null)} />
            <StatBadge label="Bugun Kayit" value={status?.chrome_today_events ?? 0} />
          </div>

          {/* Installation Guide */}
          <div
            style={{
              background: "var(--bg-primary)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              padding: "16px 20px",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 8,
              }}
            >
              Kurulum Adimlari
            </div>

            <StepItem number={1}>
              Chrome&apos;da adres cubuguna{" "}
              <span style={codeStyle}>chrome://extensions</span>{" "}
              yazin ve Enter&apos;a basin.
            </StepItem>

            <StepItem number={2}>
              Sag ust kosede{" "}
              <strong style={{ color: "var(--text-primary)" }}>&quot;Gelistirici modu&quot;</strong>{" "}
              anahtarini aktif edin.
            </StepItem>

            <StepItem number={3}>
              Sol ustteki{" "}
              <strong style={{ color: "var(--text-primary)" }}>&quot;Paketlenmemis oge yukle&quot;</strong>{" "}
              butonuna tiklayin.
            </StepItem>

            <StepItem number={4}>
              Acilan pencerede DevPulse klasorunun icindeki{" "}
              <span style={codeStyle}>extensions/chrome</span>{" "}
              klasorunu secin.
            </StepItem>

            <StepItem number={5}>
              Eklenti yuklendi! Chrome arac cubugunda{" "}
              <strong style={{ color: "var(--accent-green)" }}>DevPulse</strong>{" "}
              ikonunu gormalisiniz.
            </StepItem>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" onClick={handleOpenChromeFolder} style={{ alignSelf: "flex-start" }}>
              Klasoru Ac
            </button>
            <button className="btn" onClick={fetchStatus} style={{ alignSelf: "flex-start" }}>
              Durumu Yenile
            </button>
          </div>

          <p style={labelStyle}>
            Chrome eklentisi acik sekmeleri, ziyaret edilen alan adlarini ve gecirilen sureyi takip eder.
            Veriler 10 saniyede bir DevPulse&apos;a gonderilir.
          </p>
        </div>
      </div>

      {/* ── VS Code Extension ── */}
      <div className="card">
        <div className="card-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>&#128187;</span>
            VS Code Eklentisi
          </span>
          <StatusDot connected={status?.vscode_connected ?? false} />
        </div>
        <div style={sectionGap}>
          {/* Stats */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <StatBadge label="Son Veri" value={formatTimestamp(status?.vscode_last_event ?? null)} />
            <StatBadge label="Bugun Kayit" value={status?.vscode_today_events ?? 0} />
          </div>

          {/* Installation Guide */}
          <div
            style={{
              background: "var(--bg-primary)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              padding: "16px 20px",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 8,
              }}
            >
              Kurulum Adimlari
            </div>

            <StepItem number={1}>
              Terminal acin (VS Code icindeki terminal de olur).
            </StepItem>

            <StepItem number={2}>
              Asagidaki komutu calistirin:
              <br />
              <span style={{ ...codeStyle, marginTop: 4 }}>
                cd extensions/vscode && npm install && npm run compile
              </span>
            </StepItem>

            <StepItem number={3}>
              VS Code Insiders&apos;da{" "}
              <span style={codeStyle}>Ctrl+Shift+P</span>{" "}
              tuslayin, sonra{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                &quot;Developer: Install Extension from Location&quot;
              </strong>{" "}
              secin.
            </StepItem>

            <StepItem number={4}>
              Acilan pencerede{" "}
              <span style={codeStyle}>extensions/vscode</span>{" "}
              klasorunu secin.
            </StepItem>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" onClick={handleOpenVscodeFolder} style={{ alignSelf: "flex-start" }}>
              Klasoru Ac
            </button>
            <button className="btn" onClick={fetchStatus} style={{ alignSelf: "flex-start" }}>
              Durumu Yenile
            </button>
          </div>

          <p style={labelStyle}>
            VS Code eklentisi aktif dosya, dil, branch, acik sekme sayisi ve debug durumunu takip eder.
            Veriler 15 saniyede bir DevPulse&apos;a gonderilir.
          </p>
        </div>
      </div>

      {/* ── Connection Info ── */}
      <div className="card">
        <div className="card-title">Baglanti Bilgisi</div>
        <div style={sectionGap}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
            Eklentiler verileri DevPulse&apos;in yerel sunucusuna gonderir:
            <br />
            <span style={codeStyle}>http://localhost:19876</span>
            <br />
            <br />
            Durum her <strong>5 saniye</strong>de otomatik olarak kontrol edilir.
            Son 30 saniye icinde veri gelmisse eklenti &quot;Bagli&quot; olarak gosterilir.
          </div>
          <p style={labelStyle}>
            Eger eklenti yuklu ama &quot;Bagli degil&quot; gosteriyorsa:
            <br />
            1. DevPulse uygulamasinin calistiginden emin olun
            <br />
            2. Eklentiyi Chrome eklentiler sayfasindan yeniden yukleyin
            <br />
            3. Tarayiciyi yeniden baslatin
          </p>
        </div>
      </div>
    </div>
  );
}
