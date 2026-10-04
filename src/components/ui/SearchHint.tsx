// src/components/ui/SearchHint.tsx
// A4: Contextual guide hint shown in S4 (when user is typing) and when Genie
// strip is visible. Uses aria-live="polite" — never steals focus.
// Dismissed per-session. Not shown when ?guide=off.
"use client";

import React, { useEffect, useState } from "react";

const SEARCH_HINT_KEY = "gp_search_hint_dismissed";

interface SearchHintProps {
  /** Whether guide mode is active */
  isGuideOn: boolean;
  /** Which hint variant to display */
  variant: "typing" | "strip" | "chip";
  /** Extra className */
  className?: string;
}

const HINTS: Record<SearchHintProps["variant"], string> = {
  typing:
    "Type something broad — Genie appears automatically for vague queries with enough photos.",
  strip:
    "Tap a chip to add a detail to your search. Tap it again to remove it.",
  chip:
    "The search bar updates instantly. Press the arrow to run the refined search.",
};

export function SearchHint({
  isGuideOn,
  variant,
  className = "",
}: SearchHintProps) {
  const dismissKey = `${SEARCH_HINT_KEY}_${variant}`;
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    if (!isGuideOn) {
      setIsDismissed(true);
      return;
    }
    try {
      setIsDismissed(sessionStorage.getItem(dismissKey) === "1");
    } catch {
      setIsDismissed(false);
    }
  }, [isGuideOn, dismissKey]);

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(dismissKey, "1");
    } catch {}
    setIsDismissed(true);
  };

  if (!isGuideOn || isDismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-[#29201a] border border-[#44352c] ${className}`}
    >
      <span
        className="material-symbols-outlined text-[16px] text-[#f59e6c] flex-shrink-0"
        aria-hidden="true"
      >
        lightbulb
      </span>
      <p className="flex-1 text-[13px] text-[#c9bbb2] leading-snug">
        {HINTS[variant]}
      </p>
      <button
        type="button"
        aria-label="Dismiss hint"
        onPointerDown={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleDismiss}
        className="w-8 h-8 min-w-[32px] min-h-[32px] rounded-full flex items-center justify-center text-[#736357] hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
      >
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
    </div>
  );
}
