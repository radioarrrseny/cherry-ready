import React from "react";
import { useApp } from "@/context/AppContext";
import { Star, Sparkles, Plus } from "lucide-react";

export default function TopBar({ onTopUp }) {
  const { user, mode, setMode, balance, t } = useApp();
  const display = (balance || 0).toLocaleString();
  const isDemo = mode === "demo";

  const badgeCls = isDemo
    ? "bg-yellow-400/15 text-yellow-300 border-yellow-400/30"
    : "bg-pink-500/15 text-pink-300 border-pink-500/30";

  return (
    <div className="px-4 pt-3 pb-2" data-testid="top-bar">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full cherry-gradient flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-display text-lg leading-none" data-testid="app-title">Cherry Case</div>
            <div className="text-[10px] uppercase tracking-widest opacity-70">{user?.first_name || user?.username || "Guest"}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode(isDemo ? "real" : "demo")}
            data-testid="mode-badge"
            className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border transition-all active:scale-95 ${badgeCls}`}
            aria-label="toggle mode"
          >
            {isDemo ? t("demoMode") : t("realMode")}
          </button>
          <div className="glass px-3 py-1.5 rounded-full flex items-center gap-1.5" data-testid="balance">
            <Star className="w-4 h-4 star-icon" fill="currentColor" />
            <span className="font-bold text-sm">{display}</span>
            <button
              onClick={onTopUp}
              data-testid="top-up-btn"
              className="ml-1 w-6 h-6 rounded-full cherry-gradient flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
              aria-label="top up"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
