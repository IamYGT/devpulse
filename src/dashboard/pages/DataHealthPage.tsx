import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface IntegrityIssue {
  severity: string;
  table: string;
  description: string;
  affected_rows: number;
  fixable: boolean;
}

interface DataIntegrityReport {
  total_records: number;
  orphaned_activity_logs: number;
  duplicate_entries: number;
  invalid_timestamps: number;
  zero_duration_entries: number;
  database_size_mb: number;
  issues: IntegrityIssue[];
}

const severityColors: Record<string, { bg: string; text: string; label: string }> = {
  low: { bg: "rgba(34,197,94,0.15)", text: "var(--accent-green)", label: "Dusuk" },
  medium: { bg: "rgba(234,179,8,0.15)", text: "#eab308", label: "Orta" },
  high: { bg: "rgba(239,68,68,0.15)", text: "var(--accent-red)", label: "Yuksek" },
};

function SeverityBadge({ severity }: { severity: string }) {
  const c = severityColors[severity] || severityColors.low;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: c.bg,
        color: c.text,
      }}
    >
      {c.label}
    </span>
  );
}

export default function DataHealthPage() {
  const [report, setReport] = useState<DataIntegrityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [fixLoading, setFixLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cleanupDays, setCleanupDays] = useState(90);

  const clearMessages = () => {
    setMessage(null);
    setError(null);
  };

  const handleCheck = async () => {
    clearMessages();
    setLoading(true);
    try {
      const data = await invoke<DataIntegrityReport>("check_data_integrity");
      setReport(data);
    } catch (err) {
      setError(`Kontrol hatasi: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFix = async () => {
    clearMessages();
    setFixLoading(true);
    try {
      const fixed = await invoke<number>("fix_data_integrity");
      setMessage(`${fixed} kayit duzeltildi. Tekrar kontrol ediniz.`);
      // Re-check after fix
      const data = await invoke<DataIntegrityReport>("check_data_integrity");
      setReport(data);
    } catch (err) {
      setError(`Duzeltme hatasi: ${err}`);
    } finally {
      setFixLoading(false);
    }
  };

  const handleCleanup = async () => {
    clearMessages();
    setCleanupLoading(true);
    try {
      const deleted = await invoke<number>("cleanup_old_data", { days: cleanupDays });
      setMessage(`${deleted} eski kayit temizlendi.`);
      // Re-check after cleanup
      const data = await invoke<DataIntegrityReport>("check_data_integrity");
      setReport(data);
    } catch (err) {
      setError(`Temizlik hatasi: ${err}`);
    } finally {
      setCleanupLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    color: "var(--text-primary)",
    padding: "8px 12px",
    fontFamily: "var(--font-mono)",
    fontSize: 14,
    outline: "none",
    width: 80,
  };

  const statBoxStyle: React.CSSProperties = {
    background: "var(--bg-secondary)",
    borderRadius: "var(--radius)",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 140,
  };

  const statValue: React.CSSProperties = {
    fontSize: 24,
    fontWeight: 700,
    fontFamily: "var(--font-mono)",
    color: "var(--text-primary)",
  };

  const statLabel: React.CSSProperties = {
    fontSize: 11,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  };

  const hasFixableIssues = report?.issues.some((i) => i.fixable) ?? false;

  return (
    <div>
      <h1 className="page-title">Veri Sagligi</h1>

      {/* Check Button */}
      <div className="card">
        <div className="card-title">Veritabani Butunluk Kontrolu</div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
          Veritabanindaki tutarsizliklari, yetim kayitlari ve gecersiz verileri tespit eder.
        </p>
        <button
          className="btn btn-primary"
          onClick={handleCheck}
          disabled={loading}
        >
          {loading ? "Kontrol ediliyor..." : "Kontrol Baslat"}
        </button>
      </div>

      {/* Messages */}
      {message && (
        <div
          style={{
            background: "rgba(34,197,94,0.1)",
            border: "1px solid rgba(34,197,94,0.3)",
            borderRadius: "var(--radius)",
            padding: "12px 16px",
            marginTop: 16,
            color: "var(--accent-green)",
            fontSize: 13,
          }}
        >
          {message}
        </div>
      )}
      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "var(--radius)",
            padding: "12px 16px",
            marginTop: 16,
            color: "var(--accent-red)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Report */}
      {report && (
        <>
          {/* Stats */}
          <div
            className="card"
            style={{ marginTop: 16 }}
          >
            <div className="card-title">Genel Bakis</div>
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={statBoxStyle}>
                <span style={statLabel}>Toplam Kayit</span>
                <span style={statValue}>{report.total_records.toLocaleString("tr-TR")}</span>
              </div>
              <div style={statBoxStyle}>
                <span style={statLabel}>DB Boyutu</span>
                <span style={statValue}>{report.database_size_mb.toFixed(2)} MB</span>
              </div>
              <div style={statBoxStyle}>
                <span style={statLabel}>Sorun Sayisi</span>
                <span
                  style={{
                    ...statValue,
                    color: report.issues.length > 0 ? "var(--accent-red)" : "var(--accent-green)",
                  }}
                >
                  {report.issues.length}
                </span>
              </div>
              <div style={statBoxStyle}>
                <span style={statLabel}>Yetim Kayit</span>
                <span style={statValue}>{report.orphaned_activity_logs}</span>
              </div>
              <div style={statBoxStyle}>
                <span style={statLabel}>Tekrar Kayit</span>
                <span style={statValue}>{report.duplicate_entries}</span>
              </div>
              <div style={statBoxStyle}>
                <span style={statLabel}>Sifir Sureli</span>
                <span style={statValue}>{report.zero_duration_entries}</span>
              </div>
            </div>
          </div>

          {/* Issues */}
          {report.issues.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <div className="card-title" style={{ margin: 0 }}>
                  Tespit Edilen Sorunlar
                </div>
                {hasFixableIssues && (
                  <button
                    className="btn btn-primary"
                    onClick={handleFix}
                    disabled={fixLoading}
                    style={{ fontSize: 12 }}
                  >
                    {fixLoading ? "Duzeltiliyor..." : "Sorunlari Duzelt"}
                  </button>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {report.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      padding: "12px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <SeverityBadge severity={issue.severity} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                        {issue.description}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                        Tablo: {issue.table} | Etkilenen: {issue.affected_rows} kayit
                        {issue.fixable && " | Otomatik duzeltme mumkun"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.issues.length === 0 && (
            <div
              className="card"
              style={{
                marginTop: 16,
                textAlign: "center",
                padding: "32px 16px",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>&#10003;</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--accent-green)" }}>
                Veritabani Saglikli
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                Herhangi bir tutarsizlik veya sorun bulunamadi.
              </div>
            </div>
          )}
        </>
      )}

      {/* Cleanup Section */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Eski Veriyi Temizle</div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
          Belirtilen gun sayisindan eski aktivite kayitlarini siler. Minimum 30 gun korunur.
        </p>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Eski kayitlari sil:
          </label>
          <input
            type="number"
            value={cleanupDays}
            onChange={(e) => setCleanupDays(Math.max(30, parseInt(e.target.value) || 30))}
            min={30}
            max={365}
            style={inputStyle}
          />
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>gunden eski</span>
          <button
            className="btn btn-primary"
            onClick={handleCleanup}
            disabled={cleanupLoading}
            style={{ marginLeft: 8 }}
          >
            {cleanupLoading ? "Temizleniyor..." : "Temizle"}
          </button>
        </div>
      </div>
    </div>
  );
}
