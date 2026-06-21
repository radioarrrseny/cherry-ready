import React, { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AppProvider, useApp } from "@/context/AppContext";
import TopBar from "@/components/TopBar";
import LiveDrops from "@/components/LiveDrops";
import BottomNav from "@/components/BottomNav";
import TopUpModal from "@/components/TopUpModal";
import BonusBetModal from "@/components/BonusBetModal";
import CasesPage from "@/pages/Cases";
import CrashPage from "@/pages/Crash";
// Mines / Slots / Wheel temporarily disabled — UI routes show Coming Soon screens.
// Original game files and backend endpoints are preserved and will be re-enabled later.
import MinesComingSoon from "@/pages/MinesComingSoon";
import SlotsComingSoon from "@/pages/SlotsComingSoon";
import WheelComingSoon from "@/pages/WheelComingSoon";
import InventoryPage from "@/pages/Inventory";
import ProfilePage from "@/pages/Profile";
import GamesPage from "@/pages/Games";
import AdminPage from "@/pages/Admin";

function Shell() {
  const { loading } = useApp();
  const [topupOpen, setTopupOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="font-display text-2xl text-cherry pulse-glow rounded-full px-6 py-3 cherry-gradient">Cherry Case</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen pb-20">
        <TopBar onTopUp={() => setTopupOpen(true)} />
        <LiveDrops />
        <Routes>
          <Route path="/" element={<CasesPage />} />
          <Route path="/games" element={<GamesPage />} />
          <Route path="/crash" element={<CrashPage />} />
          <Route path="/mines" element={<MinesComingSoon />} />
          <Route path="/slots" element={<SlotsComingSoon />} />
          <Route path="/wheel" element={<WheelComingSoon />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
        <BottomNav />
        <TopUpModal open={topupOpen} onClose={() => setTopupOpen(false)} />
        <BonusBetModal />
        <Toaster theme="dark" position="top-center" toastOptions={{ style: { background: "hsla(340,30%,15%,0.95)", border: "1px solid hsla(340,60%,55%,0.3)", color: "white" } }} />
      </div>
    </BrowserRouter>
  );
}

export default function App() {
  // Admin route bypasses Telegram auth provider
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
        <Toaster theme="dark" position="top-center" toastOptions={{ style: { background: "hsla(340,30%,15%,0.95)", border: "1px solid hsla(340,60%,55%,0.3)", color: "white" } }} />
      </BrowserRouter>
    );
  }
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
