// src/components/ui/GenieHintBox.tsx
// MVP tester callout — right-side whitespace. Always visible, no dismiss.
"use client";

import React from "react";

const EXAMPLES = ["beach", "swimming pool", "kid playing in sand", "graduation"];

export function GenieHintBox() {
  return (
    <div
      role="note"
      aria-label="How to trigger AI Genie"
      className="rounded-xl border-l-[3px] border-l-[#7C4DFF] border border-[#DDD0FF] bg-white shadow-sm overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-1.5 px-2.5 pt-2.5 pb-1">
        <span className="text-[13px] select-none" aria-hidden="true">✨</span>
        <p className="text-[11.5px] font-bold text-[#3D0A91] tracking-tight leading-tight">
          How to trigger AI Genie
        </p>
      </div>

      {/* ── Body ── */}
      <p className="px-2.5 pb-2 text-[10.5px] text-[#444] leading-relaxed">
        In <span className="font-semibold text-[#222]">🔍 Search</span>, type a few words about a
        photo you remember. If lots of photos match, Genie appears after a short pause.
        Tap the options to add details, then press <span className="font-semibold text-[#222]">Search</span>.
      </p>

      {/* ── Examples ── */}
      <div className="px-2.5 pb-1">
        <p className="text-[9.5px] font-semibold text-[#7C4DFF] uppercase tracking-widest mb-1.5">
          Try these:
        </p>
        <div className="flex flex-wrap gap-1">
          {EXAMPLES.map((ex) => (
            <span
              key={ex}
              className="px-2 py-[3px] rounded-full bg-[#F3EAFF] border border-[#C9B0FF] text-[10px] text-[#3D0A91] font-medium leading-tight whitespace-nowrap"
            >
              &ldquo;{ex}&rdquo;
            </span>
          ))}
        </div>
      </div>

      {/* ── Footnote ── */}
      <p className="px-2.5 pt-1.5 pb-2.5 text-[9.5px] text-[#888] leading-snug border-t border-[#EEE6FF] mt-1">
        Prototype has 200 sample photos. If nothing matches, Genie stays hidden.
      </p>
    </div>
  );
}
