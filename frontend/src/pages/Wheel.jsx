import React, { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Star, Zap } from "lucide-react";
import { toast } from "sonner";

const COLORS = ["hsl(340 90% 55%)", "hsl(45 95% 55%)", "hsl(280 80% 60%)", "hsl(160 70% 50%)", "hsl(210 90% 60%)", "hsl(20 90% 55%)", "hsl(0 80% 50%)"];

export default function WheelPage() {
  const { t, mode, balance, setUser } = useApp();
  const [segments, setSegments] = useState([]);
  const [bet, setBet] = useState(25);
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [popup, setPopup] = useState(null);

  useEffect(() => {
    (async () => { try { const r = await api.get("/games/wheel/segments"); setSegments(r.data.segments || []); } catch (e) {} })();
  }, []);

  const spin = async () => {
    if (spinning || segments.length === 0) return;
    if (bet <= 0 || bet > balance) { toast.error(t("insufficientBalance")); return; }
    setSpinning(true); setPopup(null);
    try {
      const r = await api.post("/games/wheel/spin", { bet, mode });
      const idx = r.data.segment_index;
      const segAngle = 360 / segments.length;
      // Compute absolute desired stop angle so that final angle % 360 places idx under top pointer.
      // We add at least (turbo?4:8) full revolutions on top of any current angle.
      const minSpins = turbo ? 4 : 8;
      const desiredOffset = (360 - (idx * segAngle + segAngle / 2) + 360) % 360;
      const current = angle;
      const currentMod = ((current % 360) + 360) % 360;
      let delta = desiredOffset - currentMod;
      if (delta < 0) delta += 360;
      const newAngle = current + minSpins * 360 + delta;
      setAngle(newAngle);
      const dur = turbo ? 1400 : 4500;
      setTimeout(() => {
        if (r.data.user) setUser(r.data.user);
        // Use SERVER label/mult — segment under pointer is idx, which holds the same label/mult as server returned.
        setPopup({ label: r.data.label, mult: r.data.mult, win: r.data.win });
        setSpinning(false);
      }, dur);
    } catch (e) { setSpinning(false); toast.error(e?.response?.data?.detail || t("failed")); }
  };

  const segAngle = segments.length ? 360 / segments.length : 0;

  return (
    <div className="px-4 pb-32" data-testid="wheel-page">
      <h2 className="font-display text-2xl mb-3">{t("wheel")}</h2>
      <div className="glass rounded-3xl p-4 flex flex-col items-center">
        <div className="relative w-72 h-72">
          <div
            className="absolute inset-0 rounded-full overflow-hidden border-4 border-yellow-400/60"
            style={{
              transform: `rotate(${angle}deg)`,
              transition: spinning ? `transform ${turbo ? 1.4 : 4.5}s cubic-bezier(0.16,1,0.3,1)` : "none",
              boxShadow: "0 0 40px hsla(340,90%,50%,0.5)",
            }}
          >
            {segments.map((s, i) => {
              const a = i * segAngle;
              return (
                <div
                  key={i}
                  className="absolute inset-0"
                  style={{
                    clipPath: `polygon(50% 50%, ${50 + 50 * Math.sin((a) * Math.PI / 180)}% ${50 - 50 * Math.cos(a * Math.PI / 180)}%, ${50 + 50 * Math.sin((a + segAngle) * Math.PI / 180)}% ${50 - 50 * Math.cos((a + segAngle) * Math.PI / 180)}%)`,
                    background: COLORS[i % COLORS.length],
                  }}
                />
              );
            })}
            {segments.map((s, i) => {
              const mid = i * segAngle + segAngle / 2;
              return (
                <div
                  key={`l-${i}`}
                  className="absolute left-1/2 top-1/2 text-white font-bold text-sm"
                  style={{
                    transform: `rotate(${mid}deg) translateY(-110px) rotate(${-mid}deg)`,
                    transformOrigin: "0 0",
                    textShadow: "0 1px 2px rgba(0,0,0,0.7)",
                  }}
                >
                  {s.label}
                </div>
              );
            })}
          </div>
          {/* center */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full cherry-gradient flex items-center justify-center border-4 border-yellow-400/70 z-10">
            <Star className="w-6 h-6 text-white" fill="currentColor" />
          </div>
          {/* pointer top */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-20">
            <div className="w-0 h-0" style={{ borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: "18px solid hsl(45 95% 60%)", filter: "drop-shadow(0 0 8px hsla(45,95%,60%,0.8))" }} />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 w-full mt-4">
          {[10, 25, 50, 100].map((b) => (
            <button key={b} onClick={() => setBet(b)} data-testid={`wheel-quickbet-${b}`} className="btn-ghost text-xs !py-1.5">{b}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 w-full mt-2">
          <input
            type="number" min={1} value={bet}
            onChange={(e) => setBet(Math.max(1, parseInt(e.target.value || "1", 10)))}
            data-testid="wheel-bet-input"
            className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 outline-none"
          />
          <button onClick={spin} disabled={spinning} data-testid="wheel-spin-btn" className="btn-cherry">{t("spin")}</button>
          <button onClick={() => setTurbo(v => !v)} data-testid="wheel-turbo-btn" className={`btn-ghost ${turbo ? "ring-2 ring-yellow-400" : ""}`}><Zap className="w-4 h-4" /></button>
        </div>
      </div>

      {popup && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={() => setPopup(null)} data-testid="wheel-popup">
          <div className="glass rounded-3xl p-6 text-center max-w-xs slide-up">
            {popup.win > 0 ? (
              <>
                <div className="text-xs uppercase tracking-widest text-gold mb-1">{t("win")}</div>
                <div className="font-display text-3xl mb-2">+{popup.win} ⭐</div>
                <div className="text-sm text-white/70">{popup.label}</div>
              </>
            ) : (
              <div className="text-sm">{t("nothing")}</div>
            )}
            <button onClick={() => setPopup(null)} className="btn-cherry mt-4 w-full">{t("close")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
