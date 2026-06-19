import React, { useRef, useState } from "react";
import api from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Star, Zap } from "lucide-react";
import { toast } from "sonner";

const SYMBOLS = ["⭐", "🍒", "💎", "🔔", "7️⃣", "❤️"];
const SYMBOL_MAP = { star: "⭐", cherry: "🍒", diamond: "💎", bell: "🔔", seven: "7️⃣", heart: "❤️" };

export default function SlotsPage() {
  const { t, mode, balance, setUser } = useApp();
  const [bet, setBet] = useState(25);
  const [reels, setReels] = useState(["🍒", "💎", "⭐"]);
  const [spinning, setSpinning] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [lastWin, setLastWin] = useState(0);

  const spin = async () => {
    if (spinning) return;
    if (bet <= 0 || bet > balance) { toast.error(t("insufficientBalance")); return; }
    setSpinning(true); setLastWin(0);
    // animation phase: tick random symbols
    const startT = Date.now();
    const dur = turbo ? 700 : 1800;
    const interval = setInterval(() => {
      setReels([SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)], SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)], SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]]);
      if (Date.now() - startT > dur - 100) clearInterval(interval);
    }, 70);
    try {
      const r = await api.post("/games/slots/spin", { bet, mode });
      await new Promise((res) => setTimeout(res, dur));
      clearInterval(interval);
      const mapped = r.data.reels.map((s) => SYMBOL_MAP[s] || "⭐");
      setReels(mapped);
      if (r.data.user) setUser(r.data.user);
      setLastWin(r.data.win || 0);
      if (r.data.win > 0) toast.success(`+${r.data.win} ⭐`);
    } catch (e) {
      clearInterval(interval);
      toast.error(e?.response?.data?.detail || t("failed"));
    } finally {
      setSpinning(false);
    }
  };

  return (
    <div className="px-4 pb-32" data-testid="slots-page">
      <h2 className="font-display text-2xl mb-3">{t("slots")}</h2>
      <div className="glass rounded-3xl p-5">
        <div className="grid grid-cols-3 gap-2 mb-4">
          {reels.map((s, i) => (
            <div key={i} data-testid={`slot-reel-${i}`} className={`h-28 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-5xl ${spinning ? "shimmer" : ""}`}>
              {s}
            </div>
          ))}
        </div>
        {lastWin > 0 && (
          <div className="text-center font-bold text-gold mb-3 slide-up" data-testid="slot-win">+{lastWin} ⭐</div>
        )}

        <div className="grid grid-cols-4 gap-2 mb-2">
          {[10, 25, 50, 100].map((b) => (
            <button key={b} onClick={() => setBet(b)} data-testid={`slots-quickbet-${b}`} className="btn-ghost text-xs !py-1.5">{b}</button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="number" min={1} value={bet}
            onChange={(e) => setBet(Math.max(1, parseInt(e.target.value || "1", 10)))}
            data-testid="slots-bet-input"
            className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 outline-none"
          />
          <button onClick={spin} disabled={spinning} data-testid="slots-spin-btn" className="btn-cherry flex items-center gap-1">
            <Star className="w-4 h-4" fill="currentColor" />{t("spin")}
          </button>
          <button onClick={() => setTurbo(v => !v)} data-testid="slots-turbo-btn" className={`btn-ghost ${turbo ? "ring-2 ring-yellow-400" : ""}`}>
            <Zap className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
