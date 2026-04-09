import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

/* ------------------------------------------------------------------ */
/*  Widget Definitions                                                 */
/* ------------------------------------------------------------------ */

export interface WidgetConfig {
  id: string;
  name: string;
  description: string;
  defaultEnabled: boolean;
  columns: 1 | 2; // how many grid columns it spans
}

export const AVAILABLE_WIDGETS: WidgetConfig[] = [
  {
    id: "productivity-gauge",
    name: "Verimlilik Gostergesi",
    description: "Gunluk verimlilik yuzdesini gorsellestiren dairesel gosterge",
    defaultEnabled: true,
    columns: 1,
  },
  {
    id: "time-distribution",
    name: "Zaman Dagilimi",
    description: "Uretken, dikkat dagitici ve notr zaman dagilimini gosteren bar",
    defaultEnabled: true,
    columns: 2,
  },
  {
    id: "recent-activity",
    name: "Son Aktiviteler",
    description: "En son yapilan aktivitelerin akis listesi",
    defaultEnabled: true,
    columns: 1,
  },
  {
    id: "work-session",
    name: "Calisma Oturumu",
    description: "Mevcut calisma oturumu suresi ve detaylari",
    defaultEnabled: true,
    columns: 1,
  },
  {
    id: "daily-goals",
    name: "Gunluk Hedefler",
    description: "Belirlenen gunluk hedeflerin ilerleme durumu",
    defaultEnabled: true,
    columns: 2,
  },
  {
    id: "quick-stats",
    name: "Hizli Istatistikler",
    description: "Commit, sure ve verimlilik ozet kartlari",
    defaultEnabled: true,
    columns: 2,
  },
  {
    id: "smart-suggestions",
    name: "Akilli Oneriler",
    description: "Verimlilige dayali otomatik oneriler ve ipuclari",
    defaultEnabled: false,
    columns: 1,
  },
  {
    id: "next-up",
    name: "Siradaki",
    description: "Takvime gore siradaki planli calisma blogu",
    defaultEnabled: false,
    columns: 1,
  },
];

/* ------------------------------------------------------------------ */
/*  Hook: useWidgetPreferences                                         */
/* ------------------------------------------------------------------ */

export function useWidgetPreferences() {
  const [enabledWidgets, setEnabledWidgets] = useState<Set<string>>(
    new Set(AVAILABLE_WIDGETS.filter((w) => w.defaultEnabled).map((w) => w.id))
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    invoke<string | null>("get_setting", { key: "widget_preferences" })
      .then((saved) => {
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as string[];
            setEnabledWidgets(new Set(parsed));
          } catch {
            // fallback to defaults
          }
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const savePreferences = async (widgets: Set<string>) => {
    setEnabledWidgets(widgets);
    try {
      await invoke("save_setting", {
        key: "widget_preferences",
        value: JSON.stringify(Array.from(widgets)),
      });
    } catch (err) {
      console.error("Widget tercihleri kaydedilemedi:", err);
    }
  };

  return { enabledWidgets, savePreferences, loaded };
}

/* ------------------------------------------------------------------ */
/*  WidgetGrid Component (settings panel)                              */
/* ------------------------------------------------------------------ */

export default function WidgetGrid() {
  const { enabledWidgets, savePreferences, loaded } = useWidgetPreferences();

  const toggleWidget = (widgetId: string) => {
    const next = new Set(enabledWidgets);
    if (next.has(widgetId)) {
      next.delete(widgetId);
    } else {
      next.add(widgetId);
    }
    savePreferences(next);
  };

  const enableAll = () => {
    savePreferences(new Set(AVAILABLE_WIDGETS.map((w) => w.id)));
  };

  const disableAll = () => {
    savePreferences(new Set());
  };

  if (!loaded) return null;

  const enabledCount = enabledWidgets.size;
  const totalCount = AVAILABLE_WIDGETS.length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div className="card-title" style={{ marginBottom: 4 }}>Dashboard Widgetlari</div>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {enabledCount}/{totalCount} widget aktif
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn"
            onClick={enableAll}
            style={{ fontSize: 11, padding: "6px 12px" }}
          >
            Tumu Ac
          </button>
          <button
            className="btn"
            onClick={disableAll}
            style={{ fontSize: 11, padding: "6px 12px" }}
          >
            Tumu Kapat
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {AVAILABLE_WIDGETS.map((widget) => {
          const isEnabled = enabledWidgets.has(widget.id);

          return (
            <button
              key={widget.id}
              onClick={() => toggleWidget(widget.id)}
              style={{
                padding: 14,
                borderRadius: "var(--radius)",
                border: `1px solid ${isEnabled ? "var(--accent-green)" : "var(--border)"}`,
                background: isEnabled ? "rgba(34,197,94,0.06)" : "var(--bg-secondary)",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s",
                gridColumn: widget.columns === 2 ? "span 2" : undefined,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: isEnabled ? "var(--text-primary)" : "var(--text-secondary)" }}>
                  {widget.name}
                </span>
                {/* Toggle indicator */}
                <span
                  style={{
                    width: 32,
                    height: 18,
                    borderRadius: 9,
                    background: isEnabled ? "var(--accent-green)" : "var(--text-muted)",
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
                      left: isEnabled ? 16 : 2,
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: "#fff",
                      transition: "left 0.2s",
                    }}
                  />
                </span>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
                {widget.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
