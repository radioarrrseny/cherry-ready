import React, { useState } from "react";
import api from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Bomb, Gem, Star } from "lucide-react";
import { toast } from "sonner";

const RULES = {
  3: { min: 1, max: 8 },
  5: { min: 1, max: 24 },
  7: { min: 1, max: 48 },
};

export default function MinesPage() {
  const { t, mode, balance, setUser } = useApp();
  const [size, setSize] = useState(5);
  const [mines, setMines] = useState(3);
  const [bet, setBet] = useState(50);
  const [gameId, setGameId] = useState(null);
  const [revealed, setRevealed] = useState({});
  const [mult, setMult] = useState(1.0);
  const [bombs, setBombs] = useState(null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (bet <= 0 || bet > balance) { toast.error(t("insufficientBalance")); return; }
    const { min, max } = RULES[size];
    const m = Math.min(Math.max(mines, min), max);
    setBusy(true);
    try {
      const r = await api.post("/games/mines/start", { bet, size, mines: m, mode });
      setGameId(r.data.game_id);
      setRevealed({});
      setMult(1.0);
      setBombs(null);
      if (r.data.user) setUser(r.data.user);
    } catch (e) { toast.error(e?.response?.data?.detail || t("failed")); }
    finally { setBusy(false); }
  };

  const reveal = async (i) => {
    if (!gameId || revealed[i] !== undefined || busy) return;
    setBusy(true);
    try {
      const r = await api.post("/games/mines/reveal", { game_id: gameId, index: i });
      if (r.data.hit_bomb) {
        const b = {};
        (r.data.bombs || []).forEach((idx) => b[idx] = "bomb");
        setRevealed({ ...revealed, ...b, [i]: "bomb" });
        setBombs(r.data.bombs);
        setGameId(null);
        toast.error("💥");
      } else {
        setRevealed({ ...revealed, [i]: "gem" });
        setMult(r.data.multiplier || 1);
      }
    } catch (e) { toast.error(t("failed")); }
    finally { setBusy(false); }
  };

  const cashout = async () => {
    if (!gameId) return;
    setBusy(true);
    try {
      const r = await api.post("/games/mines/cashout", { game_id: gameId });
      if (r.data.user) setUser(r.data.user);
      const b = {}; (r.data.bombs || []).forEach((idx) => b[idx] = "bomb-reveal");
      setRevealed({ ...revealed, ...b });
      setGameId(null);
      toast.success(`+${r.data.win} ⭐`);
    } catch (e) { toast.error(t("failed")); }
    finally { setBusy(false); }
  };

  const total = size * size;
  // Mobile-friendly responsive cells; 7x7 needs smaller cells
  const cellSize = size === 3 ? "aspect-square" : size === 5 ? "aspect-square" : "aspect-square";
  const cellTextSize = size === 7 ? "text-xs" : "text-lg";
  const iconSize = size === 7 ? "w-4 h-4" : "w-6 h-6";
  const gapCls = size === 7 ? "gap-1" : "gap-2";

  return (
    <div className="px-4 pb-32" data-testid="mines-page">
      <h2 className="font-display text-2xl mb-3">{t("mines")}</h2>

      <div className="glass rounded-3xl p-3">
        <div
          className={`grid ${gapCls} mx-auto w-full`}
          style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, maxWidth: size === 7 ? "100%" : size === 5 ? "26rem" : "20rem" }}
        >
          {Array.from({ length: total }, (_, i) => {
            const state = revealed[i];
            return (
              <button
                key={i}
                onClick={() => reveal(i)}
                disabled={!gameId || !!state}
                data-testid={`mines-cell-${i}`}
                className={`${cellSize} rounded-2xl flex items-center justify-center font-bold ${cellTextSize} transition-all ${
                  state === "gem" ? "bg-green-500/20 border border-green-400/40" :
                  state === "bomb" ? "bg-red-500/30 border border-red-500/60 animate-pulse" :
                  state === "bomb-reveal" ? "bg-red-500/10 border border-red-500/30" :
                  "glass hover:scale-[1.04] active:scale-95"
                }`}
              >
                {state === "gem" && <Gem className={`${iconSize} text-green-300`} />}
                {(state === "bomb" || state === "bomb-reveal") && <Bomb className={`${iconSize} text-red-300`} />}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between text-sm">
          <div className="opacity-70">{t("multiplier")}</div>
          <div className="font-bold text-gold" data-testid="mines-mult">{mult.toFixed(2)}x</div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="opacity-70">{t("possibleWin")}</div>
          <div className="font-bold flex items-center gap-1"><Star className="w-3.5 h-3.5 text-gold" fill="currentColor" />{Math.floor(bet * mult)}</div>
        </div>
      </div>

      <div className="mt-3 glass rounded-2xl p-3 space-y-2">
        <div>
          <div className="text-xs uppercase tracking-widest text-white/70 mb-1">{t("fieldSize")}</div>
          <div className="flex gap-2">
            {[3, 5, 7].map((s) => (
              <button
                key={s}
                data-testid={`mines-size-${s}`}
                onClick={() => { setSize(s); setMines(Math.min(mines, RULES[s].max)); }}
                className={`flex-1 btn-ghost ${size === s ? "ring-2 ring-pink-400" : ""}`}
              >
                {s}x{s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-white/70 mb-1">{t("minesCount")} ({RULES[size].min}-{RULES[size].max})</div>
          <input
            type="range"
            min={RULES[size].min}
            max={RULES[size].max}
            value={Math.min(Math.max(mines, RULES[size].min), RULES[size].max)}
            onChange={(e) => setMines(parseInt(e.target.value, 10))}
            data-testid="mines-count-slider"
            className="w-full accent-pink-500"
          />
          <div className="text-center font-bold text-pink-300" data-testid="mines-count-value">{Math.min(Math.max(mines, RULES[size].min), RULES[size].max)}</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number" min={1} value={bet}
            onChange={(e) => setBet(Math.max(1, parseInt(e.target.value || "1", 10)))}
            data-testid="mines-bet-input"
            className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white outline-none"
          />
          {gameId ? (
            <button onClick={cashout} data-testid="mines-cashout-btn" className="btn-cherry">{t("cashout")}</button>
          ) : (
            <button onClick={start} data-testid="mines-start-btn" className="btn-cherry">{t("startGame")}</button>
          )}
        </div>
      </div>
    </div>
  );
}
