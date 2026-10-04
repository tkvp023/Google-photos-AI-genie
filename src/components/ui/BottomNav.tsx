"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Images, LayoutGrid, Plus, Search, Sparkles } from "lucide-react";

interface BottomNavProps {
  onInertClick: (featureName: string) => void;
}

function BottomNavContent({ onInertClick }: BottomNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isPhotosActive = pathname === "/";
  const isCollectionsActive = pathname === "/collections";

  return (
    <div className="absolute bottom-3 left-0 right-0 px-3.5 z-40 pointer-events-none flex items-center justify-between gap-2.5">
      {/* Floating Capsule Dock: Photos, Collections, Create */}
      <nav
        aria-label="Main Navigation"
        className="pointer-events-auto flex-1 h-14 bg-white/95 backdrop-blur-xl rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.12),0_1px_4px_rgba(0,0,0,0.06)] border border-[#e8eaed] px-1.5 flex items-center justify-around select-none"
      >
        {/* 1. Photos Tab */}
        <Link
          href="/"
          aria-current={isPhotosActive ? "page" : undefined}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 ${
            isPhotosActive
              ? "bg-[#ffdcc6] text-[#723600] font-semibold shadow-[0_2px_8px_rgba(255,159,90,0.25)]"
              : "text-[#544339] hover:text-[#1b1b1c] hover:bg-black/5 active:scale-95 font-medium"
          }`}
        >
          <Images className="w-5 h-5 flex-shrink-0" />
          <span className="text-[12px] tracking-tight">Photos</span>
        </Link>

        {/* 2. Collections Tab (Inert prototype) */}
        <button
          type="button"
          onClick={() => onInertClick("Collections")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all duration-200 cursor-pointer ${
            isCollectionsActive
              ? "bg-[#ffdcc6] text-[#723600] font-semibold shadow-[0_2px_8px_rgba(255,159,90,0.25)]"
              : "text-[#544339] hover:text-[#1b1b1c] hover:bg-black/5 active:scale-95 font-medium"
          }`}
        >
          <LayoutGrid className="w-4.5 h-4.5 flex-shrink-0" />
          <span className="text-[12px] tracking-tight">Collections</span>
        </button>

        {/* 3. Create Tab (Inert prototype) */}
        <button
          type="button"
          onClick={() => onInertClick("Create")}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[#544339] hover:text-[#1b1b1c] hover:bg-black/5 active:scale-95 font-medium transition-all duration-200 cursor-pointer"
        >
          <Plus className="w-4.5 h-4.5 flex-shrink-0" />
          <span className="text-[12px] tracking-tight">Create</span>
        </button>
      </nav>

      {/* Floating Circular FAB: Ask Photos / Search */}
      <Link
        href="/search"
        aria-label="Ask Photos AI or Search"
        className="pointer-events-auto w-14 h-14 rounded-full bg-gradient-to-tr from-[#f97316] to-[#ff9f5a] hover:brightness-105 active:scale-95 text-white flex items-center justify-center shadow-[0_4px_16px_rgba(255,159,90,0.38)] transition-all cursor-pointer flex-shrink-0"
      >
        <div className="relative flex items-center justify-center">
          <Search className="w-6 h-6 text-white" />
          <Sparkles className="w-3.5 h-3.5 text-white absolute -top-1 -right-1" />
        </div>
      </Link>
    </div>
  );
}

export function BottomNav(props: BottomNavProps) {
  return (
    <Suspense fallback={null}>
      <BottomNavContent {...props} />
    </Suspense>
  );
}
