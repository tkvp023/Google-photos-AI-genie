"use client";

import React, { useState } from "react";
import { Smartphone, Lightbulb, Info, X } from "lucide-react";
import { useGuide } from "@/context/GuideContext";

export function GuideToggleBar() {
  const { isGuideOn, setGuideOn } = useGuide();
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  return (
    <>
      {/* Toggle Widget — pinned top-LEFT so right callout column is unobstructed */}
      <aside
        aria-label="Tester Mode Controls"
        className="fixed top-3 left-3 sm:top-4 sm:left-6 z-50 flex flex-col items-start gap-1 select-none pointer-events-auto transition-all"
      >
        {/* Main Elevated Toggle Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-2 shadow-[0_8px_30px_rgba(0,0,0,0.12)] border-2 border-[#1a73e8]/30 ring-4 ring-[#1a73e8]/10 flex flex-col gap-1.5 transition-all">
          {/* Card Header: Label & Status Indicator */}
          <div className="flex items-center justify-between gap-3 px-1.5 pt-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              View Mode
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-gray-700">
              <span
                className={`w-2 h-2 rounded-full ${
                  isGuideOn ? "bg-[#1a73e8] animate-pulse" : "bg-emerald-500"
                }`}
              />
              {isGuideOn ? (
                <span className="text-[#1a73e8] font-bold">Guide ON</span>
              ) : (
                <span className="text-gray-600 font-semibold">Normal</span>
              )}
            </span>
          </div>

          {/* Mode Switcher Segmented Control */}
          <div
            role="radiogroup"
            aria-label="Mode Selection"
            className="flex items-center bg-[#f1f5f9] p-1 rounded-xl gap-1 border border-gray-200"
          >
            {/* Normal Mode Button */}
            <button
              type="button"
              role="radio"
              aria-checked={!isGuideOn}
              onClick={() => setGuideOn(false)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-bold transition-all cursor-pointer min-h-[40px] select-none ${
                !isGuideOn
                  ? "bg-white text-gray-900 shadow-md ring-1 ring-black/5"
                  : "text-gray-500 hover:text-gray-900 bg-transparent"
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Normal Mode</span>
            </button>

            {/* Guide Mode Button */}
            <button
              type="button"
              role="radio"
              aria-checked={isGuideOn}
              onClick={() => setGuideOn(true)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-bold transition-all cursor-pointer min-h-[40px] select-none ${
                isGuideOn
                  ? "bg-[#1a73e8] text-white shadow-md shadow-[#1a73e8]/30"
                  : "text-gray-500 hover:text-gray-900 bg-transparent"
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              <span>Guide Mode</span>
            </button>
          </div>

          {/* Helper caption */}
          <div className="flex items-center justify-between px-1.5 pb-0.5 text-[10.5px] text-gray-500">
            <span>
              {isGuideOn ? "Side boxes explaining UI visible" : "Clean stock Google Photos view"}
            </span>

            {/* Mobile explanation drawer trigger */}
            {isGuideOn && (
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(true)}
                className="lg:hidden ml-2 text-[#1a73e8] font-bold underline cursor-pointer"
              >
                Notes
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Guide Modal Drawer (for small screens <1024px where side columns hide) */}
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
                  On desktop screens, interactive callout boxes appear directly in the white space on both sides with arrows pointing to the phone UI!
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
