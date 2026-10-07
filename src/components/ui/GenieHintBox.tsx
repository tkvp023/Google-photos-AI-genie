// src/components/ui/GenieHintBox.tsx
// MVP tester callout: explains how to trigger AI Genie with real working examples.
// Dismissible per-session via sessionStorage.
"use client";

import React, { useEffect, useState } from "react";

const DISMISS_KEY = "gp_genie_hint_dismissed";

// Each example hits ≥2 classifier cue categories, guaranteeing Genie activates.
const EXAMPLES: { label: string; cues: string }[] = [
  { label: "friends at the beach", cues: "who + where" },
  { label: "birthday party evening", cues: "occasion + when" },
  { label: "hiking in the mountains", cues: "what + where" },
  { label: "family swimming at the pool", cues: "who + what + where" },
];

export function GenieHintBox() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div
      role="note"
      aria-label="How to trigger AI Genie"
      className="mx-3 mt-3 mb-1 rounded-2xl border border-[#E0D0FF] bg-gradient-to-br from-[#F5EEFF] via-[#EEE8FF] to-[#E8F0FF] shadow-sm"
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between px-3.5 pt-3 pb-0.5">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none select-none" aria-hidden="true">✨</span>
          <p className="text-[13px] font-bold text-[#3D0A91] leading-tight tracking-tight">
            How to trigger AI Genie
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss Genie hint"
          onClick={handleDismiss}
          className="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[#8B68C4] hover:bg-[#DDD0FF] transition-colors cursor-pointer flex-shrink-0"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* ── Steps ── */}
      <ol className="px-3.5 pt-2 pb-1 space-y-1 list-none">
        <li className="flex gap-2 text-[12px] text-[#4A2080] leading-snug">
          <span className="font-bold text-[#7C4DFF] flex-shrink-0">1.</span>
          <span>Tap the <span className="font-semibold">🔍 Search bar</span> at the top</span>
        </li>
        <li className="flex gap-2 text-[12px] text-[#4A2080] leading-snug">
          <span className="font-bold text-[#7C4DFF] flex-shrink-0">2.</span>
          <span>Type a <span className="font-semibold">descriptive phrase</span> with 2+ details — <em>who, where, what, when, occasion…</em></span>
        </li>
        <li className="flex gap-2 text-[12px] text-[#4A2080] leading-snug">
          <span className="font-bold text-[#7C4DFF] flex-shrink-0">3.</span>
          <span>Genie pops up automatically — tap its <span className="font-semibold">coloured chips</span> to filter results</span>
        </li>
      </ol>

      {/* ── Example chips ── */}
      <div className="px-3.5 pt-1.5 pb-3">
        <p className="text-[10.5px] font-semibold text-[#7C4DFF] uppercase tracking-wider mb-1.5">
          Try these →
        </p>
        <div className="flex flex-col gap-1.5">
          {EXAMPLES.map((ex) => (
            <div key={ex.label} className="flex items-center gap-2">
              <span className="flex-1 px-3 py-1.5 rounded-full bg-white/80 border border-[#C9B0FF] text-[12px] text-[#3D0A91] font-medium leading-tight shadow-[0_1px_3px_rgba(124,77,255,0.08)]">
                &ldquo;{ex.label}&rdquo;
              </span>
              <span className="text-[10px] text-[#9E7FCC] font-medium whitespace-nowrap flex-shrink-0">
                {ex.cues}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
