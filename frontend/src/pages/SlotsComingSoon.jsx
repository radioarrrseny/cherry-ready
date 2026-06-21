import React from "react";
import GameComingSoon from "@/components/GameComingSoon";

// Direct visits to /slots see Coming Soon — Slots.jsx and backend slots code preserved.
export default function SlotsComingSoon() {
  return (
    <GameComingSoon
      testIdPrefix="slots"
      titleRu="Слоты скоро появятся"
      titleEn="Slots are coming soon"
      bodyRu="Сейчас мы улучшаем баланс игры и исправляем ошибки. Слоты станут доступны в одном из следующих обновлений."
      bodyEn="We are currently improving the game balance and fixing issues. Slots will become available in a future update."
    />
  );
}
