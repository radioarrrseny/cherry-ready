import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { Rocket, Bomb, Coins, Disc3, Hourglass, X } from "lucide-react";

const PlayableCard = ({ to, Icon, title, desc, color }) => (
  <Link
    key={to}
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

const ComingSoonCard = ({ Icon, title, comingSoonLabel, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid="game-card-mines-coming-soon"
    className="glass rounded-3xl p-4 flex flex-col items-start gap-2 transition-transform active:scale-95 relative overflow-hidden text-left border border-pink-500/15"
    style={{
      background:
        "linear-gradient(135deg, hsla(340,55%,12%,0.65) 0%, hsla(0,55%,16%,0.55) 100%)",
    }}
  >
    {/* glow */}
    <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-25 blur-2xl bg-gradient-to-br from-pink-500 to-red-500" />
    {/* faded base icon */}
    <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-pink-500/40 to-red-500/40">
      <Icon className="w-6 h-6 text-white/40" />
    </div>
    {/* title row with hourglass */}
    <div className="flex items-center gap-1.5">
      <span className="font-bold text-white/70">{title}</span>
      <Hourglass className="w-3.5 h-3.5 text-pink-200/80" />
    </div>
    {/* Coming Soon badge */}
    <div
      className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-pink-400/50 bg-pink-500/15 text-pink-200 font-bold"
      data-testid="mines-coming-soon-badge"
    >
      {comingSoonLabel}
    </div>
    {/* big translucent hourglass watermark */}
    <Hourglass
      className="absolute right-3 bottom-3 w-12 h-12 text-pink-300/15 pointer-events-none"
      strokeWidth={1.25}
    />
  </button>
);

export default function GamesPage() {
  const { t, lang } = useApp();
  const [csOpen, setCsOpen] = useState(false);

  const isRu = lang === "ru";
  const comingSoonLabel = isRu ? "Скоро" : "Coming Soon";
  const csTitle = isRu ? "Мины скоро появятся" : "Mines are coming soon";
  const csBody = isRu
    ? "Сейчас мы дорабатываем баланс и исправляем ошибки. Игра станет доступна в одном из следующих обновлений."
    : "We are currently improving the balance and fixing issues. The game will become available in a future update.";
  const csOk = isRu ? "Понятно" : "OK";

  return (
    <div className="px-4 pb-32" data-testid="games-page">
      <h2 className="font-display text-2xl mb-3">{t("games")}</h2>
      <div className="grid grid-cols-2 gap-3">
        <PlayableCard to="/crash" Icon={Rocket} title={t("crash")} desc={t("crashDesc")} color="cherry-gradient" />
        <ComingSoonCard
          Icon={Bomb}
          title={t("mines")}
          comingSoonLabel={comingSoonLabel}
          onClick={() => setCsOpen(true)}
        />
        <PlayableCard to="/slots" Icon={Coins} title={t("slots")} desc={t("slotsDesc")} color="bg-gradient-to-br from-yellow-400 to-pink-500" />
        <PlayableCard to="/wheel" Icon={Disc3} title={t("wheel")} desc={t("wheelDesc")} color="bg-gradient-to-br from-fuchsia-500 to-rose-500" />
      </div>

      {csOpen && (
        <div
          className="fixed inset-0 z-[55] bg-black/75 backdrop-blur-sm flex items-center justify-center px-4"
          data-testid="mines-coming-soon-modal"
          onClick={() => setCsOpen(false)}
        >
          <div
            className="glass w-full max-w-sm rounded-3xl p-5 slide-up text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end">
              <button
                onClick={() => setCsOpen(false)}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
                aria-label="close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500/40 to-red-500/40 flex items-center justify-center mb-3">
              <Hourglass className="w-8 h-8 text-pink-100" />
            </div>
            <div className="font-display text-xl mb-2" data-testid="mines-coming-soon-title">
              {csTitle}
            </div>
            <div className="text-sm text-white/80 leading-relaxed mb-5" data-testid="mines-coming-soon-body">
              {csBody}
            </div>
            <button
              onClick={() => setCsOpen(false)}
              data-testid="mines-coming-soon-ok"
              className="btn-cherry w-full"
            >
              {csOk}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
