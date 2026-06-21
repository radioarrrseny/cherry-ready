import React from "react";
import { useNavigate } from "react-router-dom";
import { Hourglass, ArrowLeft } from "lucide-react";
import { useApp } from "@/context/AppContext";

// Direct visits to /mines also see Coming Soon — Mines code is preserved but
// not reachable from the UI until re-enabled.
export default function MinesComingSoon() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const isRu = lang === "ru";

  const title = isRu ? "Мины скоро появятся" : "Mines are coming soon";
  const body = isRu
    ? "Сейчас мы дорабатываем баланс и исправляем ошибки. Игра станет доступна в одном из следующих обновлений."
    : "We are currently improving the balance and fixing issues. The game will become available in a future update.";
  const ok = isRu ? "Понятно" : "OK";
  const back = isRu ? "Назад к играм" : "Back to games";

  return (
    <div className="px-4 pb-32 pt-6 flex flex-col items-center text-center" data-testid="mines-coming-soon-page">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-pink-500/40 to-red-500/40 flex items-center justify-center mb-4 shadow-[0_0_30px_hsla(340,90%,55%,0.35)]">
        <Hourglass className="w-10 h-10 text-pink-100" />
      </div>
      <div className="font-display text-3xl mb-3" data-testid="mines-coming-soon-page-title">{title}</div>
      <div className="max-w-sm text-sm text-white/80 leading-relaxed mb-6" data-testid="mines-coming-soon-page-body">
        {body}
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <button
          onClick={() => navigate("/games")}
          data-testid="mines-coming-soon-page-ok"
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
