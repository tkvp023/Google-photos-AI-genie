"use client";

import React from "react";
import Link from "next/link";
import { Search, Sparkles, Cloud, Info } from "lucide-react";

interface TopBarProps {
  onSearchClick?: () => void;
  onInertClick?: (name: string) => void;
  onProfileClick?: () => void;
}

export function TopBar({ onSearchClick, onInertClick, onProfileClick }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md px-3 pt-2 pb-2.5 flex flex-col gap-2 border-b border-[#f1f3f4]">
      {/* Google Photos Search Pill */}
      <div className="w-full h-12 bg-[#f1f3f4] hover:bg-[#e8eaed] active:bg-[#e2e4e7] rounded-full px-3.5 flex items-center justify-between shadow-xs transition-all group">
        <Link
          href="/search"
          onClick={onSearchClick}
          aria-label="Search photos or ask anything"
          className="flex items-center gap-2.5 flex-1 min-w-0 h-full cursor-pointer select-none"
        >
          <Search className="w-5 h-5 text-[#5f6368] group-hover:text-[#202124] transition-colors flex-shrink-0" />
          <span className="text-[14px] text-[#5f6368] truncate font-normal">
            Search photos, people, or ask...
          </span>
        </Link>

        <div className="flex items-center gap-2 flex-shrink-0 pl-1">
          <Link
            href="/search"
            aria-label="Ask Photos AI"
            className="flex items-center justify-center cursor-pointer select-none p-1 hover:bg-black/5 rounded-full transition-colors"
            title="Ask Photos"
          >
            <Sparkles className="w-4 h-4 text-[#e87129]" />
          </Link>

          {/* User Profile Avatar */}
          <button
            type="button"
            onClick={onProfileClick}
            className="w-8 h-8 rounded-full bg-[#1a73e8] text-white flex items-center justify-center text-xs font-semibold shadow-xs select-none hover:ring-2 hover:ring-[#1a73e8]/30 transition-all cursor-pointer"
            aria-label="Google Account"
            title="Google Account"
          >
            T
          </button>
        </div>
      </div>

      {/* Utility Strip: Photos Wordmark & Status Pill */}
      <div className="flex items-center justify-between px-1">
        {/* Brand Logo */}
        <div className="flex items-center gap-2 select-none">
          <div className="relative w-5 h-5 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <path d="M12 2C12 7.52 7.52 12 2 12C7.52 12 12 16.48 12 22C12 16.48 16.48 12 22 12C16.48 12 12 7.52 12 2Z" fill="#4285F4" opacity="0.9" />
              <circle cx="12" cy="12" r="3" fill="#EA4335" />
              <path d="M12 2A10 10 0 0 0 2 12H12V2Z" fill="#EA4335" />
              <path d="M22 12A10 10 0 0 0 12 2V12H22Z" fill="#FBBC05" />
              <path d="M12 22A10 10 0 0 0 22 12H12V22Z" fill="#34A853" />
              <path d="M2 12A10 10 0 0 0 12 22V12H2Z" fill="#4285F4" />
            </svg>
          </div>
          <span className="text-[17px] font-medium text-[#202124] tracking-tight">Photos</span>
        </div>

        {/* Backup Status Pill & About Link */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onInertClick && onInertClick("Backup Status")}
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#f8f9fa] border border-[#dadce0] text-[#5f6368] hover:text-[#202124] transition-colors text-[11px] cursor-pointer"
          >
            <Cloud className="w-3.5 h-3.5 text-[#1a73e8]" />
            <span>Backup complete</span>
          </button>
          <Link
            href="/about"
            className="w-6 h-6 rounded-full flex items-center justify-center text-[#5f6368] hover:text-[#1a73e8] transition-colors cursor-pointer"
            title="About & Credits"
            aria-label="About & Credits"
          >
            <Info className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
