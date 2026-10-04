// src/components/ui/GuideCard.tsx
// A4: Welcome / guide card shown at S1 (Home) when ?guide=on (default).
// Dismissible per-session (sessionStorage). Uses aria-live so it doesn't
// steal focus or cause layout shift on appearance.
"use client";

import React, { useEffect, useState } from "react";

const DISMISS_KEY = "gp_guide_card_dismissed";

interface GuideCardProps {
  /** Whether guide mode is active at all (A1 switch) */
  isGuideOn: boolean;
}

export function GuideCard({ isGuideOn }: GuideCardProps) {
  const [isDismissed, setIsDismissed] = useState(true); // start hidden to avoid flash

  useEffect(() => {
    if (!isGuideOn) {
      setIsDismissed(true);
      return;
    }
    try {
      setIsDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setIsDismissed(false);
    }
  }, [isGuideOn]);

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setIsDismissed(true);
  };

  if (!isGuideOn || isDismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="mx-3 mt-3 mb-1 p-4 rounded-2xl bg-[#f59e6c]/10 border border-[#f59e6c]/30 flex items-start gap-3 animate-fade-in"
    >
      <span
        className="material-symbols-outlined text-[22px] text-[#f59e6c] flex-shrink-0 mt-0.5"
        style={{ fontVariationSettings: "'FILL' 1" }}
        aria-hidden="true"
      >
        auto_awesome
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-[#f0e6e0] leading-snug mb-1">
          Welcome — AI Genie prototype
        </p>
        <p className="text-[13px] text-[#c9bbb2] leading-relaxed">
          Tap the search bar and type something vague — like{" "}
          <em>pool</em> or <em>beach</em> — to see Genie suggest ways to narrow
          it down. Photos and metadata are synthetic.
        </p>
      </div>
      <button
        type="button"
        aria-label="Dismiss guide card"
        onClick={handleDismiss}
        className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full flex items-center justify-center text-[#8f7e73] hover:text-white hover:bg-white/10 transition-colors flex-shrink-0 cursor-pointer"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}
