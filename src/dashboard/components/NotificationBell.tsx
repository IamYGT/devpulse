import { useState, useEffect, useRef, useCallback } from "react";
import { useTrackerState } from "../../hooks/useTrackerState";

interface Notification {
  id: number;
  title: string;
  body: string;
  urgency: "info" | "warning" | "alert" | "success";
  time: Date;
  read: boolean;
}

const urgencyColors: Record<string, string> = {
  info: "var(--accent-blue)",
  warning: "var(--accent-yellow)",
  alert: "var(--accent-red)",
  success: "var(--accent-green)",
};

const urgencyIcons: Record<string, string> = {
  info: "i",
  warning: "!",
  alert: "!!",
  success: "✓",
};

let nextId = 1;

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const state = useTrackerState(5000);

  // Track last check to avoid duplicate notifications
  const lastCheckRef = useRef<Record<string, number>>({});

  const addNotification = useCallback(
    (title: string, body: string, urgency: Notification["urgency"]) => {
      setNotifications((prev) => [
        {
          id: nextId++,
          title,
          body,
          urgency,
          time: new Date(),
          read: false,
        },
        ...prev.slice(0, 49), // keep max 50
      ]);
    },
    []
  );

  // Check notification conditions based on tracker state
  useEffect(() => {
    if (!state) return;

    const now = Date.now();
    const cooldowns = lastCheckRef.current;

    // 1. Long session alert (>90 min without break)
    if (state.elapsed_seconds > 5400 && !state.is_idle) {
      if (!cooldowns["long_session"] || now - cooldowns["long_session"] > 1800000) {
        cooldowns["long_session"] = now;
        addNotification(
          "Uzun Oturum Uyarisi",
          `${Math.floor(state.elapsed_seconds / 60)}dk'dir ara vermeden calisiyorsun. Kisa bir mola ver!`,
          "warning"
        );
      }
    }

    // 2. Distracting app alert (>5 min)
    if (state.current_category === "distracting" && state.elapsed_seconds > 300) {
      if (!cooldowns["distracting"] || now - cooldowns["distracting"] > 600000) {
        cooldowns["distracting"] = now;
        addNotification(
          "Dikkat Dagitici Uygulama!",
          `${state.current_process_name} uygulamasinda ${Math.floor(state.elapsed_seconds / 60)}dk gecirdin.`,
          "alert"
        );
      }
    }

    // 3. Low productivity alert
    if (state.today_total_minutes > 60 && state.productivity_percentage < 30) {
      if (!cooldowns["low_prod"] || now - cooldowns["low_prod"] > 3600000) {
        cooldowns["low_prod"] = now;
        addNotification(
          "Verimlilik Dusuk",
          `Bugunun verimliligi %${Math.round(state.productivity_percentage)}. Odaklanmayi dene!`,
          "info"
        );
      }
    }

    // 4. Milestone celebration (every productive hour)
    if (state.today_productive_minutes > 0 && state.today_productive_minutes % 60 === 0) {
      const hours = Math.floor(state.today_productive_minutes / 60);
      const key = `milestone_${hours}`;
      if (!cooldowns[key]) {
        cooldowns[key] = now;
        addNotification(
          "Tebrikler!",
          `Bugun ${hours} saat uretken calistin!`,
          "success"
        );
      }
    }
  }, [state, addNotification]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const formatTime = (d: Date) => {
    return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          position: "relative",
          padding: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-secondary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Badge */}
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              background: "var(--accent-red)",
              color: "#fff",
              borderRadius: "50%",
              width: 16,
              height: 16,
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            marginBottom: 8,
            width: 320,
            maxHeight: 400,
            overflowY: "auto",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            zIndex: 100,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              Bildirimler
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--accent-blue)",
                  fontSize: 11,
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Tumunu Oku
              </button>
            )}
          </div>

          {/* Notification List */}
          {notifications.length === 0 ? (
            <div
              style={{
                padding: "32px 14px",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: 13,
              }}
            >
              Bildirim yok
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => markRead(n.id)}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                  background: n.read ? "transparent" : "rgba(99, 102, 241, 0.04)",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--bg-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = n.read
                    ? "transparent"
                    : "rgba(99, 102, 241, 0.04)")
                }
              >
                {/* Urgency Icon */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: `${urgencyColors[n.urgency]}18`,
                    color: urgencyColors[n.urgency],
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  {urgencyIcons[n.urgency]}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 2,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: n.read ? 500 : 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {n.title}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        flexShrink: 0,
                        marginLeft: 8,
                      }}
                    >
                      {formatTime(n.time)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-secondary)",
                      lineHeight: 1.4,
                    }}
                  >
                    {n.body}
                  </div>
                </div>

                {/* Unread dot */}
                {!n.read && (
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--accent-blue)",
                      flexShrink: 0,
                      marginTop: 10,
                    }}
                  />
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
