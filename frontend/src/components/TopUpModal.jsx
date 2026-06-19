import React, { useState } from "react";
import { X, Shield, Send, Star, Zap, MessageCircle } from "lucide-react";
import api from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";

const PRESETS = [50, 100, 250, 500, 1000, 5000];

const COPY = {
  ru: {
    chooseTitle: "Пополнение баланса",
    starsBtn: "Пополнить звёздами",
    starsBtnDesc: "Telegram Stars напрямую",
    adminBtn: "Админ-пополнение",
    adminBtnDesc: "Связаться с @RadioArseny",
    starsModalTitle: "Пополнить звёздами",
    starsConfirm: "Оплатить",
    adminTitle: "Админ-пополнение",
    adminCloseBtn: "Закрыть",
    adminContactBtn: "Связаться с @RadioArseny",
    adminBody: [
      "Для ручного пополнения свяжитесь с @RadioArseny в Telegram.",
      "Вы можете отправить Telegram Stars напрямую, и после проверки они будут зачислены на ваш баланс в ближайшее время.",
      "Также можно отправить Telegram-подарок. Его стоимость будет оценена по актуальной рыночной цене, а эквивалентное количество Stars будет начислено на ваш баланс.",
      "Перед отправкой подарка рекомендуется заранее уточнить его примерную стоимость у @RadioArseny.",
    ],
  },
  en: {
    chooseTitle: "Balance Top-Up",
    starsBtn: "Top up with Stars",
    starsBtnDesc: "Pay via Telegram Stars",
    adminBtn: "Admin Top-Up",
    adminBtnDesc: "Contact @RadioArseny",
    starsModalTitle: "Top up with Stars",
    starsConfirm: "Pay",
    adminTitle: "Admin Top-Up",
    adminCloseBtn: "Close",
    adminContactBtn: "Contact @RadioArseny",
    adminBody: [
      "To top up manually, contact @RadioArseny on Telegram.",
      "You can send Telegram Stars directly, and after verification they will be credited to your balance as soon as possible.",
      "You can also send a Telegram Gift. Its value will be estimated using the current market price, and the equivalent amount of Stars will be credited to your balance.",
      "Before sending a gift, it is recommended to confirm its estimated value with @RadioArseny.",
    ],
  },
};

export default function TopUpModal({ open, onClose }) {
  const { t, lang, setMode } = useApp();
  const c = COPY[lang] || COPY.ru;

  const [stage, setStage] = useState("choose"); // "choose" | "stars" | "admin"
  const [amount, setAmount] = useState(100);
  const [loading, setLoading] = useState(false);

  const [promo, setPromo] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);

  const [adminOpen, setAdminOpen] = useState(false);
  const [adminSecret, setAdminSecret] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);

  if (!open && !adminOpen) return null;

  const reset = () => {
    setStage("choose"); setAmount(100); setPromo(""); setLoading(false);
  };

  const close = () => { reset(); onClose(); };

  const payStars = async () => {
    setLoading(true);
    try {
      const r = await api.post("/payments/create-invoice", { amount });
      const link = r.data.invoice_link;
      const tg = window.Telegram?.WebApp;
      if (tg?.openInvoice) {
        tg.openInvoice(link, () => { /* status callback */ });
      } else {
        window.open(link, "_blank");
      }
      setMode("real");
      close();
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("paymentsUnavailable"));
    } finally { setLoading(false); }
  };

  const applyPromo = async () => {
    const code = promo.trim();
    if (!code) return;
    if (code === "/admin") {
      setPromo("");
      setAdminOpen(true);
      return;
    }
    setPromoBusy(true);
    try {
      toast.error("Promo code not found");
    } finally {
      setPromoBusy(false);
    }
  };

  const submitAdminSecret = async () => {
    const s = adminSecret.trim();
    if (!s) return;
    setAdminBusy(true);
    try {
      await api.post("/admin/verify", { secret: s });
      localStorage.setItem("cc_admin_secret", s);
      setAdminOpen(false);
      setAdminSecret("");
      close();
      window.location.href = "/admin";
    } catch (e) {
      toast.error("Invalid admin secret");
    } finally {
      setAdminBusy(false);
    }
  };

  // ── Stage views ─────────────────────────────────────────────────────────────
  const ChooseStage = (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="font-display text-lg" data-testid="topup-choose-title">{c.chooseTitle}</div>
        <button onClick={close} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center" aria-label="close">
          <X className="w-5 h-5" />
        </button>
      </div>
      <button
        onClick={() => setStage("stars")}
        data-testid="topup-choice-stars"
        className="w-full mb-3 rounded-2xl p-4 cherry-gradient text-white text-left active:scale-[0.98] transition-transform shadow-[0_0_20px_hsla(340,90%,55%,0.35)]"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="font-bold leading-tight">{c.starsBtn}</div>
            <div className="text-xs opacity-90">{c.starsBtnDesc}</div>
          </div>
        </div>
      </button>
      <button
        onClick={() => setStage("admin")}
        data-testid="topup-choice-admin"
        className="w-full rounded-2xl p-4 bg-white/5 border border-white/10 text-left active:scale-[0.98] transition-transform hover:bg-white/8"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-pink-500/15 text-pink-300 flex items-center justify-center">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="font-bold leading-tight text-white">{c.adminBtn}</div>
            <div className="text-xs opacity-70 text-white">{c.adminBtnDesc}</div>
          </div>
        </div>
      </button>
    </>
  );

  const StarsStage = (
    <>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setStage("choose")} data-testid="topup-back-from-stars" className="text-xs text-white/60 hover:text-white">‹ {c.chooseTitle}</button>
        <div className="font-display text-lg" data-testid="topup-stars-title">{c.starsModalTitle}</div>
        <button onClick={close} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center" aria-label="close">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {PRESETS.map((p) => (
          <button key={p} onClick={() => setAmount(p)} data-testid={`topup-preset-${p}`} className={`btn-ghost text-sm ${amount === p ? "ring-2 ring-pink-400" : ""}`}>
            <div className="flex items-center justify-center gap-1"><Star className="w-3.5 h-3.5 text-gold" fill="currentColor" />{p}</div>
          </button>
        ))}
      </div>
      <input
        type="number" min={1} value={amount}
        onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value || "1", 10)))}
        data-testid="topup-amount-input"
        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 outline-none mb-3 text-white"
      />
      <button
        onClick={payStars}
        disabled={loading}
        data-testid="topup-confirm-btn"
        className="btn-cherry w-full mb-4 flex items-center justify-center gap-2"
      >
        <Star className="w-4 h-4" fill="currentColor" />
        {loading ? "..." : `${c.starsConfirm} ${amount} ⭐`}
      </button>

      {/* Promo Code — lives ONLY in stars stage */}
      <div className="border-t border-white/10 pt-3" data-testid="promo-row">
        <div className="text-[10px] uppercase tracking-widest text-white/60 mb-2">Promo Code</div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applyPromo(); }}
            placeholder="Enter promo code"
            data-testid="promo-input"
            className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink-500/50"
          />
          <button
            onClick={applyPromo}
            disabled={promoBusy}
            data-testid="promo-apply-btn"
            className="btn-cherry !py-2 !px-3 text-xs"
          >
            Apply
          </button>
        </div>
      </div>
    </>
  );

  const AdminStage = (
    <>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setStage("choose")} data-testid="topup-back-from-admin" className="text-xs text-white/60 hover:text-white">‹ {c.chooseTitle}</button>
        <div className="font-display text-lg" data-testid="topup-admin-title">{c.adminTitle}</div>
        <button onClick={close} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center" aria-label="close">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="text-sm text-white/85 leading-relaxed mb-4 space-y-3" data-testid="topup-admin-body">
        {c.adminBody.map((p, i) => <p key={i}>{p}</p>)}
      </div>
      <div className="flex flex-col gap-2">
        <a
          href="https://t.me/RadioArseny"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="topup-admin-contact"
          className="btn-cherry w-full flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          {c.adminContactBtn}
        </a>
        <button
          onClick={close}
          data-testid="topup-admin-close"
          className="btn-ghost w-full"
        >
          {c.adminCloseBtn}
        </button>
      </div>
    </>
  );

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
          data-testid="topup-modal"
        >
          <div className="glass w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 slide-up max-h-[85vh] overflow-y-auto">
            {stage === "choose" && ChooseStage}
            {stage === "stars" && StarsStage}
            {stage === "admin" && AdminStage}
          </div>
        </div>
      )}

      {/* Hidden Admin Access modal — reachable via promo "/admin" in stars stage */}
      {adminOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4"
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
              onKeyDown={(e) => { if (e.key === "Enter") submitAdminSecret(); }}
              placeholder="Enter admin secret"
              data-testid="admin-modal-input"
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 mb-3 outline-none focus:border-pink-500/50 text-white"
              autoFocus
            />
            <button
              onClick={submitAdminSecret}
              disabled={adminBusy}
              data-testid="admin-modal-submit"
              className="btn-cherry w-full"
            >
              Open Admin Panel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
