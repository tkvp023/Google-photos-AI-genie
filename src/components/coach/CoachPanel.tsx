// src/components/coach/CoachPanel.tsx — AI Search Coach Card Component
"use client";

import React from "react";
import { Answer, Question } from "@/types";
import { QuestionBlock } from "./QuestionBlock";

interface CoachPanelProps {
  questions: Question[];
  answers: Answer[];
  candidateCount: number;
  isComposing: boolean;
  showCount?: boolean;
  onAnswer: (questionId: string, cueType: any, value: string, source?: "chip" | "typed") => void;
  onSkip: (questionId: string, cueType: any) => void;
  onBuildSearch: () => void;
  onSearchAnyway: () => void;
  onReset: () => void;
}

export function CoachPanel({
  questions,
  answers,
  candidateCount,
  isComposing,
  showCount = false,
  onAnswer,
  onSkip,
  onBuildSearch,
  onSearchAnyway,
  onReset,
}: CoachPanelProps) {
  const hasAnswers = answers.filter((a) => a.value !== "dont_remember").length > 0;

  return (
    <section
      aria-label="AI Search Genie Assistant"
      className="w-full rounded-2xl p-4 bg-gradient-to-b from-[#FFF5ED] to-[#FFF0E5] border border-[#FFDCC6] shadow-md flex flex-col space-y-3.5 my-2 animate-slide-down transition-all"
    >
      {/* Coach Header with AI Sparkle Icon & Match Count */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#FF9F5A]/25 flex items-center justify-center flex-shrink-0 text-[#944A07]">
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>
          </div>
          <div className="flex-1 min-w-0">
            {showCount ? (
              <>
                <h2 className="text-[15px] font-semibold text-[#311300] tracking-tight leading-snug">
                  Lots of photos match.
                </h2>
                <p className="text-[12px] text-[#723600]/80">
                  Pick a few details to narrow it down.
                </p>
              </>
            ) : (
              <h2 className="text-[15px] font-semibold text-[#311300] tracking-tight leading-snug">
                Lots of photos match. Help us narrow it down.
              </h2>
            )}
          </div>
        </div>

        {/* Live Narrowing Count Pill (only when showCount is true) */}
        {showCount && candidateCount > 0 && (
          <div className="bg-[#FFE0CC] text-[#733700] px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-tight shadow-xs flex-shrink-0 animate-fade-in">
            {candidateCount} photos
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-[1px] bg-[#FFDCC6]/60 w-full" />

      {/* Questions Stack */}
      <div className="space-y-3">
        {questions.map((q) => {
          const currentAns = answers.find((a) => a.questionId === q.id);
          return (
            <QuestionBlock
              key={q.id}
              question={q}
              selectedAnswer={currentAns?.value}
              onSelectAnswer={(val, src) => onAnswer(q.id, q.cueType, val, src)}
              onSkip={() => onSkip(q.id, q.cueType)}
            />
          );
        })}
      </div>

      {/* Action Buttons Footer */}
      <div className="pt-2 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {/* Primary Action: Build my search */}
          <button
            type="button"
            onClick={onBuildSearch}
            disabled={isComposing}
            className="flex-1 h-10 px-4 bg-[#1F6FEB] hover:bg-[#1A5DC8] active:bg-[#164FA8] text-white rounded-full text-[13px] font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {isComposing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Building search...</span>
              </>
            ) : (
              <>
                <span
                  className="material-symbols-outlined text-[16px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  auto_fix_high
                </span>
                <span>{hasAnswers ? "Build my search" : "Search matching"}</span>
              </>
            )}
          </button>

          {/* Secondary Action: Search anyway */}
          <button
            type="button"
            onClick={onSearchAnyway}
            className="h-10 px-3.5 bg-white hover:bg-[#F5F6F8] text-[#1F1F1F] border border-[#D5D9E0] rounded-full text-[13px] font-medium transition-colors cursor-pointer"
          >
            Search anyway
          </button>
        </div>

        {/* Reset / Clear answers button ("Not these") */}
        {hasAnswers && (
          <div className="flex justify-center pt-0.5">
            <button
              type="button"
              onClick={onReset}
              className="py-1 px-3 text-[12px] font-medium text-[#723600] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F6FEB] rounded-full transition-colors cursor-pointer"
              aria-label="Reset genie selections"
            >
              Not these
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
