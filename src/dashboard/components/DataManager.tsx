import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DatabaseInfo {
  path: string;
  size_bytes: number;
  last_modified: string;
  activity_count: number;
  project_count: number;
  git_event_count: number;
}

interface BackupEntry {
  filename: string;
  path: string;
  size_bytes: number;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-muted)",
  lineHeight: 1.6,
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DataManager() {
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [resetConfirm, setResetConfirm] = useState(0); // 0=none, 1=first, 2=confirmed
  const [exporting, setExporting] = useState(false);

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchInfo = async () => {
    try {
      const info = await invoke<DatabaseInfo>("get_database_info");
      setDbInfo(info);
    } catch (err) {
      console.error("DB bilgisi alinamadi:", err);
    }

    try {
      const list = await invoke<BackupEntry[]>("get_backup_list");
      setBackups(list);
    } catch {
      // backup list may not exist yet
    }
  };

  useEffect(() => {
    fetchInfo();
  }, []);

  /* -- Actions ------------------------------------------------------- */

  const handleBackup = async () => {
    setLoading(true);
    try {
      const path = await invoke<string>("backup_database");
      showMessage(`Yedekleme tamamlandi: ${path}`, "success");
      await fetchInfo();
    } catch (err) {
      showMessage(`Yedekleme hatasi: ${err}`, "error");
    }
    setLoading(false);
  };

  const handleRestore = async (backupPath: string) => {
    setLoading(true);
    try {
      await invoke("restore_database", { backupPath });
      showMessage("Veritabani geri yuklendi. Uygulamayi yeniden baslatmaniz onerilir.", "success");
      await fetchInfo();
    } catch (err) {
      showMessage(`Geri yukleme hatasi: ${err}`, "error");
    }
    setLoading(false);
  };

  const handleReset = async () => {
    if (resetConfirm < 2) {
      setResetConfirm(resetConfirm + 1);
      if (resetConfirm === 0) {
        setTimeout(() => setResetConfirm(0), 5000);
      }
      return;
    }

    setLoading(true);
    try {
      await invoke("reset_database");
      showMessage("Tum veriler silindi.", "success");
      setResetConfirm(0);
      await fetchInfo();
    } catch (err) {
      showMessage(`Sifirlama hatasi: ${err}`, "error");
    }
    setLoading(false);
  };

  const handleExportJson = async () => {
    setExporting(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const result = await invoke<string>("export_data_json", {
        dateFrom: "2020-01-01",
        dateTo: today,
      });
      showMessage(`JSON verisi olusturuldu (${formatBytes(result.length)} boyut)`, "success");
    } catch (err) {
      showMessage(`Export hatasi: ${err}`, "error");
    }
    setExporting(false);
  };

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div>
      <div className="card-title" style={{ marginBottom: 16 }}>Veri Yonetimi</div>

      {/* Message banner */}
      {message && (
        <div
          style={{
            padding: "10px 16px",
            marginBottom: 16,
            borderRadius: "var(--radius)",
            fontSize: 13,
            fontWeight: 500,
            background: message.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${message.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: message.type === "success" ? "var(--accent-green)" : "var(--accent-red)",
          }}
        >
          {message.text}
        </div>
      )}

      {/* Database Info */}
      {dbInfo && (
        <div
          style={{
            padding: 16,
            background: "var(--bg-secondary)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            marginBottom: 16,
            fontSize: 13,
            lineHeight: 2,
          }}
        >
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
            Veritabani Bilgileri
          </div>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Konum:</span>{" "}
            <span className="mono" style={{ fontSize: 11, color: "var(--text-secondary)" }}>{dbInfo.path}</span>
          </div>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Boyut:</span>{" "}
            <span style={{ color: "var(--accent-blue)", fontWeight: 600 }}>{formatBytes(dbInfo.size_bytes)}</span>
          </div>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Son degisiklik:</span>{" "}
            <span style={{ color: "var(--text-primary)" }}>{dbInfo.last_modified}</span>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
            <span>
              <span style={{ color: "var(--text-muted)" }}>Aktiviteler:</span>{" "}
              <span style={{ fontWeight: 600 }}>{dbInfo.activity_count.toLocaleString()}</span>
            </span>
            <span>
              <span style={{ color: "var(--text-muted)" }}>Projeler:</span>{" "}
              <span style={{ fontWeight: 600 }}>{dbInfo.project_count}</span>
            </span>
            <span>
              <span style={{ color: "var(--text-muted)" }}>Git olaylari:</span>{" "}
              <span style={{ fontWeight: 600 }}>{dbInfo.git_event_count.toLocaleString()}</span>
            </span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={handleBackup} disabled={loading} style={{ fontSize: 13 }}>
          {loading ? "Isleniyor..." : "Veriyi Yedekle"}
        </button>
        <button className="btn" onClick={handleExportJson} disabled={exporting} style={{ fontSize: 13 }}>
          {exporting ? "Export ediliyor..." : "JSON Export"}
        </button>
      </div>

      {/* Previous Backups */}
      {backups.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            Mevcut Yedekler
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {backups.slice(0, 5).map((backup, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "var(--bg-secondary)",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  fontSize: 12,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span className="mono" style={{ color: "var(--text-primary)", fontSize: 12 }}>
                    {backup.filename}
                  </span>
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                    {backup.created_at} &middot; {formatBytes(backup.size_bytes)}
                  </span>
                </div>
                <button
                  className="btn"
                  onClick={() => handleRestore(backup.path)}
                  disabled={loading}
                  style={{ fontSize: 11, padding: "6px 12px" }}
                >
                  Geri Yukle
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reset Section */}
      <div
        style={{
          padding: 16,
          background: "rgba(239,68,68,0.05)",
          borderRadius: "var(--radius)",
          border: "1px solid rgba(239,68,68,0.15)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-red)", marginBottom: 8 }}>
          Tehlikeli Bolge
        </div>
        <p style={{ ...labelStyle, marginBottom: 12 }}>
          Tum verileri sifirlar. Bu islem geri alinamaz. Oncesinde yedek almaniz onerili.
        </p>
        <button
          className="btn"
          onClick={handleReset}
          disabled={loading}
          style={{
            borderColor: "var(--accent-red)",
            color: "var(--accent-red)",
            fontSize: 12,
            background: resetConfirm > 0 ? "rgba(239,68,68,0.1)" : undefined,
          }}
        >
          {resetConfirm === 0 && "Veriyi Sifirla"}
          {resetConfirm === 1 && "Emin misiniz? Tekrar tiklayin..."}
          {resetConfirm === 2 && "Son onay - Tum veriyi sil!"}
        </button>
      </div>
    </div>
  );
}
