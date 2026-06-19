import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Star, X } from "lucide-react";
import { toast } from "sonner";

export default function InventoryPage() {
  const { t, mode, setUser, refreshUser } = useApp();
  const [items, setItems] = useState([]);
  const [withdrawItem, setWithdrawItem] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  const load = async () => {
    try { const r = await api.get(`/inventory?mode=${mode}`); setItems(r.data.items || []); } catch (e) {}
  };
  useEffect(() => { load(); }, [mode]);

  const sell = async (item) => {
    try {
      const r = await api.post("/inventory/sell", { item_id: item.id, mode });
      if (r.data.user) setUser(r.data.user);
      toast.success(`+${r.data.sell_value} ⭐`);
      load();
    } catch (e) { toast.error(t("failed")); }
  };

  const doWithdraw = async () => {
    if (!withdrawItem) return;
    try {
      await api.post("/inventory/withdraw", { item_id: withdrawItem.id });
      setConfirmed(true);
      refreshUser();
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("failed"));
    }
  };

  const withdrawStatusText = (s) => ({
    pending: t("wdPending"),
    approved: t("wdApproved"),
    sent: t("wdSent"),
    rejected: t("wdRejected"),
  })[s] || s;

  return (
    <div className="px-4 pb-32" data-testid="inventory-page">
      <h2 className="font-display text-2xl mb-3">{t("inventory")}</h2>
      {items.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-center text-white/70">{t("inventoryEmpty")}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((it) => (
            <div key={it.id} className="glass rounded-2xl p-3 flex flex-col items-center" data-testid="inventory-item">
              <img src={it.image} alt={it.name} className="w-20 h-20 rounded-xl object-cover mb-2" />
              <div className="font-semibold text-sm text-center line-clamp-1">{it.name}</div>
              <div className="flex items-center gap-1 text-gold font-bold text-sm mb-2">
                <Star className="w-3.5 h-3.5" fill="currentColor" />{it.value}
              </div>
              <div className="flex gap-1.5 w-full">
                <button onClick={() => sell(it)} data-testid={`sell-${it.id}`} className="flex-1 btn-ghost text-xs !py-1.5">
                  {t("sell")} +{Math.round(it.value * 1.05)}
                </button>
                <button
                  onClick={() => { setWithdrawItem(it); setConfirmed(false); }}
                  data-testid={`withdraw-${it.id}`}
                  className="flex-1 btn-cherry text-xs !py-1.5"
                >
                  {t("withdraw")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {withdrawItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" data-testid="withdraw-modal">
          <div className="glass w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 slide-up">
            <div className="flex items-center justify-between mb-4">
              <div className="font-display text-lg">{t("withdrawGift")}</div>
              <button onClick={() => setWithdrawItem(null)} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex flex-col items-center text-center">
              <img src={withdrawItem.image} alt={withdrawItem.name} className="w-28 h-28 rounded-2xl object-cover mb-3" />
              <div className="font-bold text-lg">{withdrawItem.name}</div>
              <div className="flex items-center gap-1 text-gold font-bold mb-4">
                <Star className="w-4 h-4" fill="currentColor" />{withdrawItem.value}
              </div>
              {confirmed ? (
                <div className="text-green-400 font-semibold py-3" data-testid="withdraw-success-msg">{t("withdrawCreated")}</div>
              ) : (
                <button onClick={doWithdraw} data-testid="confirm-withdraw-btn" className="btn-cherry w-full">{t("confirm")}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
