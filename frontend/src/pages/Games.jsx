import React from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { Rocket, Bomb, Coins, Disc3 } from "lucide-react";

const card = (to, Icon, title, desc, color) => (
  <Link key={to} to={to} data-testid={`game-card-${to.slice(1)}`} className="glass rounded-3xl p-4 flex flex-col items-start gap-2 hover:scale-[1.03] active:scale-95 transition-transform relative overflow-hidden">
    <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-25 blur-2xl ${color}`} />
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color}`}><Icon className="w-6 h-6 text-white" /></div>
    <div className="font-bold">{title}</div>
    <div className="text-[11px] text-white/60">{desc}</div>
  </Link>
);

export default function GamesPage() {
  const { t } = useApp();
  return (
    <div className="px-4 pb-32" data-testid="games-page">
      <h2 className="font-display text-2xl mb-3">{t("games")}</h2>
      <div className="grid grid-cols-2 gap-3">
        {card("/crash", Rocket, t("crash"), t("crashDesc"), "cherry-gradient")}
        {card("/mines", Bomb, t("mines"), t("minesDesc"), "bg-gradient-to-br from-pink-500 to-red-500")}
        {card("/slots", Coins, t("slots"), t("slotsDesc"), "bg-gradient-to-br from-yellow-400 to-pink-500")}
        {card("/wheel", Disc3, t("wheel"), t("wheelDesc"), "bg-gradient-to-br from-fuchsia-500 to-rose-500")}
      </div>
    </div>
  );
}
