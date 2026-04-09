import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { TrackerState } from "../../types";

/* ------------------------------------------------------------------ */
/*  Tip Definitions                                                    */
/* ------------------------------------------------------------------ */

type TipCategory = "odaklanma" | "zaman_yonetimi" | "saglik" | "git_kod";

interface Tip {
  id: string;
  category: TipCategory;
  title: string;
  content: string;
  condition?: (state: TrackerState | null) => boolean;
}

const CATEGORY_LABELS: Record<TipCategory, { label: string; color: string }> = {
  odaklanma: { label: "Odaklanma", color: "var(--accent-blue)" },
  zaman_yonetimi: { label: "Zaman Yonetimi", color: "var(--accent-yellow)" },
  saglik: { label: "Saglik", color: "var(--accent-green)" },
  git_kod: { label: "Git/Kod", color: "var(--accent-purple)" },
};

const ALL_TIPS: Tip[] = [
  // Low productivity tips
  {
    id: "focus-pomodoro",
    category: "odaklanma",
    title: "Pomodoro Tekni",
    content: "25 dakika odakli calisma + 5 dakika mola. 4 tur sonra 15-30 dakikalik uzun mola verin. Bu teknik odaklanmayi onemli olcude arttirir.",
    condition: (s) => s !== null && s.productivity_percentage < 50,
  },
  {
    id: "focus-notifications",
    category: "odaklanma",
    title: "Bildirimleri Sustur",
    content: "Derin calisma sirasinda tum bildirimleri kapatin. Windows Odaklanma Yardimcisi veya Discord'u DND moduna alin.",
    condition: (s) => s !== null && s.productivity_percentage < 50,
  },
  {
    id: "focus-single-task",
    category: "odaklanma",
    title: "Tek Is Odagi",
    content: "Coklu gorev degistirme verimliligi %40'a kadar dusurur. Bir isi bitirmeden digerine gecmeyin.",
    condition: (s) => s !== null && s.productivity_percentage < 60,
  },
  {
    id: "focus-deep-work",
    category: "odaklanma",
    title: "Derin Calisma Bloklari",
    content: "Gununuzun en uretken saatlerinde 2-3 saatlik kesintisiz bloklar planlayın. Bu bloklar sirasinda sosyal medya ve mesajlasma uygulamalarini kapatın.",
  },
  // Overtime tips
  {
    id: "time-overtime",
    category: "zaman_yonetimi",
    title: "Fazla Mesai Uyarisi",
    content: "Gunluk butcenizi astiginizda verimlilik dusuyor. Mola verin veya yarinki plana tasiyin.",
    condition: (s) => s !== null && s.today_total_minutes > s.budget_limit_minutes + 120,
  },
  {
    id: "time-planning",
    category: "zaman_yonetimi",
    title: "Gunluk Planlama",
    content: "Her sabah gune baslamadan once 5 dakika planlama yapin. En onemli 3 gorevi belirleyin ve onceliklendirin.",
  },
  {
    id: "time-two-min",
    category: "zaman_yonetimi",
    title: "2 Dakika Kurali",
    content: "Bir gorev 2 dakikadan az surecekse hemen yapin. Ertelediginde zihinsel yuk birikiyor.",
  },
  {
    id: "time-batching",
    category: "zaman_yonetimi",
    title: "Gorev Gruplama",
    content: "Benzer gorevleri bir araya toplayin. Email kontrolu, code review, toplanti gibi aktiviteleri belirli zaman dilimlerine sigin.",
  },
  // No commits tips
  {
    id: "git-commit-often",
    category: "git_kod",
    title: "Sik Commit Yapin",
    content: "Kucuk ve anlamli commitler yapın. Her mantiksal degisiklik bir commit olmali. Bu hem takibi kolaylastirir hem de geri donusu guvenli kilar.",
    condition: (s) => s !== null && s.today_commits === 0 && s.today_total_minutes > 60,
  },
  {
    id: "git-branch",
    category: "git_kod",
    title: "Feature Branch Kullanin",
    content: "Her yeni ozellik veya hata duzeltmesi icin ayri branch olusturun. Main/master branch'e direkt push yapmayin.",
  },
  {
    id: "git-messages",
    category: "git_kod",
    title: "Aciklayici Commit Mesajlari",
    content: "Ne degistigini degil, neden degistigini yazin. Iyi bir commit mesaji gelecekte debug ederken cok isine yarar.",
  },
  // Streak tips
  {
    id: "streak-congrats",
    category: "odaklanma",
    title: "Harika Seri!",
    content: "Art arda 5+ gun uretken calisiyorsunuz. Bu momentum degerli - gunluk rutininizi korumaya devam edin!",
  },
  // Health tips
  {
    id: "health-break",
    category: "saglik",
    title: "Duzeli Mola Verin",
    content: "Her 90 dakikada 10-15 dakika mola verin. Kisa yurunus yapin veya gozlerinizi dinlendirin. 20-20-20 kurali: 20 dakikada bir, 20 saniye boyunca 20 feet uzaga bakin.",
  },
  {
    id: "health-posture",
    category: "saglik",
    title: "Durus Kontrolu",
    content: "Oturma pozisyonunuzu kontrol edin. Sirtiniz dik, omuzlariniz rahat, ekran goz hizasinda olmali. Her saat basinda hizli bir durus kontrolu yapin.",
  },
  {
    id: "health-hydration",
    category: "saglik",
    title: "Su Icmeyi Unutmayin",
    content: "Dehidrasyon konsantrasyonu ve bilissel performansi dusurur. Masanizda su sisesi bulundurun ve duzeli icin.",
  },
  {
    id: "health-eye-strain",
    category: "saglik",
    title: "Goz Yorgunlugu",
    content: "Ekran parlakligini ortama gore ayarlayin. Karanlik tema kullaniyorsaniz oda aydinlatmasini da dusuk tutun. Mavi isik filtresi aktif edin.",
    condition: (s) => s !== null && s.today_total_minutes > 240,
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PerformanceTips() {
  const [state, setState] = useState<TrackerState | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState<TipCategory | "all">("all");

  // Load state
  useEffect(() => {
    invoke<TrackerState>("get_current_state")
      .then(setState)
      .catch(() => { /* ignore */ });
  }, []);

  // Load bookmarks from settings
  useEffect(() => {
    invoke<string | null>("get_setting", { key: "bookmarked_tips" })
      .then((saved) => {
        if (saved) {
          try {
            setBookmarked(new Set(JSON.parse(saved)));
          } catch {}
        }
      })
      .catch(() => { /* ignore */ });
  }, []);

  const saveBookmarks = useCallback(async (next: Set<string>) => {
    setBookmarked(next);
    try {
      await invoke("save_setting", {
        key: "bookmarked_tips",
        value: JSON.stringify(Array.from(next)),
      });
    } catch {}
  }, []);

  /* -- Filter tips based on condition and category -------------------- */
  const filteredTips = ALL_TIPS.filter((tip) => {
    // If tip has a condition, check it
    if (tip.condition && !tip.condition(state)) return false;
    // Category filter
    if (filterCategory !== "all" && tip.category !== filterCategory) return false;
    return true;
  });

  // Fallback: if no conditional tips match, show general tips
  const displayTips = filteredTips.length > 0
    ? filteredTips
    : ALL_TIPS.filter((t) => !t.condition && (filterCategory === "all" || t.category === filterCategory));

  const currentTip = displayTips[currentIndex % displayTips.length];

  const nextTip = () => {
    setCurrentIndex((prev) => (prev + 1) % Math.max(displayTips.length, 1));
  };

  const toggleBookmark = () => {
    if (!currentTip) return;
    const next = new Set(bookmarked);
    if (next.has(currentTip.id)) {
      next.delete(currentTip.id);
    } else {
      next.add(currentTip.id);
    }
    saveBookmarks(next);
  };

  if (!currentTip) return null;

  const catInfo = CATEGORY_LABELS[currentTip.category];

  return (
    <div>
      {/* Category filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        <button
          onClick={() => { setFilterCategory("all"); setCurrentIndex(0); }}
          style={{
            padding: "4px 12px",
            borderRadius: 12,
            border: "none",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            background: filterCategory === "all" ? "rgba(99,102,241,0.15)" : "var(--bg-secondary)",
            color: filterCategory === "all" ? "var(--accent-blue)" : "var(--text-muted)",
            transition: "all 0.2s",
          }}
        >
          Tumu
        </button>
        {(Object.entries(CATEGORY_LABELS) as [TipCategory, typeof CATEGORY_LABELS[TipCategory]][]).map(([key, info]) => (
          <button
            key={key}
            onClick={() => { setFilterCategory(key); setCurrentIndex(0); }}
            style={{
              padding: "4px 12px",
              borderRadius: 12,
              border: "none",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              background: filterCategory === key ? `${info.color}20` : "var(--bg-secondary)",
              color: filterCategory === key ? info.color : "var(--text-muted)",
              transition: "all 0.2s",
            }}
          >
            {info.label}
          </button>
        ))}
      </div>

      {/* Tip Card */}
      <div
        style={{
          padding: 18,
          background: "var(--bg-secondary)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          borderLeft: `3px solid ${catInfo.color}`,
        }}
      >
        {/* Tip header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: catInfo.color,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {catInfo.label}
            </span>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginTop: 4 }}>
              {currentTip.title}
            </h4>
          </div>
          {/* Bookmark button */}
          <button
            onClick={toggleBookmark}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              color: bookmarked.has(currentTip.id) ? "var(--accent-yellow)" : "var(--text-muted)",
              padding: "2px 4px",
              transition: "color 0.2s",
            }}
            title={bookmarked.has(currentTip.id) ? "Yer iminden kaldir" : "Yer imine ekle"}
          >
            {bookmarked.has(currentTip.id) ? "\u2605" : "\u2606"}
          </button>
        </div>

        {/* Tip content */}
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0 }}>
          {currentTip.content}
        </p>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {(currentIndex % displayTips.length) + 1} / {displayTips.length}
          </span>
          <button
            onClick={nextTip}
            className="btn"
            style={{ fontSize: 12, padding: "6px 16px" }}
          >
            Sonraki
          </button>
        </div>
      </div>

      {/* Bookmarked Tips */}
      {bookmarked.size > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            Yer Imleri ({bookmarked.size})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ALL_TIPS.filter((t) => bookmarked.has(t.id)).map((tip) => {
              const info = CATEGORY_LABELS[tip.category];
              return (
                <div
                  key={tip.id}
                  style={{
                    padding: "8px 12px",
                    background: "var(--bg-secondary)",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: info.color, fontSize: 10 }}>&#9679;</span>
                    <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{tip.title}</span>
                  </div>
                  <button
                    onClick={() => {
                      const next = new Set(bookmarked);
                      next.delete(tip.id);
                      saveBookmarks(next);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 14,
                      color: "var(--text-muted)",
                      padding: "0 4px",
                    }}
                    title="Kaldir"
                  >
                    &#215;
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
