"use client";

import React, { useState } from "react";

interface GboardKeyboardProps {
  onKeyPress: (char: string) => void;
  onBackspace: () => void;
  onSpace: () => void;
  onSubmit: () => void;
  onClose?: () => void;
}

export function GboardKeyboard({
  onKeyPress,
  onBackspace,
  onSpace,
  onSubmit,
  onClose,
}: GboardKeyboardProps) {
  const [isShift, setIsShift] = useState(false);
  const [showSymbols, setShowSymbols] = useState(false);

  const row1Letters = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
  const row1Numbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  const row2Letters = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
  const row3Letters = ["z", "x", "c", "v", "b", "n", "m"];

  const symbolRow1 = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  const symbolRow2 = ["@", "#", "$", "%", "&", "-", "+", "(", ")"];
  const symbolRow3 = ["*", "\"", "'", ":", ";", "!", "?"];

  const handleKeyClick = (key: string) => {
    const finalChar = isShift ? key.toUpperCase() : key.toLowerCase();
    onKeyPress(finalChar);
    if (isShift) setIsShift(false);
  };

  return (
    <div className="w-full bg-[#1e1713] border-t border-[#2e231c] pt-1.5 pb-2 px-1 select-none flex flex-col gap-1.5 animate-slide-up z-30">
      {/* Top Utility Bar (Keyboard Close chevron & Mic) */}
      <div className="flex items-center justify-between px-2 text-[#a89b92] text-xs h-5">
        <span className="text-[11px] font-mono tracking-tight opacity-75">Google Gboard</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center hover:text-white transition-colors"
            aria-label="Dismiss keyboard"
          >
            <span className="material-symbols-outlined text-[16px]">keyboard_arrow_down</span>
          </button>
        )}
      </div>

      {/* Row 1 */}
      <div className="flex items-center gap-1 justify-center">
        {(showSymbols ? symbolRow1 : row1Letters).map((k, i) => (
          <button
            key={k}
            type="button"
            onClick={() => handleKeyClick(k)}
            className="relative flex-1 h-10 rounded-[6px] bg-[#332822] hover:bg-[#43352d] active:bg-[#5c493e] text-white text-[15px] font-normal flex flex-col items-center justify-center shadow-xs active:scale-95 transition-all"
          >
            {!showSymbols && (
              <span className="text-[8px] text-[#a89b92] leading-none absolute top-0.5 right-1">
                {row1Numbers[i]}
              </span>
            )}
            <span className="leading-none mt-1">{isShift ? k.toUpperCase() : k}</span>
          </button>
        ))}
      </div>

      {/* Row 2 */}
      <div className="flex items-center gap-1 justify-center px-2">
        {(showSymbols ? symbolRow2 : row2Letters).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => handleKeyClick(k)}
            className="flex-1 h-10 rounded-[6px] bg-[#332822] hover:bg-[#43352d] active:bg-[#5c493e] text-white text-[15px] font-normal flex items-center justify-center shadow-xs active:scale-95 transition-all"
          >
            <span>{isShift ? k.toUpperCase() : k}</span>
          </button>
        ))}
      </div>

      {/* Row 3 */}
      <div className="flex items-center gap-1 justify-center">
        {/* Shift / Switch Key */}
        <button
          type="button"
          onClick={() => setIsShift(!isShift)}
          className={`w-11 h-10 rounded-[6px] flex items-center justify-center shadow-xs active:scale-95 transition-all ${
            isShift
              ? "bg-[#f59e6c] text-[#331b0c]"
              : "bg-[#281f1a] hover:bg-[#382b24] text-white"
          }`}
          aria-label="Shift key"
        >
          <span className="material-symbols-outlined text-[18px]">
            {isShift ? "arrow_upward_alt" : "arrow_upward"}
          </span>
        </button>

        {/* Letters / Symbols */}
        {(showSymbols ? symbolRow3 : row3Letters).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => handleKeyClick(k)}
            className="flex-1 h-10 rounded-[6px] bg-[#332822] hover:bg-[#43352d] active:bg-[#5c493e] text-white text-[15px] font-normal flex items-center justify-center shadow-xs active:scale-95 transition-all"
          >
            <span>{isShift ? k.toUpperCase() : k}</span>
          </button>
        ))}

        {/* Backspace Key */}
        <button
          type="button"
          onClick={onBackspace}
          className="w-11 h-10 rounded-[6px] bg-[#281f1a] hover:bg-[#382b24] active:bg-[#4a3a31] text-white flex items-center justify-center shadow-xs active:scale-95 transition-all"
          aria-label="Backspace"
        >
          <span className="material-symbols-outlined text-[19px]">backspace</span>
        </button>
      </div>

      {/* Row 4 (Bottom Controls) */}
      <div className="flex items-center gap-1 justify-center">
        {/* Symbols Toggle ?123 */}
        <button
          type="button"
          onClick={() => setShowSymbols(!showSymbols)}
          className="w-12 h-10 rounded-[6px] bg-[#281f1a] hover:bg-[#382b24] text-[#d7c3b8] text-[12px] font-medium flex items-center justify-center shadow-xs active:scale-95 transition-all"
        >
          <span>{showSymbols ? "ABC" : "?123"}</span>
        </button>

        {/* Comma */}
        <button
          type="button"
          onClick={() => handleKeyClick(",")}
          className="w-9 h-10 rounded-[6px] bg-[#332822] hover:bg-[#43352d] text-white text-[15px] flex items-center justify-center shadow-xs active:scale-95 transition-all"
        >
          <span>,</span>
        </button>

        {/* Emoji Button */}
        <button
          type="button"
          onClick={() => handleKeyClick("✨")}
          className="w-9 h-10 rounded-[6px] bg-[#281f1a] hover:bg-[#382b24] text-[#d7c3b8] flex items-center justify-center shadow-xs active:scale-95 transition-all"
          aria-label="Emoji"
        >
          <span className="material-symbols-outlined text-[18px]">sentiment_satisfied</span>
        </button>

        {/* Space Bar */}
        <button
          type="button"
          onClick={onSpace}
          className="flex-1 h-10 rounded-[6px] bg-[#332822] hover:bg-[#43352d] active:bg-[#5c493e] text-[#a89b92] text-xs flex items-center justify-center shadow-xs active:scale-98 transition-all"
          aria-label="Space bar"
        >
          <span className="w-12 h-0.5 bg-[#5f5148] rounded-full" />
        </button>

        {/* Period */}
        <button
          type="button"
          onClick={() => handleKeyClick(".")}
          className="w-9 h-10 rounded-[6px] bg-[#332822] hover:bg-[#43352d] text-white text-[15px] flex items-center justify-center shadow-xs active:scale-95 transition-all"
        >
          <span>.</span>
        </button>

        {/* Search / Submit Key */}
        <button
          type="button"
          onClick={onSubmit}
          className="w-12 h-10 rounded-[6px] bg-[#f59e6c] hover:bg-[#faaf82] active:scale-95 text-[#281204] flex items-center justify-center shadow-sm font-bold transition-all"
          aria-label="Search"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
