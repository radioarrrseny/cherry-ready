import React, { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";
import {
  Star, RefreshCw, Languages, Package, Rocket, Coins, TrendingDown,
  TrendingUp, Gift, ShoppingBag, Send, Hash, IdCard
} from "lucide-react";
import { toast } from "sonner";

const StatCard = ({ icon: Icon, label, value, accent, testid }) => (
  <div className="glass rounded-2xl p-3 flex items-center gap-3" data-testid={testid || `stat-${label}`}>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-[10px] uppercase tracking-widest opacity-70 leading-tight">{label}</div>
      <div className="font-bold text-sm truncate">{value}</div>
    </div>
  </div>
);

const T = ({ label, children }) => (
  <div className="text-xs uppercase tracking-widest text-white/60 mb-2 mt-4">{label}</div>
);

export default function ProfilePage() {
  const { t, user, mode, setMode, lang, setLang, setUser, balance } = useApp();
  const [stats, setStats] = useState(null);

  const load = async () => {
    try { const r = await api.get(`/stats?mode=${mode}`); setStats(r.data); }
    catch (e) {/* ignore */}
  };
  useEffect(() => { load(); }, [mode]);

  const reset = async () => {
    try { const r = await api.post("/profile/reset-demo"); if (r.data.user) setUser(r.data.user); toast.success("OK"); load(); }
    catch (e) { toast.error(t("failed")); }
  };

  const isDemo = mode === "demo";
  const photo = window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url;
  const initial = (user?.first_name || user?.username || "U")[0]?.toUpperCase();

  return (
    <div className="px-4 pb-32" data-testid="profile-page">
      <h2 className="font-display text-2xl mb-3">{t("profile")}</h2>

      {/* Header card */}
      <div className="glass rounded-3xl p-4 mb-3 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-32 h-32 cherry-gradient opacity-20 rounded-full blur-2xl" />
        <div className="flex items-center gap-3 relative">
          {photo ? (
            <img src={photo} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-pink-400/50" />
          ) : (
            <div className="w-16 h-16 rounded-full cherry-gradient flex items-center justify-center font-display text-2xl">{initial}</div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-bold text-lg truncate">{user?.first_name || user?.username || t("you")}</div>
            <div className="text-xs text-white/70 flex items-center gap-1"><Hash className="w-3 h-3" />@{user?.username || "guest"}</div>
            <div className="text-[10px] text-white/50 flex items-center gap-1"><IdCard className="w-3 h-3" />ID {user?.tg_id}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest opacity-70">{t("balance")}</div>
            <div className="flex items-center gap-1 text-gold font-bold"><Star className="w-3.5 h-3.5" fill="currentColor" />{(balance || 0).toLocaleString()}</div>
          </div>
        </div>

        {/* Mode toggle inside card */}
        <button
          onClick={() => setMode(isDemo ? "real" : "demo")}
          data-testid="profile-mode-toggle"
          className={`mt-3 w-full rounded-2xl py-2 text-xs uppercase tracking-widest font-bold border transition ${
            isDemo
              ? "bg-yellow-400/15 text-yellow-300 border-yellow-400/30"
              : "bg-pink-500/15 text-pink-300 border-pink-500/30"
          }`}
        >
          {isDemo ? t("demoMode") : t("realMode")} — {t("tapToSwitch")}
        </button>
      </div>

      {/* Stats grid */}
      <T label={t("history")} />
      <div className="grid grid-cols-2 gap-2">
        <StatCard icon={Package} testid="stat-cases-opened" label={t("casesOpened")} value={stats?.total_cases_opened ?? 0} accent="bg-pink-500/15 text-pink-300" />
        <StatCard icon={TrendingDown} testid="stat-stars-spent" label={t("starsSpent")} value={(stats?.total_stars_spent ?? 0).toLocaleString()} accent="bg-red-500/15 text-red-300" />
        <StatCard icon={TrendingUp} testid="stat-stars-won" label={t("starsWon")} value={(stats?.total_stars_won ?? 0).toLocaleString()} accent="bg-green-500/15 text-green-300" />
        <StatCard icon={ShoppingBag} testid="stat-inventory-value" label={t("inventoryValue")} value={(stats?.inventory_value ?? 0).toLocaleString()} accent="bg-yellow-400/15 text-yellow-300" />
      </div>

      {(stats?.biggest_gift || stats?.biggest_crash || stats?.biggest_slots) && (
        <>
          <T label={t("bestWins")} />
          <div className="space-y-2">
            {stats.biggest_gift && (
              <div className="glass rounded-2xl p-3 flex items-center gap-3" data-testid="biggest-gift">
                <img src={stats.biggest_gift.image} alt="" className="w-12 h-12 rounded-xl object-cover" />
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-widest opacity-70">{t("biggestGift")}</div>
                  <div className="font-bold text-sm">{stats.biggest_gift.name}</div>
                </div>
                <div className="flex items-center gap-1 text-gold font-bold"><Star className="w-3.5 h-3.5" fill="currentColor" />{stats.biggest_gift.value}</div>
              </div>
            )}
            {stats.biggest_crash && (
              <div className="glass rounded-2xl p-3 flex items-center gap-3" data-testid="biggest-crash">
                <div className="w-12 h-12 rounded-xl bg-pink-500/15 flex items-center justify-center"><Rocket className="w-6 h-6 text-pink-300" /></div>
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-widest opacity-70">{t("biggestCrash")}</div>
                  <div className="font-bold text-sm">{stats.biggest_crash.multiplier}x • {t("bet")} {stats.biggest_crash.bet}</div>
                </div>
                <div className="flex items-center gap-1 text-gold font-bold"><Star className="w-3.5 h-3.5" fill="currentColor" />{stats.biggest_crash.win}</div>
              </div>
            )}
            {stats.biggest_slots && (
              <div className="glass rounded-2xl p-3 flex items-center gap-3" data-testid="biggest-slots">
                <div className="w-12 h-12 rounded-xl bg-yellow-400/15 flex items-center justify-center"><Coins className="w-6 h-6 text-yellow-300" /></div>
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-widest opacity-70">{t("biggestSlots")}</div>
                  <div className="font-bold text-sm">{stats.biggest_slots.outcome}</div>
                </div>
                <div className="flex items-center gap-1 text-gold font-bold"><Star className="w-3.5 h-3.5" fill="currentColor" />{stats.biggest_slots.win}</div>
              </div>
            )}
          </div>
        </>
      )}

      {stats?.withdrawal_history?.length > 0 && (
        <>
          <T label={t("withdrawals")} />
          <div className="space-y-1.5">
            {stats.withdrawal_history.slice(0, 5).map((w) => (
              <div key={w.id} className="glass rounded-xl p-2 flex items-center gap-2 text-xs" data-testid="wd-row">
                <Send className="w-4 h-4 text-pink-300" />
                <span className="flex-1 truncate">{w.gift_name}</span>
                <span className="text-gold font-bold flex items-center gap-1"><Star className="w-3 h-3" fill="currentColor" />{w.gift_value}</span>
                <span className="text-white/50">{w.status}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {stats?.sold_history?.length > 0 && (
        <>
          <T label={t("soldGifts")} />
          <div className="space-y-1.5">
            {stats.sold_history.slice(0, 5).map((s) => (
              <div key={s.id} className="glass rounded-xl p-2 flex items-center gap-2 text-xs" data-testid="sold-row">
                <Gift className="w-4 h-4 text-yellow-300" />
                <span className="flex-1 truncate">{s.name}</span>
                <span className="text-gold font-bold flex items-center gap-1"><Star className="w-3 h-3" fill="currentColor" />{Math.round(s.value * 1.05)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Language */}
      <T label={t("language")} />
      <div className="glass rounded-2xl p-2 flex gap-2">
        <button onClick={() => setLang("ru")} data-testid="lang-ru" className={`flex-1 btn-ghost ${lang === "ru" ? "ring-2 ring-pink-400" : ""}`}>Русский</button>
        <button onClick={() => setLang("en")} data-testid="lang-en" className={`flex-1 btn-ghost ${lang === "en" ? "ring-2 ring-pink-400" : ""}`}>English</button>
      </div>

      <button onClick={reset} data-testid="reset-demo-btn" className="btn-ghost w-full mt-4 flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4" />{t("resetDemo")}
      </button>
    </div>
  );
}
