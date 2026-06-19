import React, { useState } from "react";
import { X, Shield, Send } from "lucide-react";
import api from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";

export default function TopUpModal({ open, onClose }) {
  const { t, lang } = useApp();

  const [promo, setPromo] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminSecret, setAdminSecret] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);

  if (!open && !adminOpen) return null;

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

  const submitAdmin = async () => {
    const s = adminSecret.trim();
    if (!s) return;
    setAdminBusy(true);
    try {
      await api.post("/admin/verify", { secret: s });
      localStorage.setItem("cc_admin_secret", s);
      setAdminOpen(false);
      setAdminSecret("");
      onClose();
      window.location.href = "/admin";
    } catch (e) {
      toast.error("Invalid admin secret");
    } finally {
      setAdminBusy(false);
    }
  };

  const title = lang === "ru" ? "Пополнение баланса" : "Balance Top-Up";

  // Long-form copy — kept verbatim per spec.
  const ruBody = (
    <>
      <p className="mb-3">
        Для пополнения баланса свяжитесь с{" "}
        <a
          href="https://t.me/RadioArseny"
          target="_blank"
          rel="noopener noreferrer"
          className="text-pink-300 font-semibold hover:underline"
          data-testid="contact-admin-link"
        >
          @RadioArseny
        </a>{" "}
        в Telegram.
      </p>
      <p className="mb-3">
        Вы можете отправить Telegram Stars напрямую, после чего они будут зачислены на ваш баланс
        вручную в кратчайшие сроки.
      </p>
      <p className="mb-3">
        Также вы можете отправить Telegram-подарок. В этом случае стоимость подарка будет оценена по
        его актуальной рыночной цене, а эквивалентное количество Stars будет зачислено на ваш
        баланс.
      </p>
      <p className="mb-3">
        После обработки вы получите Stars на игровой баланс и сможете использовать их для открытия
        кейсов и участия в играх.
      </p>
      <div className="rounded-2xl border border-pink-500/20 bg-pink-500/5 p-3 text-xs leading-relaxed">
        <div className="font-bold mb-1 text-pink-200">Важно:</div>
        <ul className="space-y-1 list-disc list-inside text-white/85">
          <li>Зачисление производится вручную.</li>
          <li>Время обработки обычно составляет от нескольких минут до нескольких часов.</li>
          <li>
            Перед отправкой подарка рекомендуется уточнить его оценочную стоимость у @RadioArseny.
          </li>
        </ul>
      </div>
    </>
  );

  const enBody = (
    <>
      <p className="mb-3">
        To top up your balance, contact{" "}
        <a
          href="https://t.me/RadioArseny"
          target="_blank"
          rel="noopener noreferrer"
          className="text-pink-300 font-semibold hover:underline"
          data-testid="contact-admin-link"
        >
          @RadioArseny
        </a>{" "}
        on Telegram.
      </p>
      <p className="mb-3">
        You can send Telegram Stars directly, and they will be manually credited to your balance as
        soon as possible.
      </p>
      <p className="mb-3">
        You can also send a Telegram Gift. The gift will be evaluated using its current market
        value, and the equivalent amount of Stars will be credited to your account.
      </p>
      <p className="mb-3">
        Once processed, the Stars will be added to your balance and can be used for cases and games.
      </p>
      <div className="rounded-2xl border border-pink-500/20 bg-pink-500/5 p-3 text-xs leading-relaxed">
        <div className="font-bold mb-1 text-pink-200">Important:</div>
        <ul className="space-y-1 list-disc list-inside text-white/85">
          <li>Top-ups are processed manually.</li>
          <li>Processing usually takes from a few minutes to several hours.</li>
          <li>
            Before sending a gift, it is recommended to confirm its estimated value with
            @RadioArseny.
          </li>
        </ul>
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
            <div className="flex items-center justify-between mb-3">
              <div className="font-display text-lg" data-testid="topup-title">
                {title}
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-sm text-white/85 leading-relaxed mb-4" data-testid="topup-body">
              {lang === "ru" ? ruBody : enBody}
            </div>

            <a
              href="https://t.me/RadioArseny"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="contact-admin-btn"
              className="btn-cherry w-full flex items-center justify-center gap-2 mb-4"
            >
              <Send className="w-4 h-4" />
              {lang === "ru" ? "Написать @RadioArseny" : "Message @RadioArseny"}
            </a>

            {/* Promo Code field — English UI, lives only here */}
            <div className="border-t border-white/10 pt-3" data-testid="promo-row">
              <div className="text-[10px] uppercase tracking-widest text-white/60 mb-2">
                Promo Code
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={promo}
                  onChange={(e) => setPromo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyPromo();
                  }}
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
          </div>
        </div>
      )}

      {/* Hidden Admin Access modal — reachable via promo "/admin" */}
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
                <div className="font-display text-lg" data-testid="admin-modal-title">
                  Admin Access
                </div>
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
              onKeyDown={(e) => {
                if (e.key === "Enter") submitAdmin();
              }}
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
    </>
  );
}
