import React from "react";
import { useNavigate } from "react-router-dom";
import { Hourglass, ArrowLeft } from "lucide-react";
import { useApp } from "@/context/AppContext";

/**
 * Generic full-screen "Coming Soon" page used by /mines, /slots, /wheel routes
 * while those games are temporarily disabled. Original game files are preserved.
 */
export default function GameComingSoon({ titleRu, titleEn, bodyRu, bodyEn, testIdPrefix }) {
  const { lang } = useApp();
  const navigate = useNavigate();
  const isRu = lang === "ru";

  const title = isRu ? titleRu : titleEn;
  const body = isRu ? bodyRu : bodyEn;
  const ok = isRu ? "Понятно" : "OK";
  const back = isRu ? "Назад к играм" : "Back to games";

  return (
    <div
      className="px-4 pb-32 pt-6 flex flex-col items-center text-center"
      data-testid={`${testIdPrefix}-coming-soon-page`}
    >
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-pink-500/40 to-red-500/40 flex items-center justify-center mb-4 shadow-[0_0_30px_hsla(340,90%,55%,0.35)]">
        <Hourglass className="w-10 h-10 text-pink-100" />
      </div>
      <div
        className="font-display text-3xl mb-3"
        data-testid={`${testIdPrefix}-coming-soon-page-title`}
      >
        {title}
      </div>
      <div
        className="max-w-sm text-sm text-white/80 leading-relaxed mb-6"
        data-testid={`${testIdPrefix}-coming-soon-page-body`}
      >
        {body}
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <button
          onClick={() => navigate("/games")}
          data-testid={`${testIdPrefix}-coming-soon-page-ok`}
          className="btn-cherry w-full"
        >
          {ok}
        </button>
        <button
          onClick={() => navigate("/games")}
          className="btn-ghost w-full text-sm flex items-center justify-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          {back}
        </button>
      </div>
    </div>
  );
}
