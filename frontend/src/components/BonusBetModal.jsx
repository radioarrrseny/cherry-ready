import React from "react";
import { useApp } from "@/context/AppContext";
import { AlertTriangle, X } from "lucide-react";

export default function BonusBetModal() {
  const { t, bonusPrompt } = useApp();
  if (!bonusPrompt) return null;
  const { onConfirm, onCancel } = bonusPrompt;
  return (
    <div
      className="fixed inset-0 z-[55] bg-black/75 backdrop-blur-sm flex items-center justify-center px-4"
      data-testid="bonus-bet-modal"
      onClick={onCancel}
    >
      <div
        className="glass w-full max-w-sm rounded-3xl p-5 slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-300" />
            <div className="font-display text-lg" data-testid="bonus-bet-title">
              {t("bonusBetTitle")}
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
            aria-label="close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="text-sm text-white/85 leading-relaxed mb-4" data-testid="bonus-bet-body">
          {t("bonusBetBody")}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            data-testid="bonus-bet-cancel"
            className="btn-ghost flex-1"
          >
            {t("cancelBtn")}
          </button>
          <button
            onClick={onConfirm}
            data-testid="bonus-bet-continue"
            className="btn-cherry flex-1"
          >
            {t("continueBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
