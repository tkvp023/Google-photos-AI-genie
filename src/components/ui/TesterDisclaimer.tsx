// src/components/ui/TesterDisclaimer.tsx
// Tester-experience footer disclaimer strip (A2).
// Must not shift layout: uses a small, fixed-font strip.
"use client";

import React from "react";

interface TesterDisclaimerProps {
  /** Extra className for spacing / positioning overrides */
  className?: string;
}

/**
 * Lightweight disclaimer strip shown at the bottom of every screen with photos.
 * Satisfies A2: "This is a research prototype. The 200-photo library and all names,
 * dates and places are synthetic — not real personal data."
 */
export function TesterDisclaimer({ className = "" }: TesterDisclaimerProps) {
  return (
    <div
      role="note"
      aria-label="Prototype disclaimer"
      className={`w-full px-4 py-2.5 text-center text-[13px] text-[#736357] leading-snug select-none ${className}`}
    >
      <span>
        Research prototype · 200 synthetic photos · Names, dates and places are
        not real personal data
      </span>
    </div>
  );
}
