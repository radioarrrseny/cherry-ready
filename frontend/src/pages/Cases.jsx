import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useApp } from "@/context/AppContext";
import CaseOpenModal from "@/components/CaseOpenModal";
import { Star, Lock } from "lucide-react";

export default function CasesPage() {
  const { t, user } = useApp();
  const [cases, setCases] = useState([]);
  const [active, setActive] = useState(null);

  useEffect(() => {
    (async () => {
      try { const r = await api.get("/cases"); setCases(r.data.cases || []); } catch (e) {}
    })();
  }, []);

  return (
    <div className="px-4 pb-32" data-testid="cases-page">
      <h2 className="font-display text-2xl mb-3">{t("cases")}</h2>
      <div className="grid grid-cols-2 gap-3">
        {cases.map((c) => (
          <button
            key={c.id}
            onClick={() => setActive(c)}
            data-testid={`case-card-${c.id}`}
            className="glass rounded-3xl p-3 flex flex-col items-center text-center hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            <div className="w-full aspect-square rounded-2xl overflow-hidden cherry-gradient-soft flex items-center justify-center mb-2 relative transition-transform group-hover:scale-[1.03]">
              <img src={c.image} alt={c.name} className={`w-full h-full object-contain ${c.id === "diamond" ? "scale-[1.05]" : ""}`} />
            </div>
            <div className="font-bold text-sm">{c.name}</div>
            <div className="mt-1 inline-flex items-center gap-1 px-3 py-1 rounded-full gold-gradient text-xs font-bold">
              <Star className="w-3.5 h-3.5" fill="currentColor" />{c.price}
            </div>
          </button>
        ))}
      </div>
      <CaseOpenModal caseData={active} open={!!active} onClose={() => setActive(null)} />
    </div>
  );
}
