// src/components/ui/GenieHintBox.tsx
// Compact MVP tester callout — fits inside the 210 px side whitespace column.
// Always visible (no dismiss). Height target: ~175–185 px.
"use client";

import React from "react";

// All 4 examples hit ≥2 cue categories → guaranteed Genie activation.
const EXAMPLES = [
  "friends at the beach",
  "birthday party evening",
  "hiking in the mountains",
  "family swimming at pool",
];

export function GenieHintBox() {
  return (
    <div
      role="note"
      aria-label="How to trigger AI Genie"
      className="rounded-xl border border-[#D8C4FF] bg-gradient-to-b from-[#F3EAFF] to-[#EAE0FF] shadow-sm overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1 border-b border-[#E0D0FF]">
        <span className="text-[13px] leading-none select-none" aria-hidden="true">✨</span>
        <p className="text-[11px] font-bold text-[#3D0A91] leading-tight tracking-tight">
          How to trigger AI Genie
        </p>
      </div>

      {/* ── One-liner instruction ── */}
      <p className="px-2.5 pt-1.5 text-[10px] text-[#4A2080] leading-snug">
        In 🔍 Search, type a phrase with{" "}
        <span className="font-semibold">2+ details</span> — Genie appears automatically.
        Then tap the coloured chips.
      </p>

      {/* ── Examples ── */}
      <div className="px-2.5 pt-1.5 pb-2">
        <p className="text-[9px] font-semibold text-[#7C4DFF] uppercase tracking-widest mb-1">
          Try these:
        </p>
        <div className="flex flex-col gap-[5px]">
          {EXAMPLES.map((ex) => (
            <span
              key={ex}
              className="block px-2 py-[3px] rounded-md bg-white/80 border border-[#C9B0FF] text-[10px] text-[#3D0A91] font-medium leading-tight"
            >
              &ldquo;{ex}&rdquo;
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
