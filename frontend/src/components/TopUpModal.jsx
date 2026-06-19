import React, { useState } from "react";
import { X, Star } from "lucide-react";
import api from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";

const PRESETS = [50, 100, 250, 500, 1000, 5000];

export default function TopUpModal({ open, onClose }) {
  const { t, setMode } = useApp();
  const [amount, setAmount] = useState(100);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const submit = async () => {
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
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("paymentsUnavailable"));
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" data-testid="topup-modal">
      <div className="glass w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 slide-up max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="font-display text-lg">{t("topUp")}</div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><X className="w-5 h-5" /></button>
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
          className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 outline-none mb-3"
        />
        <button onClick={submit} disabled={loading} data-testid="topup-confirm-btn" className="btn-cherry w-full">
          {loading ? "..." : `${t("topUp")} ${amount} ⭐`}
        </button>
      </div>
    </div>
  );
}
