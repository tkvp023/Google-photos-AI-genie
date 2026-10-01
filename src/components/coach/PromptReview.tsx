// src/components/coach/PromptReview.tsx — S5 Prompt Review & Edit Screen
"use client";

import React, { useState, useEffect } from "react";
import { Answer, Composer } from "@/types";

interface PromptReviewProps {
  initialPrompt: string;
  composer: Composer;
  answers: Answer[];
  onRemoveAnswer: (questionId: string) => void;
  onSearch: (finalPrompt: string) => void;
  onBack: () => void;
}

export function PromptReview({
  initialPrompt,
  composer,
  answers,
  onRemoveAnswer,
  onSearch,
  onBack,
}: PromptReviewProps) {
  const [editedPrompt, setEditedPrompt] = useState(initialPrompt);

  useEffect(() => {
    setEditedPrompt(initialPrompt);
  }, [initialPrompt]);

  const activeAnswers = answers.filter(
    (a) => a.value && a.value !== "dont_remember" && a.value !== "skip"
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const promptToSend = editedPrompt.trim() || initialPrompt;
    onSearch(promptToSend);
  };

  return (
    <div className="w-full flex flex-col space-y-4 pt-1 animate-slide-down">
      {/* Title */}
      <div>
        <h2 className="text-[17px] font-semibold text-[#1F1F1F] tracking-tight leading-snug">
          Here&apos;s your search. Change anything you like.
        </h2>
        <p className="text-[12px] text-[#5F6368] mt-0.5">
          Tweak the text or remove details below before searching.
        </p>
      </div>

      {/* Removable Active Cue Chips */}
      {activeAnswers.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {activeAnswers.map((ans) => {
            const cleanLabel = ans.value.replace(/\?$/, "");
            return (
              <div
                key={ans.questionId}
                className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full bg-[#E8F0FE] text-[#1F6FEB] border border-[#D2E3FC] text-[13px] font-medium shadow-xs"
              >
                <span>{cleanLabel}</span>
                <button
                  type="button"
                  onClick={() => onRemoveAnswer(ans.questionId)}
                  className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-[#D2E3FC] text-[#1F6FEB] transition-colors"
                  aria-label={`Remove ${cleanLabel}`}
                >
                  <span className="material-symbols-outlined text-[13px]">close</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Editable Prompt Card */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="relative bg-[#F8F9FA] rounded-2xl p-3 border border-[#E3E5E8] shadow-inner focus-within:ring-2 focus-within:ring-[#1F6FEB] transition-all">
          <textarea
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            rows={3}
            className="w-full bg-transparent border-none outline-none text-[15px] text-[#1F1F1F] font-medium leading-relaxed resize-none"
            placeholder="Type your refined search..."
            autoFocus
          />

          {/* Assisted Attribution Subtext */}
          <div className="flex items-center justify-between pt-2 border-t border-[#E3E5E8]/80 text-[11px] text-[#5F6368]">
            <div className="flex items-center gap-1">
              <span
                className="material-symbols-outlined text-[14px] text-[#1F6FEB]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                auto_awesome
              </span>
              <span>Refined with AI Coach</span>
            </div>
            <span className="font-mono text-[10px] uppercase bg-white px-2 py-0.5 rounded border border-[#E3E5E8] text-[#5F6368]">
              {composer === "groq" ? "Groq 120B" : "Fallback"}
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            className="flex-1 h-11 bg-[#1F6FEB] hover:bg-[#1A5DC8] active:bg-[#164FA8] text-white rounded-full text-[14px] font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">search</span>
            <span>Search Photos</span>
          </button>

          <button
            type="button"
            onClick={onBack}
            className="h-11 px-4 bg-white hover:bg-[#F5F6F8] text-[#1F1F1F] border border-[#D5D9E0] rounded-full text-[13px] font-medium transition-colors cursor-pointer"
          >
            Back
          </button>
        </div>
      </form>
    </div>
  );
}
