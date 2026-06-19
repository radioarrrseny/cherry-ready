import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { Star, Sparkles, Plus, Shield, X } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function TopBar({ onTopUp }) {
  const { user, mode, setMode, balance, t } = useApp();
  const display = (balance || 0).toLocaleString();
  const isDemo = mode === "demo";

  const [promo, setPromo] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminSecret, setAdminSecret] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);

  const badgeCls = isDemo
    ? "bg-yellow-400/15 text-yellow-300 border-yellow-400/30"
    : "bg-pink-500/15 text-pink-300 border-pink-500/30";

  const applyPromo = async () => {
    const code = promo.trim();
    if (!code) return;
    if (code === "/admin") {
      setAdminOpen(true);
      setPromo("");
      return;
    }
    setPromoBusy(true);
    try {
      // No real promo codes yet — backend has no endpoint, so we treat all as unknown.
      // (We intentionally do NOT call any endpoint to avoid 404 noise in logs.)
      toast.error("Promo code not found");
    } finally {
      setPromoBusy(false);
    }
  };

  const submitAdmin = async () => {
    const s = adminSecret.trim();
    if (!s) return;
    setAdminBusy(true);
    try {
      await api.post("/admin/verify", { secret: s });
      // Store secret for Admin page interceptor and navigate
      localStorage.setItem("cc_admin_secret", s);
      setAdminOpen(false);
      setAdminSecret("");
      window.location.href = "/admin";
    } catch (e) {
      toast.error("Invalid admin secret");
    } finally {
      setAdminBusy(false);
    }
  };

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

      {/* Promo Code field */}
      <div className="mt-2 glass rounded-2xl px-3 py-2 flex items-center gap-2" data-testid="promo-row">
        <div className="text-[10px] uppercase tracking-widest text-white/60 whitespace-nowrap">Promo Code</div>
        <input
          type="text"
          value={promo}
          onChange={(e) => setPromo(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") applyPromo(); }}
          placeholder="Enter promo code"
          data-testid="promo-input"
          className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white outline-none focus:border-pink-500/50"
        />
        <button
          onClick={applyPromo}
          disabled={promoBusy}
          data-testid="promo-apply-btn"
          className="btn-cherry !py-1.5 !px-3 text-xs"
        >
          Apply
        </button>
      </div>

      {/* Hidden Admin Access modal */}
      {adminOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4"
          data-testid="admin-modal"
          onClick={() => !adminBusy && setAdminOpen(false)}
        >
          <div
            className="glass w-full max-w-sm rounded-3xl p-5 slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-pink-400" />
                <div className="font-display text-lg" data-testid="admin-modal-title">Admin Access</div>
              </div>
              <button
                onClick={() => setAdminOpen(false)}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
                aria-label="close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="password"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitAdmin(); }}
              placeholder="Enter admin secret"
              data-testid="admin-modal-input"
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 mb-3 outline-none focus:border-pink-500/50 text-white"
              autoFocus
            />
            <button
              onClick={submitAdmin}
              disabled={adminBusy}
              data-testid="admin-modal-submit"
              className="btn-cherry w-full"
            >
              Open Admin Panel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
