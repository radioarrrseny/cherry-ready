import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { Package, Gamepad2, Backpack, User } from "lucide-react";

export default function BottomNav() {
  const { t } = useApp();
  const loc = useLocation();
  const gamesActive = ["/games", "/crash", "/mines", "/slots", "/wheel"].some(p => loc.pathname.startsWith(p));
  const items = [
    { to: "/", icon: Package, label: t("cases"), tid: "nav-cases", end: true },
    { to: "/games", icon: Gamepad2, label: "Games", tid: "nav-games", forceActive: gamesActive },
    { to: "/inventory", icon: Backpack, label: t("inventory"), tid: "nav-inventory" },
    { to: "/profile", icon: User, label: t("profile"), tid: "nav-profile" },
  ];
  return (
    <nav className="fixed left-0 right-0 bottom-0 z-40 safe-bottom" data-testid="bottom-nav">
      <div className="mx-2 mb-2 glass rounded-3xl p-1.5 flex justify-between">
        {items.map(({ to, icon: Icon, label, tid, end, forceActive }) => (
          <NavLink key={to} to={to} end={end} data-testid={tid}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 rounded-2xl transition-all ${(isActive || forceActive) ? "cherry-gradient text-white shadow-lg" : "text-white/60 hover:text-white"}`}>
            <Icon className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-semibold tracking-wide">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
