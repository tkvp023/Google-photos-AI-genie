// src/app/error.tsx — Global Error Boundary to prevent crashes
"use client";

import React, { useEffect } from "react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalErrorBoundary] Caught unexpected error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-white text-[#1F1F1F] flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="w-16 h-16 rounded-full bg-[#FCE8E6] text-[#C5221F] flex items-center justify-center mb-4 shadow-sm">
        <span className="material-symbols-outlined text-[32px]">warning</span>
      </div>

      <h1 className="text-[18px] font-semibold text-[#1F1F1F] mb-1">
        Something didn&apos;t go as planned
      </h1>
      <p className="text-[13px] text-[#5F6368] max-w-xs mb-6">
        The prototype encountered a minor issue. You can retry or return to the photo gallery.
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="h-10 px-5 bg-[#1F6FEB] hover:bg-[#1A5DC8] text-white text-xs font-semibold rounded-full shadow-sm transition-colors cursor-pointer"
        >
          Try again
        </button>
        <Link
          href="/"
          className="h-10 px-5 bg-[#F1F3F4] hover:bg-[#E8EAED] text-[#1F1F1F] text-xs font-semibold rounded-full flex items-center justify-center transition-colors"
        >
          Return to Photos
        </Link>
      </div>
    </div>
  );
}
