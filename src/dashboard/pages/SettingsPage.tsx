import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type TrackingStatus = "active" | "paused" | "idle";
type AppCategory = "productive" | "distracting" | "neutral";

interface AppCategoryEntry {
  name: string;
  displayName: string;
  category: AppCategory;
}

const DEFAULT_APP_CATEGORIES: AppCategoryEntry[] = [
  { name: "Code - Insiders", displayName: "VS Code Insiders", category: "productive" },
  { name: "WindowsTerminal.exe", displayName: "Windows Terminal", category: "productive" },
  { name: "devenv.exe", displayName: "Visual Studio", category: "productive" },
  { name: "idea64.exe", displayName: "IntelliJ IDEA", category: "productive" },
  { name: "chrome.exe", displayName: "Google Chrome", category: "neutral" },
  { name: "firefox.exe", displayName: "Firefox", category: "neutral" },
  { name: "msedge.exe", displayName: "Microsoft Edge", category: "neutral" },
  { name: "explorer.exe", displayName: "File Explorer", category: "neutral" },
  { name: "discord.exe", displayName: "Discord", category: "distracting" },
  { name: "Spotify.exe", displayName: "Spotify", category: "distracting" },
  { name: "Telegram.exe", displayName: "Telegram", category: "distracting" },
  { name: "WhatsApp.exe", displayName: "WhatsApp", category: "distracting" },
];

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--text-primary)",
  fontSize: 13,
};

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

function CategoryBadge({ category }: { category: AppCategory }) {
  const colors: Record<AppCategory, { bg: string; text: string; label: string }> = {
    productive: { bg: "rgba(34,197,94,0.15)", text: "var(--accent-green)", label: "Uretken" },
    distracting: { bg: "rgba(239,68,68,0.15)", text: "var(--accent-red)", label: "Dikkat Dagitici" },
    neutral: { bg: "rgba(107,114,128,0.15)", text: "var(--text-secondary)", label: "Notr" },
  };
  const c = colors[category];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        background: c.bg,
        color: c.text,
        letterSpacing: 0.3,
      }}
    >
      {c.label}
    </span>
  );
}

function ToggleButton({
  active,
  onClick,
  labelOn,
  labelOff,
}: {
  active: boolean;
  onClick: () => void;
  labelOn: string;
  labelOff: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 18px",
        border: `1px solid ${active ? "var(--accent-green)" : "var(--border)"}`,
        borderRadius: "var(--radius)",
        background: active ? "rgba(34,197,94,0.1)" : "var(--bg-secondary)",
        color: active ? "var(--accent-green)" : "var(--text-secondary)",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.2s",
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
      {active ? labelOn : labelOff}
    </button>
  );
}

export default function SettingsPage() {
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>("active");
  const [idleThreshold, setIdleThreshold] = useState("120");
  const [saved, setSaved] = useState(false);
  const [autostart, setAutostart] = useState(false);
  const [autostartError, setAutostartError] = useState(false);
  const [minibarPosition, setMinibarPosition] = useState<"top" | "bottom">("top");
  const [appCategories] = useState<AppCategoryEntry[]>(DEFAULT_APP_CATEGORIES);

  // App version (dynamic from Tauri)
  const [appVersion, setAppVersion] = useState("...");

  // Updater state
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState<{ version: string; body: string } | null>(null);
  const [updateProgress, setUpdateProgress] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const handleCheckUpdate = async () => {
    setUpdateChecking(true);
    setUpdateError(null);
    setUpdateAvailable(null);
    try {
      const update = await check();
      if (update) {
        setUpdateAvailable({ version: update.version, body: update.body || "" });
      } else {
        setUpdateError("En son surum kullaniliyor.");
      }
    } catch (e) {
      setUpdateError("Guncelleme kontrol edilemedi: " + String(e));
    }
    setUpdateChecking(false);
  };

  const handleInstallUpdate = async () => {
    try {
      setUpdateProgress("Guncelleme indiriliyor...");
      const update = await check();
      if (update) {
        let downloaded = 0;
        let contentLength = 0;
        await update.downloadAndInstall((event) => {
          if (event.event === "Started" && event.data.contentLength) {
            contentLength = event.data.contentLength;
          } else if (event.event === "Progress") {
            downloaded += event.data.chunkLength;
            const pct = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0;
            setUpdateProgress(`Indiriliyor... %${pct}`);
          } else if (event.event === "Finished") {
            setUpdateProgress("Kuruluyor... Uygulama yeniden baslatilacak.");
          }
        });
        await relaunch();
      }
    } catch (e) {
      setUpdateError("Guncelleme kurulamadi: " + String(e));
      setUpdateProgress(null);
    }
  };

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion("0.5.0"));
    invoke<string>("get_tracking_status")
      .then((status) => {
        if (status === "paused" || status === "idle" || status === "active") {
          setTrackingStatus(status as TrackingStatus);
        }
      })
      .catch(() => { /* ignore */ });
  }, []);

  const handlePause = async () => {
    try {
      await invoke("pause_tracking");
      setTrackingStatus("paused");
    } catch {
      /* backend may not support yet */
    }
  };

  const handleResume = async () => {
    try {
      await invoke("resume_tracking");
      setTrackingStatus("active");
    } catch {
      /* backend may not support yet */
    }
  };

  const handleSaveIdleThreshold = async () => {
    try {
      await invoke("set_idle_threshold", { seconds: parseInt(idleThreshold, 10) });
    } catch {
      /* command may not exist yet */
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleToggleAutostart = async () => {
    try {
      const next = !autostart;
      await invoke("set_autostart", { enabled: next });
      setAutostart(next);
      setAutostartError(false);
    } catch {
      setAutostartError(true);
    }
  };

  const handleOpenDataFolder = async () => {
    try {
      await invoke("open_data_folder");
    } catch {
      /* fallback: do nothing */
    }
  };

  const statusLabel: Record<TrackingStatus, string> = {
    active: "Aktif",
    paused: "Durduruldu",
    idle: "Bosta",
  };

  const statusColor: Record<TrackingStatus, string> = {
    active: "var(--accent-green)",
    paused: "var(--accent-yellow)",
    idle: "var(--text-muted)",
  };

  const statusDotClass: Record<TrackingStatus, string> = {
    active: "active",
    paused: "paused",
    idle: "idle",
  };

  return (
    <div>
      <h1 className="page-title">Ayarlar</h1>

      {/* ── Tracking Control ── */}
      <div className="card">
        <div className="card-title">Takip Kontrolu</div>
        <div style={sectionGap}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <span className={`status-dot ${statusDotClass[trackingStatus]}`} />
            <span style={{ fontSize: 14, fontWeight: 600, color: statusColor[trackingStatus] }}>
              {statusLabel[trackingStatus]}
            </span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {trackingStatus === "active" ? (
              <button
                className="btn"
                onClick={handlePause}
                style={{
                  borderColor: "var(--accent-yellow)",
                  color: "var(--accent-yellow)",
                }}
              >
                Takibi Duraklat
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleResume}>
                Takibe Devam Et
              </button>
            )}
          </div>
          <p style={labelStyle}>
            Takibi duraklattiginizda uygulama ve zaman kaydi yapilmaz. Devam ettiginizde kayit
            kaldigi yerden devam eder.
          </p>
        </div>
      </div>

      {/* ── Idle Threshold ── */}
      <div className="card">
        <div className="card-title">Bosta Kalma Esigi</div>
        <div style={sectionGap}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="number"
              min={30}
              max={3600}
              value={idleThreshold}
              onChange={(e) => setIdleThreshold(e.target.value)}
              style={{ ...inputStyle, width: 100 }}
            />
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>saniye</span>
            <button
              className="btn btn-primary"
              onClick={handleSaveIdleThreshold}
              style={{
                minWidth: 100,
                background: saved ? "var(--accent-green)" : undefined,
                borderColor: saved ? "var(--accent-green)" : undefined,
                transition: "all 0.2s",
              }}
            >
              {saved ? "Kaydedildi!" : "Kaydet"}
            </button>
          </div>
          <p style={labelStyle}>
            Klavye veya fare kullanilmadan gecen sure esigini belirler. Bu sure asildiktan sonra
            durum otomatik olarak "Bosta" olarak isaretlenir.
            <br />
            Varsayilan: 120 saniye (2 dakika). Onerilen aralik: 60 - 600 saniye.
          </p>
        </div>
      </div>

      {/* ── Application Categories ── */}
      <div className="card">
        <div className="card-title">Uygulama Kategorileri</div>
        <div style={sectionGap}>
          <div
            style={{
              borderRadius: "var(--radius)",
              overflow: "hidden",
              border: "1px solid var(--border)",
            }}
          >
            {/* Table header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 140px 160px",
                padding: "10px 14px",
                background: "var(--bg-primary)",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              <span>Uygulama</span>
              <span>Goruntu Adi</span>
              <span>Kategori</span>
            </div>
            {/* Table rows */}
            {appCategories.map((app, i) => (
              <div
                key={app.name}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 140px 160px",
                  alignItems: "center",
                  padding: "10px 14px",
                  fontSize: 13,
                  background: i % 2 === 0 ? "var(--bg-secondary)" : "var(--bg-card)",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    color: "var(--text-primary)",
                  }}
                >
                  {app.name}
                </span>
                <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                  {app.displayName}
                </span>
                <CategoryBadge category={app.category} />
              </div>
            ))}
          </div>
          <p style={labelStyle}>
            Yeni uygulamalar otomatik olarak algilanir ve "Notr" kategorisine eklenir.
            <br />
            Tarayicilar (chrome.exe, msedge.exe) icin kategori ziyaret edilen siteye gore
            degisebilir.
          </p>
        </div>
      </div>

      {/* ── Autostart ── */}
      <div className="card">
        <div className="card-title">Otomatik Baslatma</div>
        <div style={sectionGap}>
          <ToggleButton
            active={autostart}
            onClick={handleToggleAutostart}
            labelOn="Windows ile birlikte baslar"
            labelOff="Otomatik baslatma kapali"
          />
          {autostartError && (
            <p style={{ ...labelStyle, color: "var(--accent-yellow)" }}>
              Otomatik baslatma komutu bulunamadi. Manuel olarak ayarlamak icin:
              <br />
              <code
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  background: "var(--bg-primary)",
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                Win+R &rarr; shell:startup
              </code>{" "}
              klasorune uygulamanin kisayolunu ekleyin.
            </p>
          )}
          <p style={labelStyle}>
            Etkinlestirildiginde DevPulse, Windows acildiginda otomatik olarak arka planda
            baslatilir.
          </p>
        </div>
      </div>

      {/* ── MiniBar Position ── */}
      <div className="card">
        <div className="card-title">MiniBar Konumu</div>
        <div style={sectionGap}>
          <div style={{ display: "flex", gap: 10 }}>
            {(["top", "bottom"] as const).map((pos) => (
              <label
                key={pos}
                onClick={() => setMinibarPosition(pos)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 18px",
                  borderRadius: "var(--radius)",
                  border: `1px solid ${minibarPosition === pos ? "var(--accent-blue)" : "var(--border)"}`,
                  background:
                    minibarPosition === pos ? "rgba(59,130,246,0.1)" : "var(--bg-secondary)",
                  color:
                    minibarPosition === pos ? "var(--accent-blue)" : "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  transition: "all 0.2s",
                }}
              >
                <input
                  type="radio"
                  name="minibar-pos"
                  checked={minibarPosition === pos}
                  onChange={() => setMinibarPosition(pos)}
                  style={{ display: "none" }}
                />
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    border: `2px solid ${minibarPosition === pos ? "var(--accent-blue)" : "var(--text-muted)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {minibarPosition === pos && (
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "var(--accent-blue)",
                      }}
                    />
                  )}
                </span>
                {pos === "top" ? "Ust" : "Alt"}
              </label>
            ))}
          </div>
          <p style={labelStyle}>
            MiniBar, ekranin ustunde veya altinda kucuk bir bilgi cubugu olarak gorunur.
            <br />
            Aktif uygulamayi, gecen sureyi ve verimlilik durumunu anlık olarak gosterir.
          </p>
        </div>
      </div>

      {/* ── Update ── */}
      <div className="card">
        <div className="card-title">Guncelleme</div>
        <div style={sectionGap}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Mevcut surum: <strong style={{ color: "var(--accent-blue)" }}>v{appVersion}</strong>
            </span>
            <button
              className="btn btn-primary"
              onClick={handleCheckUpdate}
              disabled={updateChecking}
              style={{ fontSize: 12 }}
            >
              {updateChecking ? "Kontrol ediliyor..." : "Guncelleme Kontrol Et"}
            </button>
          </div>

          {updateAvailable && (
            <div style={{
              padding: 14,
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.2)",
              borderRadius: "var(--radius)",
            }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--accent-green)", marginBottom: 6 }}>
                Yeni surum mevcut: v{updateAvailable.version}
              </div>
              {updateAvailable.body && (
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10, lineHeight: 1.6 }}>
                  {updateAvailable.body}
                </div>
              )}
              <button className="btn btn-primary" onClick={handleInstallUpdate}>
                Simdi Guncelle
              </button>
            </div>
          )}

          {updateProgress && (
            <div style={{
              padding: 12,
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.2)",
              borderRadius: "var(--radius)",
              fontSize: 13,
              color: "var(--accent-blue)",
              fontWeight: 500,
            }}>
              {updateProgress}
            </div>
          )}

          {updateError && (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {updateError}
            </div>
          )}
        </div>
      </div>

      {/* ── About ── */}
      <div className="card">
        <div className="card-title">Uygulama Hakkinda</div>
        <div style={sectionGap}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.9 }}>
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "var(--accent-blue)",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              YGT Labs AI DevPulse
            </span>
            <br />
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Versiyon</span>{" "}
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                color: "var(--text-primary)",
              }}
            >
              {appVersion}
            </span>
            <br />
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Teknoloji</span>{" "}
            Tauri v2 + React + Rust
            <br />
            <br />
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: "var(--radius)",
                background: "rgba(34,197,94,0.1)",
                color: "var(--accent-green)",
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              <span style={{ fontSize: 14 }}>&#128274;</span>
              Tum veriler yerel olarak saklanir, bulut baglantisi yoktur.
            </span>
          </div>
          <button
            className="btn"
            onClick={handleOpenDataFolder}
            style={{ alignSelf: "flex-start", marginTop: 4 }}
          >
            Veri Klasorunu Ac
          </button>
        </div>
      </div>
    </div>
  );
}
