import React, { useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";
import { Star } from "lucide-react";
import { toast } from "sonner";

const PHASE_WAIT = "wait", PHASE_FLY = "fly", PHASE_CRASH = "crash";
const QUICK_BETS = [50, 100, 250, 500, 1000];

export default function CrashPage() {
  const { t, mode, balance, setUser } = useApp();
  const [bet, setBet] = useState(50);
  const [phase, setPhase] = useState(PHASE_WAIT);
  const [countdown, setCountdown] = useState(3);
  const [mult, setMult] = useState(1.0);
  const [crashAt, setCrashAt] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [betPlaced, setBetPlaced] = useState(false);
  const [history, setHistory] = useState([]);
  const [players, setPlayers] = useState([]);
  const [pathD, setPathD] = useState("M 0 100");
  const rafRef = useRef(null);
  const startRef = useRef(null);

  const [cashoutResult, setCashoutResult] = useState(null);

  useEffect(() => {
    if (phase === PHASE_FLY || phase === PHASE_CRASH) return;
    const n = 4 + Math.floor(Math.random() * 6);
    setPlayers(Array.from({ length: n }, (_, i) => ({
      id: i + 1, name: `Player${(Math.random()*900+100|0)}`,
      bet: QUICK_BETS[Math.floor(Math.random() * QUICK_BETS.length)],
      target: +(1.05 + Math.random() * 4).toFixed(2),
      status: "playing", cashout: null, win: null,
    })));
  }, [phase]);

  useEffect(() => {
    if (phase !== PHASE_FLY) return;
    setPlayers((prev) => prev.map((p) => {
      if (p.status === "playing" && mult >= p.target && p.target < crashAt) {
        return { ...p, status: "cashed", cashout: p.target, win: Math.floor(p.bet * p.target) };
      }
      return p;
    }));
  }, [mult, phase, crashAt]);

  useEffect(() => {
    if (phase === PHASE_CRASH) {
      setPlayers((prev) => prev.map((p) => p.status === "playing" ? { ...p, status: "lost" } : p));
    }
  }, [phase]);

  useEffect(() => {
    let timer;
    if (phase === PHASE_WAIT) {
      setCountdown(3); setMult(1.0); setCrashAt(null); setGameId(null); setPathD("M 0 100"); setCashoutResult(null);
      let c = 3;
      timer = setInterval(() => {
        c -= 1; setCountdown(c);
        if (c <= 0) { clearInterval(timer); startRound(); }
      }, 1000);
    }
    return () => clearInterval(timer);
    // eslint-disable-next-line
  }, [phase]);

  const startRound = async () => {
    let crashTarget = crashAt;
    if (!crashTarget) {
      // Visual-only fallback when no bet placed — mirrors backend distribution
      const r = Math.random() * 100;
      if (r < 20) crashTarget = +(1.01 + Math.random() * 0.19).toFixed(2);
      else if (r < 45) crashTarget = +(1.21 + Math.random() * 0.29).toFixed(2);
      else if (r < 70) crashTarget = +(1.51 + Math.random() * 0.49).toFixed(2);
      else if (r < 88) crashTarget = +(2.01 + Math.random() * 0.99).toFixed(2);
      else if (r < 96) crashTarget = +(3.01 + Math.random() * 1.99).toFixed(2);
      else if (r < 99.9) crashTarget = +(5.01 + Math.random() * 4.99).toFixed(2);
      else crashTarget = +(10.01 + Math.random() * 39.99).toFixed(2);
      setCrashAt(crashTarget);
    }
    setPhase(PHASE_FLY);
    startRef.current = performance.now();
    const loop = () => {
      const e = (performance.now() - startRef.current) / 1000;
      const m = +(Math.pow(1.06, e * 2)).toFixed(2);
      setMult(m);
      const xR = Math.min(0.98, e / 10);
      const yR = Math.min(0.85, Math.log2(Math.max(1, m)) * 0.45);
      setPathD(`M 0 100 Q ${xR * 50} ${100 - yR * 30} ${xR * 100} ${100 - yR * 100}`);
      if (m >= crashTarget) {
        setMult(crashTarget); setPhase(PHASE_CRASH);
        setHistory((h) => [{ at: crashTarget }, ...h].slice(0, 6));
        setBetPlaced(false);
        setTimeout(() => setPhase(PHASE_WAIT), 2200);
        cancelAnimationFrame(rafRef.current); return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const placeBet = async () => {
    if (phase !== PHASE_WAIT || betPlaced) return;
    if (!Number.isFinite(bet) || bet <= 0 || bet > balance) { toast.error(t("insufficientBalance")); return; }
    try {
      const r = await api.post("/games/crash/start", { bet, mode });
      if (r.data.user) setUser(r.data.user);
      setGameId(r.data.game_id); setCrashAt(r.data.crash_at); setBetPlaced(true);
    } catch (e) { toast.error(e?.response?.data?.detail || t("failed")); }
  };

  const cashout = async () => {
    if (phase !== PHASE_FLY || !betPlaced || !gameId) return;
    const mNow = mult;
    setBetPlaced(false);
    try {
      const r = await api.post("/games/crash/cashout", { game_id: gameId, multiplier: mNow });
      if (r.data.user) setUser(r.data.user);
      if (r.data.lost) {
        // Already crashed before cashout request reached server
        toast.error(`${t("crashed")} ${crashAt}x`);
      } else {
        // Successful cashout — show inline + toast
        setCashoutResult({ mult: mNow, win: r.data.win });
        toast.success(`+${r.data.win} ⭐ @ ${mNow.toFixed(2)}x`);
      }
      setGameId(null);
    } catch (e) { toast.error(t("failed")); }
  };

  const crashed = phase === PHASE_CRASH;
  const flying = phase === PHASE_FLY;

  return (
    <div className="px-4 pb-32" data-testid="crash-page">
      <h2 className="font-display text-2xl mb-3">{t("crash")}</h2>

      <div className="glass rounded-3xl p-4 relative h-72 overflow-hidden"
        style={{ background: crashed
          ? "radial-gradient(circle at 50% 50%, hsla(0,80%,30%,0.5), hsla(345,40%,8%,0.9))"
          : "radial-gradient(circle at 50% 110%, hsla(140,80%,20%,0.25), transparent 70%), linear-gradient(180deg, hsla(345,40%,10%,0.9), hsla(345,40%,7%,0.9))" }}>
        {/* grid */}
        <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
          {[20,40,60,80].map(y => <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="white" strokeWidth="0.15" />)}
          {[20,40,60,80].map(x => <line key={x} x1={x} y1="0" x2={x} y2="100" stroke="white" strokeWidth="0.15" />)}
        </svg>
        {/* curve */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="cv" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor={crashed ? "hsl(0 80% 55%)" : "hsl(140 80% 50%)"} stopOpacity="0.3" />
              <stop offset="100%" stopColor={crashed ? "hsl(0 90% 60%)" : "hsl(140 90% 55%)"} />
            </linearGradient>
          </defs>
          <path d={pathD} stroke="url(#cv)" strokeWidth="0.8" fill="none" style={{ filter: `drop-shadow(0 0 4px ${crashed ? "hsla(0,90%,55%,0.7)" : "hsla(140,90%,50%,0.7)"})` }} />
        </svg>
        {/* center display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {phase === PHASE_WAIT ? (
            <div className="font-display text-7xl text-yellow-300" style={{ textShadow: "0 0 30px hsla(45,95%,60%,0.8)" }} data-testid="crash-countdown">{countdown > 0 ? countdown : "GO"}</div>
          ) : (
            <>
              <div className="font-display text-6xl tracking-tight"
                style={{ color: crashed ? "hsl(0 90% 65%)" : "hsl(140 90% 65%)",
                  textShadow: crashed ? "0 0 30px hsla(0,90%,55%,0.9)" : "0 0 30px hsla(140,90%,55%,0.7)" }}
                data-testid="crash-mult">{mult.toFixed(2)}x</div>
              {crashed && <div className="mt-2 font-display text-2xl text-red-400 tracking-widest" data-testid="crash-label">{t("crashed").toUpperCase()}</div>}
              {cashoutResult && (
                <div className="mt-2 text-sm text-green-300 font-bold" data-testid="cashout-msg">
                  {t("cashedOutMsg")} {cashoutResult.win}⭐ {t("at")} {cashoutResult.mult.toFixed(2)}x
                </div>
              )}
            </>
          )}
        </div>
        <div className="absolute top-2 right-2 flex gap-1">
          {history.map((h, i) => (
            <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${h.at < 2 ? "bg-red-500/20 text-red-300" : "bg-green-500/20 text-green-300"}`}>{h.at}x</span>
          ))}
        </div>
      </div>

      {/* Bet panel */}
      <div className="mt-4 glass rounded-3xl p-4">
        <div className="relative mb-3">
          <Star className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gold" fill="currentColor" />
          <input
            type="number" min={1} value={bet}
            onChange={(e) => setBet(Math.max(1, parseInt(e.target.value || "1", 10)))}
            data-testid="crash-bet-input"
            className="w-full bg-black/40 border border-pink-500/20 rounded-2xl pl-10 pr-3 py-3 text-center text-lg font-bold outline-none focus:border-pink-500/60"
          />
        </div>
        <div className="grid grid-cols-5 gap-2 mb-3">
          {QUICK_BETS.map((b) => (
            <button key={b} onClick={() => setBet(b)} data-testid={`crash-quickbet-${b}`}
              className={`py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${bet === b ? "cherry-gradient text-white shadow-[0_0_18px_hsla(340,90%,55%,0.5)]" : "bg-pink-500/10 border border-pink-500/20 text-pink-200"}`}>
              {b}
            </button>
          ))}
        </div>
        {flying && betPlaced ? (
          <button onClick={cashout} data-testid="crash-cashout-btn" className="btn-cherry w-full py-3 text-lg font-display tracking-wide shadow-[0_0_25px_hsla(340,90%,55%,0.6)]">{t("cashout").toUpperCase()} {mult.toFixed(2)}x</button>
        ) : phase === PHASE_WAIT && !betPlaced ? (
          <button onClick={placeBet} data-testid="crash-bet-btn" className="btn-cherry w-full py-3 text-lg font-display tracking-wide shadow-[0_0_25px_hsla(340,90%,55%,0.6)]">{t("placeBet").toUpperCase()}</button>
        ) : (
          <button disabled className="w-full py-3 rounded-full font-display tracking-wide bg-white/5 text-white/40">{betPlaced ? t("betLocked").toUpperCase() : t("roundInProgress").toUpperCase()}</button>
        )}
      </div>

      {/* Live players */}
      <div className="mt-3 glass rounded-3xl p-3">
        <div className="text-xs uppercase tracking-widest text-pink-300 mb-2 px-1">{t("livePlayers")}</div>
        {players.length === 0 ? (
          <div className="text-center text-white/50 text-sm py-4">{t("waitingForBets")}…</div>
        ) : (
          <div className="space-y-1.5 max-h-44 overflow-y-auto scrollbar-hide">
            {players.map(p => (
              <div key={p.id} className="flex items-center justify-between text-xs bg-white/5 border border-white/5 rounded-xl px-3 py-2">
                <span className="text-white/80 font-semibold">{p.name}</span>
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-gold font-bold"><Star className="w-3 h-3" fill="currentColor" />{p.bet}</span>
                  {p.status === "cashed" ? <span className="text-green-400 font-bold">{p.cashout.toFixed(2)}x · +{p.win}</span>
                    : p.status === "lost" ? <span className="text-red-400 font-bold">{t("lost")}</span>
                    : <span className="text-white/60">{t("playing")}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
