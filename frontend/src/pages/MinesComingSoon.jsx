import React from "react";
import GameComingSoon from "@/components/GameComingSoon";

// Direct visits to /mines see Coming Soon — Mines code is preserved.
export default function MinesComingSoon() {
  return (
    <GameComingSoon
      testIdPrefix="mines"
      titleRu="Мины скоро появятся"
      titleEn="Mines are coming soon"
      bodyRu="Сейчас мы дорабатываем баланс и исправляем ошибки. Игра станет доступна в одном из следующих обновлений."
      bodyEn="We are currently improving the balance and fixing issues. The game will become available in a future update."
    />
  );
}
