import React, { useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";
import { X, Star, Zap } from "lucide-react";
import { toast } from "sonner";

const STRIP_LENGTH = 80;
const ITEM_W = 100;   // width of each card
const GAP = 8;        // matches gap-2 (Tailwind 0.5rem)
const STEP = ITEM_W + GAP;
const STRIP_PADDING = 8; // px-2

export default function CaseOpenModal({ caseData, open, onClose }) {
  const { t, mode, refreshUser, setUser } = useApp();
  const [strip, setStrip] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [result, setResult] = useState(null);
  const stripRef = useRef(null);
  const trackRef = useRef(null);

  const possible = caseData?.rewards || [];

  // Build initial decorative strip
  useEffect(() => {
    if (!open) {
      setStrip([]); setResult(null); setSpinning(false);
      if (stripRef.current) {
        stripRef.current.style.transition = "none";
        stripRef.current.style.transform = "translate3d(0,0,0)";
      }
      return;
    }
    const arr = Array.from({ length: STRIP_LENGTH }, () => possible[Math.floor(Math.random() * possible.length)] || possible[0]);
    setStrip(arr);
  }, [open, caseData]);

  const spin = async () => {
    if (!caseData || spinning || !possible.length) return;
    setSpinning(true);
    setResult(null);
    try {
      // 1. SINGLE source of truth: pick reward on server
      const res = await api.post("/cases/open", { case_id: caseData.id, mode });
      const reward = res.data.reward;
      if (res.data.user) setUser(res.data.user);

      // 2. Build strip with WINNING item placed at predetermined final index.
      //    All other slots are random decorative entries (any of possible rewards).
      const finalIndex = STRIP_LENGTH - 6;
      const newStrip = Array.from({ length: STRIP_LENGTH }, () =>
        possible[Math.floor(Math.random() * possible.length)] || possible[0]
      );
      // Use SAME shape as possible[] (server already returns name+value+image)
      newStrip[finalIndex] = {
        type: reward.type,
        id: reward.id,
        name: reward.name,
        value: reward.value || reward.amount,
        image: reward.image,
      };
      setStrip(newStrip);

      // 3. Animate strip so winning item lands precisely under center pointer.
      requestAnimationFrame(() => {
        if (!stripRef.current || !trackRef.current) return;
        stripRef.current.style.transition = "none";
        stripRef.current.style.transform = "translate3d(0,0,0)";
        // force reflow
        // eslint-disable-next-line no-unused-expressions
        stripRef.current.offsetHeight;

        const containerW = trackRef.current.clientWidth;
        // Center of item finalIndex from strip's left = STRIP_PADDING + finalIndex*STEP + ITEM_W/2
        const itemCenterFromLeft = STRIP_PADDING + finalIndex * STEP + ITEM_W / 2;
        // We want this to align with containerW/2 → translateX = containerW/2 - itemCenterFromLeft
        const targetOffset = containerW / 2 - itemCenterFromLeft;

        const dur = turbo ? 1.6 : 5.5;
        stripRef.current.style.transition = `transform ${dur}s cubic-bezier(0.08, 0.82, 0.17, 1)`;
        stripRef.current.style.transform = `translate3d(${targetOffset}px,0,0)`;

        setTimeout(() => {
          setResult(reward);
          setSpinning(false);
          refreshUser();
        }, dur * 1000 + 100);
      });
    } catch (e) {
      setSpinning(false);
      const detail = e?.response?.data?.detail || "";
      if (detail.startsWith("cooldown:")) {
        const secs = parseInt(detail.split(":")[1] || "0", 10);
        toast.error(`${t("cooldown")}: ${Math.ceil(secs / 3600)}${t("hours")}`);
      } else if (detail === "insufficient balance") {
        toast.error(t("insufficientBalance"));
      } else {
        toast.error(t("failed"));
      }
    }
  };

  if (!open || !caseData) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" data-testid="case-modal">
      <div className="glass w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-4 slide-up max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="font-display text-lg">{caseData.name}</div>
          <button onClick={onClose} data-testid="case-modal-close" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Roulette */}
        <div ref={trackRef} className="relative overflow-hidden rounded-2xl bg-black/40 border border-white/10 py-3">
          <div className="absolute left-1/2 -translate-x-1/2 top-0 z-20" style={{ height: "100%" }}>
            <div className="roulette-pointer" style={{ borderTop: "14px solid hsl(45 95% 60%)", marginTop: "-2px" }} />
            <div className="w-[2px] h-[calc(100%-14px)] mx-auto bg-gradient-to-b from-yellow-400 via-yellow-300 to-transparent opacity-70" />
          </div>
          <div ref={stripRef} className="flex gap-2 px-2" style={{ width: STRIP_LENGTH * STEP + STRIP_PADDING * 2, willChange: "transform" }}>
            {strip.map((g, i) => (
              <div key={i} className="flex-shrink-0 rounded-xl glass flex flex-col items-center justify-center p-1" style={{ width: ITEM_W, height: 120 }}>
                <img src={g?.image} alt="" className="w-16 h-16 rounded-lg object-cover" />
                <div className="text-[10px] mt-1 font-semibold text-center line-clamp-1 px-1">{g?.name}</div>
                <div className="flex items-center gap-0.5 text-[10px] text-gold font-bold">
                  <Star className="w-2.5 h-2.5" fill="currentColor" />{g?.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className="mt-3 slide-up text-center glass rounded-2xl p-3 border border-yellow-400/30" data-testid="case-result">
            <div className="text-xs uppercase tracking-widest text-yellow-300 mb-1">{t("youGot")}</div>
            <div className="flex items-center justify-center gap-3">
              <img src={result.image} alt={result.name} className="w-16 h-16 rounded-xl object-cover" />
              <div className="text-left">
                <div className="font-bold">{result.name}</div>
                <div className="flex items-center gap-1 text-gold font-bold">
                  <Star className="w-4 h-4" fill="currentColor" />{result.value || result.amount}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="mt-3 flex items-center gap-2">
          <button
            data-testid="case-open-btn"
            onClick={spin}
            disabled={spinning}
            className="btn-cherry flex-1 flex items-center justify-center gap-2"
          >
            {spinning ? "..." : (<><Star className="w-4 h-4" fill="currentColor" /> {t("openFor")} {caseData.price}</>)}
          </button>
          <button
            onClick={() => setTurbo(v => !v)}
            data-testid="case-turbo-btn"
            className={`btn-ghost flex items-center gap-1 ${turbo ? "ring-2 ring-yellow-400" : ""}`}
          >
            <Zap className="w-4 h-4" />{t("turbo")}
          </button>
        </div>

        {/* Possible wins */}
        <div className="mt-4">
          <div className="text-xs uppercase tracking-widest text-white/70 mb-2">{t("possibleWins")}</div>
          <div className="grid grid-cols-3 gap-2">
            {possible.map((g, i) => (
              <div key={i} className="glass rounded-xl p-2 flex flex-col items-center" data-testid="possible-win-item">
                <img src={g.image} alt={g.name} className="w-12 h-12 rounded-lg object-cover" />
                <div className="text-[10px] mt-1 text-center font-semibold line-clamp-1">{g.name}</div>
                {g.type !== "stars" && (
                  <div className="flex items-center gap-0.5 text-[10px] text-gold font-bold">
                    <Star className="w-2.5 h-2.5" fill="currentColor" />{g.value}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
