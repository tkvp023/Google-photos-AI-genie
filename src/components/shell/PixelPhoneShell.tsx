"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Wifi, Signal } from "lucide-react";
import { BottomNav } from "@/components/ui/BottomNav";
import { Toast } from "@/components/ui/Toast";
import { useGuide } from "@/context/GuideContext";
import { GuideToggleBar } from "./GuideToggleBar";
import { OuterGuideLayout } from "./OuterGuidePanels";

interface PixelPhoneShellProps {
  children: React.ReactNode;
}

export function PixelPhoneShell({ children }: PixelPhoneShellProps) {
  const pathname = usePathname();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { isGuideOn } = useGuide();

  const isConsole = pathname.startsWith("/moderator") || pathname.startsWith("/admin");
  const showBottomNav = pathname === "/";

  const handleInertClick = (_name: string) => {
    setToastMessage("Not part of this prototype");
  };

  // Moderator & Admin consoles render in a clean, spacious desktop view
  if (isConsole) {
    return (
      <div className="w-full min-h-screen bg-[#f8f9fa] flex flex-col items-center p-2 sm:p-6 overflow-y-auto">
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-md border border-[#e3e5e8] overflow-hidden flex flex-col">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-screen max-h-screen bg-[#eaedf1] flex flex-col items-center justify-center p-2 sm:p-4 select-none overflow-hidden font-sans"
      suppressHydrationWarning
    >
      {/* Top Floating Toggle Bar with Normal Mode / Guide Mode Switch */}
      <GuideToggleBar />

      {/* Main Container: Side Callouts in White Space + Phone Chassis in Center */}
      <OuterGuideLayout isGuideOn={isGuideOn}>
        {/* Outer Phone Chassis — Google Pixel Silhouette */}
        <div
          className="relative w-full max-w-[400px] h-full max-h-[860px] bg-[#1a1a1a] rounded-[50px] p-[10px] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.1)] flex flex-col transition-all flex-shrink-0"
          suppressHydrationWarning
        >
          {/* Subtle Pixel Hardware Buttons on right bezel */}
          <div className="hidden sm:block absolute -right-[3px] top-28 w-[3px] h-10 bg-[#2d2d2d] rounded-r-md shadow-sm" />
          <div className="hidden sm:block absolute -right-[3px] top-44 w-[3px] h-16 bg-[#2d2d2d] rounded-r-md shadow-sm" />

          {/* Pixel Inner Screen Bezel */}
          <div className="relative w-full h-full bg-[#1b1512] rounded-[40px] overflow-hidden flex flex-col shadow-inner">
            {/* 1. Android Status Bar (with Centered Punch-Hole Camera) */}
            <div className="h-8.5 w-full bg-[#1b1512] flex items-center justify-between px-6 z-30 flex-shrink-0 select-none border-b border-transparent text-white">
              {/* Clock */}
              <span className="text-[12.5px] font-semibold text-white tracking-tight">10:12</span>

              {/* Pixel Signature Centered Camera Hole Punch */}
              <div className="w-3.5 h-3.5 rounded-full bg-[#0a0a0a] ring-2 ring-[#222]/40 shadow-inner flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-[#1e293b]/70" />
              </div>

              {/* System Status Indicators */}
              <div className="flex items-center gap-1.5 text-white/90">
                <Wifi className="w-3.5 h-3.5" />
                <Signal className="w-3.5 h-3.5" />
                <span className="text-[11px] font-semibold tracking-tighter">54%</span>
              </div>
            </div>

            {/* 2. Phone Screen Body (Scrollable Viewport + Floating Navigation) */}
            <div className="flex-1 relative w-full overflow-hidden flex flex-col bg-[#1b1512]">
              {/* Scrollable Page Container */}
              <div
                id="phone-screen-scroll"
                className="absolute inset-0 overflow-y-auto overflow-x-hidden no-scrollbar bg-[#1b1512]"
              >
                {children}
              </div>

              {/* 3. Floating Bottom Navigation (Dock & Search FAB) */}
              {showBottomNav && <BottomNav onInertClick={handleInertClick} />}

              {/* Interactive Feedback Toast */}
              <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
            </div>

            {/* 4. Android Bottom Gesture Navigation Pill */}
            <div className="h-5 w-full bg-[#1b1512] flex items-center justify-center z-30 flex-shrink-0 pb-1 select-none">
              <div className="w-28 h-1 bg-white/60 rounded-full opacity-90" />
            </div>
          </div>
        </div>
      </OuterGuideLayout>
    </div>
  );
}
