// src/components/coach/QuestionBlock.tsx — Question Block with Chips & Custom Input
"use client";

import React, { useState } from "react";
import { Question } from "@/types";
import { ChipOption } from "./ChipOption";

interface QuestionBlockProps {
  question: Question;
  selectedAnswer?: string;
  onSelectAnswer: (value: string, source?: "chip" | "typed") => void;
  onSkip: () => void;
}

export function QuestionBlock({
  question,
  selectedAnswer,
  onSelectAnswer,
  onSkip,
}: QuestionBlockProps) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customText, setCustomText] = useState("");

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customText.trim().slice(0, 100);
    if (clean) {
      onSelectAnswer(clean, "typed");
      setShowCustomInput(false);
      setCustomText("");
    }
  };

  const isSkipped = selectedAnswer === "dont_remember";

  return (
    <div
      className={`flex flex-col space-y-2 pt-2 pb-1 transition-opacity ${
        isSkipped ? "opacity-40 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Question Header & Skip Button */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[14px] font-semibold text-[#1F1F1F]">
          {question.text}
        </span>
        {question.allowDontRemember && !isSkipped && (
          <button
            type="button"
            onClick={onSkip}
            className="text-[12px] font-medium text-[#5F6368] hover:text-[#1F1F1F] px-2 py-1 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F6FEB]"
            aria-label={`Skip question: ${question.text}`}
          >
            I don&apos;t remember
          </button>
        )}
      </div>

      {/* Chip Options */}
      <div className="flex flex-wrap gap-1.5 items-center">
        {question.options.map((opt) => (
          <ChipOption
            key={opt.value}
            option={opt}
            isSelected={selectedAnswer === opt.value}
            onSelect={(val) => onSelectAnswer(val, "chip")}
          />
        ))}

        {/* Something else button / input toggle */}
        {question.allowText && !showCustomInput && (
          <button
            type="button"
            onClick={() => setShowCustomInput(true)}
            className="px-3 py-1.5 rounded-full text-[12px] text-[#5F6368] hover:text-[#1F1F1F] border border-dashed border-[#B0B7C3] hover:border-[#1F6FEB] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F6FEB]"
            aria-label="Add custom answer"
          >
            + Something else
          </button>
        )}
      </div>

      {/* Inline Custom Input */}
      {showCustomInput && (
        <form onSubmit={handleCustomSubmit} className="flex items-center gap-1.5 pt-1 animate-fade-in">
          <input
            type="text"
            maxLength={100}
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Type your own answer..."
            autoFocus
            className="flex-1 px-3 py-1 text-xs rounded-full border border-[#1F6FEB] bg-white text-[#1F1F1F] outline-none"
          />
          <button
            type="submit"
            className="px-3 py-1 text-xs rounded-full bg-[#1F6FEB] text-white font-medium hover:bg-[#1A5DC8] transition-colors"
          >
            Done
          </button>
          <button
            type="button"
            onClick={() => setShowCustomInput(false)}
            className="text-xs text-[#5F6368] hover:text-[#1F1F1F] px-1"
          >
            ✕
          </button>
        </form>
      )}
    </div>
  );
}
