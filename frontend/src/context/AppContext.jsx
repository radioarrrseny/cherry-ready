import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { setTgId } from "@/lib/api";
import { translations } from "@/data/translations";

const AppCtx = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState(() => localStorage.getItem("cc_mode") || "demo");
  const [lang, setLang] = useState(() => localStorage.getItem("cc_lang") || "ru");
  const [loading, setLoading] = useState(true);
  // Global bonus-stars confirmation modal state
  const [bonusPrompt, setBonusPrompt] = useState(null); // { onConfirm, onCancel } | null

  const t = useCallback((key) => translations[lang][key] || key, [lang]);

  useEffect(() => { localStorage.setItem("cc_mode", mode); }, [mode]);
  useEffect(() => { localStorage.setItem("cc_lang", lang); }, [lang]);

  useEffect(() => {
    const init = async () => {
      try {
        const tg = window.Telegram?.WebApp;
        let initData = "";
        let fallbackId = null;
        let fallbackUsername = "";
        if (tg) {
          tg.ready();
          tg.expand();
          initData = tg.initData || "";
          if (tg.initDataUnsafe?.user) {
            fallbackId = String(tg.initDataUnsafe.user.id);
            fallbackUsername = tg.initDataUnsafe.user.username || tg.initDataUnsafe.user.first_name || "Player";
          }
        }
        if (!fallbackId) {
          // browser preview fallback
          let stored = localStorage.getItem("cc_dev_id");
          if (!stored) {
            stored = "dev_" + Math.random().toString(36).slice(2, 10);
            localStorage.setItem("cc_dev_id", stored);
          }
          fallbackId = stored;
          fallbackUsername = "Player";
        }
        setTgId(fallbackId);
        const res = await api.post("/auth/telegram", {
          init_data: initData,
          fallback_user_id: fallbackId,
          fallback_username: fallbackUsername,
        });
        setUser(res.data.user);
      } catch (e) {
        console.error("auth failed", e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get("/me");
      setUser(res.data.user);
    } catch (e) {/* ignore */}
  }, []);

  const balance = user ? (mode === "demo" ? user.demo_balance : user.balance) : 0;
  const depositedBalance = user ? Math.max(0, user.deposited_balance || 0) : 0;
  const bonusBalance = user ? Math.max(0, (user.balance || 0) - depositedBalance) : 0;

  // Wrap a "place bet" action with bonus-stars confirmation when applicable.
  // - demo mode → always proceed
  // - real mode + bet <= deposited → proceed
  // - real mode + bet > deposited → open modal, run `proceed` on confirm
  const confirmBonusBet = useCallback((betAmount, proceed) => {
    if (mode !== "real") return proceed();
    if (betAmount <= depositedBalance) return proceed();
    setBonusPrompt({
      onConfirm: () => { setBonusPrompt(null); proceed(); },
      onCancel: () => setBonusPrompt(null),
    });
  }, [mode, depositedBalance]);

  return (
    <AppCtx.Provider value={{
      user, setUser, mode, setMode, lang, setLang, t, loading, refreshUser,
      balance, depositedBalance, bonusBalance,
      confirmBonusBet, bonusPrompt,
    }}>
      {children}
    </AppCtx.Provider>
  );
}

export const useApp = () => useContext(AppCtx);
