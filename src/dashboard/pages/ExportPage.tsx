import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

function getDefaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return { from, to };
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ExportPage() {
  const defaults = getDefaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [reportDate, setReportDate] = useState(todayStr());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const clearMessages = () => {
    setMessage(null);
    setError(null);
  };

  const handleExportCSV = async () => {
    clearMessages();
    setLoading(true);
    try {
      const path = await invoke<string>("export_data_csv", {
        dateFrom,
        dateTo,
      });
      setMessage(`CSV dosyasi olusturuldu: ${path}`);
    } catch (err) {
      setError(`Hata: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportJSON = async () => {
    clearMessages();
    setLoading(true);
    try {
      const path = await invoke<string>("export_data_json", {
        dateFrom,
        dateTo,
      });
      setMessage(`JSON dosyasi olusturuldu: ${path}`);
    } catch (err) {
      setError(`Hata: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setReport(null);
    clearMessages();
    setLoading(true);
    try {
      const md = await invoke<string>("generate_daily_report", {
        date: reportDate,
      });
      setReport(md);
    } catch (err) {
      setError(`Hata: ${err}`);
    } finally {
      setLoading(false);
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
  };

  return (
    <div>
      <h1 className="page-title">Veri Aktarimi</h1>

      {/* Date Range Export */}
      <div className="card">
        <div className="card-title">Tarih Araligina Gore Aktar</div>

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <label style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Baslangic:
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={inputStyle}
          />
          <label style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Bitis:
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button
            className="btn btn-primary"
            onClick={handleExportCSV}
            disabled={loading}
          >
            CSV Olarak Indir
          </button>
          <button
            className="btn btn-primary"
            onClick={handleExportJSON}
            disabled={loading}
          >
            JSON Olarak Indir
          </button>
        </div>
      </div>

      {/* Success / Error Messages */}
      {message && (
        <div
          className="card"
          style={{
            borderLeft: "3px solid var(--accent-green)",
          }}
        >
          <div
            style={{
              color: "var(--accent-green)",
              fontSize: 13,
              wordBreak: "break-all",
            }}
          >
            {message}
          </div>
        </div>
      )}

      {error && (
        <div
          className="card"
          style={{
            borderLeft: "3px solid var(--accent-red)",
          }}
        >
          <div style={{ color: "var(--accent-red)", fontSize: 13 }}>
            {error}
          </div>
        </div>
      )}

      {/* Daily Report */}
      <div className="card">
        <div className="card-title">Gunluk Rapor</div>

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <label style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Tarih:
          </label>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            style={inputStyle}
          />
          <button
            className="btn btn-primary"
            onClick={handleGenerateReport}
            disabled={loading}
          >
            Rapor Olustur
          </button>
        </div>
      </div>

      {/* Report Output */}
      {report && (
        <div className="card">
          <div className="card-title">Rapor Onizleme</div>
          <pre
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: 16,
              fontSize: 13,
              fontFamily: "var(--font-mono)",
              color: "var(--text-primary)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              lineHeight: 1.6,
              maxHeight: 500,
              overflow: "auto",
            }}
          >
            {report}
          </pre>
        </div>
      )}
    </div>
  );
}
