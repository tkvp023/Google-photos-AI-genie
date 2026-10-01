"use client";

import React from "react";
import Link from "next/link";
import { Search } from "lucide-react";

interface TopBarProps {
  onSearchClick?: () => void;
  onInertClick?: (name: string) => void;
}

export function TopBar({ onSearchClick, onInertClick }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md px-3 pt-2 pb-2 flex flex-col gap-2 border-b border-[#f1f3f4]">
      {/* Google Photos Search Pill */}
      <Link
        href="/search"
        onClick={onSearchClick}
        aria-label="Search photos"
        className="w-full h-12 bg-[#f1f3f4] hover:bg-[#e8eaed] active:bg-[#e2e4e7] rounded-full px-3.5 flex items-center justify-between shadow-sm transition-colors group cursor-pointer"
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <Search className="w-5 h-5 text-[#5f6368] group-hover:text-[#202124] transition-colors flex-shrink-0" />
          <span className="text-[14px] text-[#5f6368] truncate font-normal">
            Search photos, people, or ask...
          </span>
        </div>

        {/* User Profile Avatar */}
        <div className="w-8 h-8 rounded-full bg-[#1a73e8] text-white flex items-center justify-center text-xs font-semibold shadow-sm select-none flex-shrink-0">
          T
        </div>
      </Link>

      {/* Utility Strip: Photos Wordmark & Status Pill */}
      <div className="flex items-center justify-between px-1">
        {/* Brand Logo */}
        <div className="flex items-center gap-1.5 select-none">
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
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#f8f9fa] border border-[#dadce0] text-[#5f6368] hover:text-[#202124] transition-colors text-[11px]"
          >
            <span className="material-symbols-outlined text-[14px] text-[#1a73e8]">cloud_done</span>
            <span>Backup complete</span>
          </button>
          <Link
            href="/about"
            className="w-6 h-6 rounded-full flex items-center justify-center text-[#5f6368] hover:text-[#1a73e8] transition-colors"
            title="About & Credits"
            aria-label="About & Credits"
          >
            <span className="material-symbols-outlined text-[18px]">info</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
