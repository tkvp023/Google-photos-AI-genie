"use client";

import React, { useState } from "react";
import { Smartphone, Lightbulb, Info, X } from "lucide-react";
import { useGuide } from "@/context/GuideContext";

export function GuideToggleBar() {
  const { isGuideOn, setGuideOn } = useGuide();
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  return (
    <>
      {/* Floating Top Control Bar */}
      <header
        aria-label="Tester Mode Controls"
        className="fixed top-2 sm:top-3 z-50 flex items-center justify-between gap-3 px-3 py-1.5 bg-white/95 backdrop-blur-md rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-[#d0d7de] max-w-[95vw] transition-all"
      >
        {/* App Label */}
        <div className="flex items-center gap-2 pl-1 pr-2 border-r border-gray-200">
          <span className="w-2 h-2 rounded-full bg-[#1a73e8] animate-pulse" />
          <span className="text-[12px] font-semibold text-gray-800 tracking-tight whitespace-nowrap">
            Photos Genie MVP
          </span>
        </div>

        {/* Mode Switcher Segmented Control */}
        <div
          role="radiogroup"
          aria-label="Mode Selection"
          className="flex items-center bg-[#f1f5f9] p-0.5 rounded-full"
        >
          {/* Normal Mode Button */}
          <button
            type="button"
            role="radio"
            aria-checked={!isGuideOn}
            onClick={() => setGuideOn(false)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold transition-all cursor-pointer select-none ${
              !isGuideOn
                ? "bg-white text-gray-900 shadow-xs"
                : "text-gray-500 hover:text-gray-900 bg-transparent"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Normal Mode</span>
          </button>

          {/* Guide Mode Button */}
          <button
            type="button"
            role="radio"
            aria-checked={isGuideOn}
            onClick={() => setGuideOn(true)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold transition-all cursor-pointer select-none ${
              isGuideOn
                ? "bg-[#1a73e8] text-white shadow-xs"
                : "text-gray-500 hover:text-gray-900 bg-transparent"
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>Guide Mode</span>
          </button>
        </div>

        {/* Mobile-only info button when guide is ON */}
        {isGuideOn && (
          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(true)}
            className="lg:hidden flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer"
            aria-label="View guide explanations on mobile"
            title="View guide explanations"
          >
            <Info className="w-4 h-4" />
          </button>
        )}
      </header>

      {/* Mobile Guide Modal Drawer (only needed on small viewports <1024px where side space is hidden) */}
      {isMobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end lg:hidden animate-fade-in"
          onClick={() => setIsMobileDrawerOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-[#1a73e8]" />
                <h3 className="text-base font-bold text-gray-900">Guide Mode Explanations</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-gray-700">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-1">
                <p className="font-semibold text-blue-900">Pre-Search AI Genie</p>
                <p className="text-xs text-blue-800">
                  Assists users with vague memory queries before executing full search.
                  Try searching broad terms: <strong>pool</strong>, <strong>restaurant</strong>, <strong>hiking</strong>, <strong>beach</strong>.
                </p>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl space-y-1">
                <p className="font-semibold text-emerald-900">Single Source of Truth</p>
                <p className="text-xs text-emerald-800">
                  Tapping chips appends phrases directly to the search bar. You can edit text or deselect chips at any time.
                </p>
              </div>

              <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl space-y-1">
                <p className="font-semibold text-purple-900">Desktop View Tip</p>
                <p className="text-xs text-purple-800">
                  Open this page on a desktop or wide browser screen to see live interactive callout boxes pointing directly to phone elements!
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(false)}
              className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-black transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
