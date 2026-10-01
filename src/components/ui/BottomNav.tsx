"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Image as ImageIcon, Search, FolderHeart, Library } from "lucide-react";

interface BottomNavProps {
  onInertClick: (featureName: string) => void;
}

export function BottomNav({ onInertClick }: BottomNavProps) {
  const pathname = usePathname();

  const isPhotosActive = pathname === "/";
  const isSearchActive = pathname.startsWith("/search") || pathname.startsWith("/results");

  return (
    <nav className="sticky bottom-0 z-40 bg-white/95 backdrop-blur-sm border-t border-[#e8eaed] w-full h-16 flex items-center justify-around px-2 select-none">
      {/* 1. Photos Tab */}
      <Link
        href="/"
        className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors ${
          isPhotosActive ? "text-[#1a73e8]" : "text-[#5f6368] hover:text-[#202124]"
        }`}
      >
        <div
          className={`px-3 py-0.5 rounded-full transition-colors ${
            isPhotosActive ? "bg-[#c2e7ff]/60" : "bg-transparent"
          }`}
        >
          <ImageIcon className={`w-5 h-5 ${isPhotosActive ? "stroke-[2.3]" : "stroke-[1.8]"}`} />
        </div>
        <span className={`text-[11px] mt-0.5 ${isPhotosActive ? "font-semibold" : "font-normal"}`}>
          Photos
        </span>
      </Link>

      {/* 2. Search Tab */}
      <Link
        href="/search"
        className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors ${
          isSearchActive ? "text-[#1a73e8]" : "text-[#5f6368] hover:text-[#202124]"
        }`}
      >
        <div
          className={`px-3 py-0.5 rounded-full transition-colors ${
            isSearchActive ? "bg-[#c2e7ff]/60" : "bg-transparent"
          }`}
        >
          <Search className={`w-5 h-5 ${isSearchActive ? "stroke-[2.3]" : "stroke-[1.8]"}`} />
        </div>
        <span className={`text-[11px] mt-0.5 ${isSearchActive ? "font-semibold" : "font-normal"}`}>
          Search
        </span>
      </Link>

      {/* 3. Collections (Inert Placeholder) */}
      <button
        type="button"
        onClick={() => onInertClick("Collections")}
        className="flex flex-col items-center justify-center flex-1 h-full py-1 text-center text-[#5f6368] hover:text-[#202124] transition-colors"
      >
        <div className="px-3 py-0.5 rounded-full bg-transparent">
          <FolderHeart className="w-5 h-5 stroke-[1.8]" />
        </div>
        <span className="text-[11px] mt-0.5 font-normal">Collections</span>
      </button>

      {/* 4. About / Credits (S12) */}
      <Link
        href="/about"
        className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors ${
          pathname === "/about" ? "text-[#1a73e8]" : "text-[#5f6368] hover:text-[#202124]"
        }`}
      >
        <div
          className={`px-3 py-0.5 rounded-full transition-colors ${
            pathname === "/about" ? "bg-[#c2e7ff]/60" : "bg-transparent"
          }`}
        >
          <Library className={`w-5 h-5 ${pathname === "/about" ? "stroke-[2.3]" : "stroke-[1.8]"}`} />
        </div>
        <span className={`text-[11px] mt-0.5 ${pathname === "/about" ? "font-semibold" : "font-normal"}`}>
          About
        </span>
      </Link>
    </nav>
  );
}
