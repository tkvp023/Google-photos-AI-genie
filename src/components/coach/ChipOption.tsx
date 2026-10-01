// src/components/coach/ChipOption.tsx — Interactive Answer Chip Pill
"use client";

import React from "react";
import { QuestionOption } from "@/types";

interface ChipOptionProps {
  option: QuestionOption;
  isSelected: boolean;
  onSelect: (value: string) => void;
}

export function ChipOption({ option, isSelected, onSelect }: ChipOptionProps) {
  return (
    <button
      type="button"
      role="button"
      aria-pressed={isSelected}
      onClick={() => onSelect(option.value)}
      className={`px-3.5 py-1.5 rounded-full text-[13px] transition-all flex items-center gap-1 cursor-pointer select-none active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F6FEB] ${
        isSelected
          ? "bg-[#1F6FEB] text-white font-semibold shadow-sm ring-2 ring-[#1F6FEB]/30"
          : "bg-white hover:bg-[#F5F6F8] text-[#1F1F1F] border border-[#E3E5E8] font-normal shadow-xs"
      }`}
    >
      {isSelected && (
        <span className="material-symbols-outlined text-[15px] animate-scale-in">
          check
        </span>
      )}
      <span>{option.label}</span>
    </button>
  );
}
