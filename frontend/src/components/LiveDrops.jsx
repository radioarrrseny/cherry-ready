import React, { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Star } from "lucide-react";

export default function LiveDrops() {
  const { t } = useApp();
  const [drops, setDrops] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    let alive = true;
    const fetchDrops = async () => {
      try {
        const r = await api.get("/live-drops");
        if (alive) setDrops(r.data.drops || []);
      } catch (e) {/* ignore */}
    };
    fetchDrops();
    const sim = async () => { try { await api.post("/internal/simulate-drop"); fetchDrops(); } catch (e) {} };
    const pollId = setInterval(fetchDrops, 4000);
    const simId = setInterval(sim, Math.random() * 4000 + 3000);
    return () => { alive = false; clearInterval(pollId); clearInterval(simId); };
  }, []);

  return (
    <div className="px-3 mb-3" data-testid="live-drops">
      <div className="flex items-center gap-2 mb-1.5 px-1">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[11px] uppercase tracking-widest text-white/70">{t("liveDrops")}</span>
      </div>
      <div ref={ref} className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {drops.map((d) => (
          <div key={d.id} className="glass rounded-2xl p-2 min-w-[110px] flex flex-col items-center gap-1 slide-up" data-testid="live-drop-item">
            <img src={d.image} alt={d.name} className="w-14 h-14 rounded-xl object-cover" />
            <div className="text-[11px] font-semibold text-center line-clamp-1">{d.name}</div>
            <div className="flex items-center gap-1 text-[11px] text-gold font-bold">
              <Star className="w-3 h-3" fill="currentColor" />
              {d.value.toLocaleString()}
            </div>
          </div>
        ))}
        {drops.length === 0 && (
          <div className="text-xs text-white/50 px-2 py-3">…</div>
        )}
      </div>
    </div>
  );
}
