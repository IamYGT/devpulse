import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import ActivityLogTable from "../components/ActivityLogTable";

interface TimelineEntry {
  timestamp: string;
  duration_seconds: number;
  process_name: string;
  window_title: string;
  project_name: string | null;
  category: string;
  is_idle: boolean;
}

interface BrowserTab {
  id: number;
  timestamp: string;
  url: string | null;
  domain: string | null;
  title: string | null;
  duration_seconds: number;
  category: string;
}

interface AppUsage {
  name: string;
  seconds: number;
  category: string;
}

interface DomainUsage {
  domain: string;
  seconds: number;
  category: string;
}

const categoryBarColor = (category: string): string => {
  switch (category) {
    case "productive":
      return "var(--accent-green)";
    case "distracting":
      return "var(--accent-red)";
    default:
      return "var(--text-muted)";
  }
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}sn`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}dk`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}s ${rm}dk` : `${h}s`;
}

function HorizontalBarChart({
  items,
  maxSeconds,
  labelKey,
}: {
  items: { label: string; seconds: number; category: string }[];
  maxSeconds: number;
  labelKey: string;
}) {
  if (items.length === 0) {
    return (
      <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "16px 0" }}>
        {labelKey === "app" ? "Uygulama verisi yok" : "Domain verisi yok"}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((item, idx) => {
        const pct = maxSeconds > 0 ? (item.seconds / maxSeconds) * 100 : 0;
        return (
          <div
            key={`${item.label}-${idx}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--text-primary)",
                width: 140,
                flexShrink: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={item.label}
            >
              {item.label}
            </span>
            <div
              style={{
                flex: 1,
                height: 18,
                background: "var(--bg-primary)",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.max(pct, 1)}%`,
                  height: "100%",
                  background: categoryBarColor(item.category),
                  borderRadius: 4,
                  transition: "width 0.4s ease",
                  opacity: 0.85,
                }}
              />
            </div>
            <span
              style={{
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                color: "var(--text-secondary)",
                width: 60,
                textAlign: "right",
                flexShrink: 0,
              }}
            >
              {formatDuration(item.seconds)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ActivityPage() {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [browserTabs, setBrowserTabs] = useState<BrowserTab[]>([]);
  const [hasBrowserData, setHasBrowserData] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const tl = await invoke<TimelineEntry[]>("get_today_timeline");
        setTimeline(tl);
      } catch (err) {
        console.error("Failed to load timeline:", err);
      }

      try {
        const today = new Date().toISOString().slice(0, 10);
        const tabs = await invoke<BrowserTab[]>("get_browser_history", { date: today });
        setBrowserTabs(tabs);
        setHasBrowserData(tabs.length > 0);
      } catch {
        setHasBrowserData(false);
      }
    }
    load();
  }, []);

  // Aggregate app usage
  const appUsage = useMemo((): AppUsage[] => {
    const map = new Map<string, { seconds: number; category: string }>();
    for (const entry of timeline) {
      if (entry.is_idle || !entry.process_name) continue;
      const existing = map.get(entry.process_name);
      if (existing) {
        existing.seconds += entry.duration_seconds;
        // Use the most common category (productive > distracting > neutral)
        if (entry.category === "productive") existing.category = "productive";
        else if (entry.category === "distracting" && existing.category !== "productive")
          existing.category = "distracting";
      } else {
        map.set(entry.process_name, {
          seconds: entry.duration_seconds,
          category: entry.category,
        });
      }
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 20);
  }, [timeline]);

  // Aggregate domain usage
  const domainUsage = useMemo((): DomainUsage[] => {
    const map = new Map<string, { seconds: number; category: string }>();
    for (const tab of browserTabs) {
      if (!tab.domain) continue;
      const existing = map.get(tab.domain);
      if (existing) {
        existing.seconds += tab.duration_seconds;
        if (tab.category === "productive") existing.category = "productive";
        else if (tab.category === "distracting" && existing.category !== "productive")
          existing.category = "distracting";
      } else {
        map.set(tab.domain, {
          seconds: tab.duration_seconds,
          category: tab.category,
        });
      }
    }
    return Array.from(map.entries())
      .map(([domain, data]) => ({ domain, ...data }))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 15);
  }, [browserTabs]);

  const appMaxSeconds = appUsage.length > 0 ? appUsage[0].seconds : 0;
  const domainMaxSeconds = domainUsage.length > 0 ? domainUsage[0].seconds : 0;

  return (
    <div>
      <h2 className="page-title">Aktivite Detaylari</h2>

      {/* Activity Log Table */}
      <ActivityLogTable />

      {/* App Usage Section */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Uygulama Kullanimi</div>
        <HorizontalBarChart
          items={appUsage.map((a) => ({
            label: a.name,
            seconds: a.seconds,
            category: a.category,
          }))}
          maxSeconds={appMaxSeconds}
          labelKey="app"
        />
      </div>

      {/* Domain Visits Section */}
      {hasBrowserData && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">Domain Ziyaretleri</div>
          <HorizontalBarChart
            items={domainUsage.map((d) => ({
              label: d.domain,
              seconds: d.seconds,
              category: d.category,
            }))}
            maxSeconds={domainMaxSeconds}
            labelKey="domain"
          />
        </div>
      )}
    </div>
  );
}
