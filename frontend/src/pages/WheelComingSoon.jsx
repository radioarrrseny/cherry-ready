import React from "react";
import GameComingSoon from "@/components/GameComingSoon";

// Direct visits to /wheel see Coming Soon — Wheel.jsx and backend wheel code preserved.
export default function WheelComingSoon() {
  return (
    <GameComingSoon
      testIdPrefix="wheel"
      titleRu="Колесо фортуны скоро появится"
      titleEn="Wheel of Fortune is coming soon"
      bodyRu="Сейчас мы улучшаем баланс игры и исправляем ошибки. Игра станет доступна в одном из следующих обновлений."
      bodyEn="We are currently improving the game balance and fixing issues. The game will become available in a future update."
    />
  );
}
