// src/components/coach/CoachStrip.tsx — Compact Zero-Friction Coach Strip directly under search bar
// Supports: normal questions, "no photos fit" (zero-match) state, and partial unmatched-term notes.
"use client";

import React from "react";
import { Question, QuestionOption } from "@/types";
import { getChipPhrase, isPhraseSelected } from "@/lib/phraseTemplates";

interface CoachStripProps {
  questions: Question[];
  currentText: string;
  candidateCount: number;
  isDebug?: boolean;
  noMatchState?: "zero" | "partial" | "none";
  unmatchedTerms?: string[];
  onChipTap: (question: Question, option: QuestionOption, isSelected: boolean) => void;
  onDismiss?: () => void;
}

export function CoachStrip({
  questions,
  currentText,
  candidateCount,
  isDebug = false,
  noMatchState = "none",
  unmatchedTerms = [],
  onChipTap,
  onDismiss,
}: CoachStripProps) {
  // ── "No photos fit" zero-match state: no chips, only caption ─────────────
  if (noMatchState === "zero") {
    return (
      <section
        aria-label="No photos match"
        className="w-full bg-[#241c17] border-b border-[#3a2d24] px-4 py-3 flex flex-col gap-1 select-none animate-[fadeIn_120ms_ease-out]"
      >
        <div className="flex items-center gap-2 min-w-0 min-h-[44px]">
          <span className="material-symbols-outlined text-[20px] text-[#f59e6c] flex-shrink-0">
            search_off
          </span>
          <div className="flex flex-col">
            <p className="text-[14px] text-[#f0e6e0] font-medium leading-snug">
              No photos fit this description.
            </p>
            <p className="text-[14px] text-[#8f7e73] leading-snug">
              You can still press Search.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // ── Normal: no questions yet → nothing to render ──────────────────────────
  if (!questions || questions.length === 0) return null;

  return (
    <section
      aria-label="Narrow your search"
      className="w-full bg-[#241c17] border-b border-[#3a2d24] px-4 py-2.5 flex flex-col space-y-2 select-none animate-[fadeIn_120ms_ease-out] transition-all"
    >
      {/* Header: AI Genie caption + dismiss X */}
      <div className="flex items-center justify-between gap-2 min-h-[44px]">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="material-symbols-outlined text-[18px] text-[#f59e6c] flex-shrink-0"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            auto_awesome
          </span>
          <p className="text-[14px] text-[#b8a99e] font-medium leading-snug truncate">
            Lots of photos match. Help us narrow it down.
            {isDebug && candidateCount > 0 ? ` (${candidateCount})` : ""}
          </p>
        </div>
        {/* Dismiss X button — minimum 44x44px touch target */}
        {onDismiss && (
          <button
            type="button"
            aria-label="Dismiss Genie suggestions"
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onDismiss}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#8f7e73] hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors flex-shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        )}
      </div>

      {/* Partial unmatched-terms note (shown above chips when noMatchState === "partial") */}
      {noMatchState === "partial" && unmatchedTerms.length > 0 && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-[#2d221c] border border-[#44352c] min-h-[44px] items-center">
          <span className="material-symbols-outlined text-[18px] text-[#f59e6c] flex-shrink-0">
            info
          </span>
          <p className="text-[14px] text-[#c9bbb2] leading-snug">
            {unmatchedTerms.slice(0, 2).map((t, i) => (
              <span key={t}>
                {i > 0 && ", "}
                No photos match &ldquo;<span className="text-[#f59e6c] font-semibold">{t}</span>&rdquo;
              </span>
            ))}
            .
          </p>
        </div>
      )}

      {/* Up to 3 compact rows */}
      <div className="space-y-2">
        {questions.slice(0, 3).map((q) => {
          // Check which chip in this question is selected based on current search bar text
          const selectedOption = q.options.find((opt) => {
            const phrase = getChipPhrase(q.cueType, opt.value);
            return isPhraseSelected(currentText, phrase);
          });

          // If answered, collapse to selected chip only
          const displayOptions = selectedOption ? [selectedOption] : q.options;

          return (
            <div key={q.id} className="flex items-center gap-2 min-h-[44px]">
              {/* Question cue label — minimum 14px typography */}
              <span className="text-[14px] font-semibold text-[#8f7e73] uppercase tracking-wider flex-shrink-0 w-20 truncate">
                {q.cueType}
              </span>

              {/* Horizontally scrollable chip row */}
              <div
                className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 flex-1 min-w-0"
                role="group"
                aria-label={q.text}
              >
                {displayOptions.map((opt) => {
                  const phrase = getChipPhrase(q.cueType, opt.value);
                  const isSelected = isPhraseSelected(currentText, phrase);

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={isSelected}
                      // Crucial: preventDefault on pointer/mouse down so search input keeps focus and keyboard stays open
                      onPointerDown={(e) => e.preventDefault()}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onChipTap(q, opt, isSelected)}
                      className={`min-w-[44px] min-h-[44px] px-4 rounded-full text-[14px] flex items-center justify-center gap-1.5 transition-all select-none cursor-pointer flex-shrink-0 active:scale-95 border ${
                        isSelected
                          ? "bg-[#f59e6c] text-[#281204] border-[#f59e6c] font-semibold shadow-xs"
                          : "bg-[#2d221c] text-[#f0e6e0] border-[#44352c] hover:bg-[#3d3027] hover:border-[#5a473b]"
                      }`}
                    >
                      {isSelected && (
                        <span className="material-symbols-outlined text-[16px] font-bold">
                          check
                        </span>
                      )}
                      <span>{opt.label.replace(/\?$/, "")}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
