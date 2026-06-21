import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { Rocket, Bomb, Coins, Disc3, Hourglass, X } from "lucide-react";

const PlayableCard = ({ to, Icon, title, desc, color }) => (
  <Link
    to={to}
    data-testid={`game-card-${to.slice(1)}`}
    className="glass rounded-3xl p-4 flex flex-col items-start gap-2 hover:scale-[1.03] active:scale-95 transition-transform relative overflow-hidden"
  >
    <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-25 blur-2xl ${color}`} />
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div className="font-bold">{title}</div>
    <div className="text-[11px] text-white/60">{desc}</div>
  </Link>
);

const ComingSoonCard = ({ Icon, title, comingSoonLabel, onClick, gameKey }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={`game-card-${gameKey}-coming-soon`}
    className="glass rounded-3xl p-4 flex flex-col items-start gap-2 transition-transform active:scale-95 relative overflow-hidden text-left border border-pink-500/15"
    style={{
      background:
        "linear-gradient(135deg, hsla(340,55%,12%,0.65) 0%, hsla(0,55%,16%,0.55) 100%)",
    }}
  >
    <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-25 blur-2xl bg-gradient-to-br from-pink-500 to-red-500" />
    <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-pink-500/40 to-red-500/40">
      <Icon className="w-6 h-6 text-white/40" />
    </div>
    <div className="flex items-center gap-1.5">
      <span className="font-bold text-white/70">{title}</span>
      <Hourglass className="w-3.5 h-3.5 text-pink-200/80" />
    </div>
    <div
      className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-pink-400/50 bg-pink-500/15 text-pink-200 font-bold"
      data-testid={`${gameKey}-coming-soon-badge`}
    >
      {comingSoonLabel}
    </div>
    <Hourglass
      className="absolute right-3 bottom-3 w-12 h-12 text-pink-300/15 pointer-events-none"
      strokeWidth={1.25}
    />
  </button>
);

const CS_TEXTS = {
  mines: {
    titleRu: "Мины скоро появятся",
    titleEn: "Mines are coming soon",
    bodyRu:
      "Сейчас мы дорабатываем баланс и исправляем ошибки. Игра станет доступна в одном из следующих обновлений.",
    bodyEn:
      "We are currently improving the balance and fixing issues. The game will become available in a future update.",
  },
  slots: {
    titleRu: "Слоты скоро появятся",
    titleEn: "Slots are coming soon",
    bodyRu:
      "Сейчас мы улучшаем баланс игры и исправляем ошибки. Слоты станут доступны в одном из следующих обновлений.",
    bodyEn:
      "We are currently improving the game balance and fixing issues. Slots will become available in a future update.",
  },
  wheel: {
    titleRu: "Колесо фортуны скоро появится",
    titleEn: "Wheel of Fortune is coming soon",
    bodyRu:
      "Сейчас мы улучшаем баланс игры и исправляем ошибки. Игра станет доступна в одном из следующих обновлений.",
    bodyEn:
      "We are currently improving the game balance and fixing issues. The game will become available in a future update.",
  },
};

export default function GamesPage() {
  const { t, lang } = useApp();
  const [csKey, setCsKey] = useState(null); // "mines" | "slots" | "wheel" | null

  const isRu = lang === "ru";
  const comingSoonLabel = isRu ? "Скоро" : "Coming Soon";
  const okBtn = isRu ? "Понятно" : "OK";

  const closeCs = () => setCsKey(null);
  const cs = csKey ? CS_TEXTS[csKey] : null;
  const csTitle = cs ? (isRu ? cs.titleRu : cs.titleEn) : "";
  const csBody = cs ? (isRu ? cs.bodyRu : cs.bodyEn) : "";

  return (
    <div className="px-4 pb-32" data-testid="games-page">
      <h2 className="font-display text-2xl mb-3">{t("games")}</h2>
      <div className="grid grid-cols-2 gap-3">
        <PlayableCard
          to="/crash"
          Icon={Rocket}
          title={t("crash")}
          desc={t("crashDesc")}
          color="cherry-gradient"
        />
        <ComingSoonCard
          gameKey="mines"
          Icon={Bomb}
          title={t("mines")}
          comingSoonLabel={comingSoonLabel}
          onClick={() => setCsKey("mines")}
        />
        <ComingSoonCard
          gameKey="slots"
          Icon={Coins}
          title={t("slots")}
          comingSoonLabel={comingSoonLabel}
          onClick={() => setCsKey("slots")}
        />
        <ComingSoonCard
          gameKey="wheel"
          Icon={Disc3}
          title={t("wheel")}
          comingSoonLabel={comingSoonLabel}
          onClick={() => setCsKey("wheel")}
        />
      </div>

      {csKey && (
        <div
          className="fixed inset-0 z-[55] bg-black/75 backdrop-blur-sm flex items-center justify-center px-4"
          data-testid={`${csKey}-coming-soon-modal`}
          onClick={closeCs}
        >
          <div
            className="glass w-full max-w-sm rounded-3xl p-5 slide-up text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end">
              <button
                onClick={closeCs}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
                aria-label="close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500/40 to-red-500/40 flex items-center justify-center mb-3">
              <Hourglass className="w-8 h-8 text-pink-100" />
            </div>
            <div
              className="font-display text-xl mb-2"
              data-testid={`${csKey}-coming-soon-title`}
            >
              {csTitle}
            </div>
            <div
              className="text-sm text-white/80 leading-relaxed mb-5"
              data-testid={`${csKey}-coming-soon-body`}
            >
              {csBody}
            </div>
            <button
              onClick={closeCs}
              data-testid={`${csKey}-coming-soon-ok`}
              className="btn-cherry w-full"
            >
              {okBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
