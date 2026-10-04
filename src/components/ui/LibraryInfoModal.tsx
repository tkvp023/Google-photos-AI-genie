// src/components/ui/LibraryInfoModal.tsx
// A3: "About this library" modal / bottom-sheet.
// Opened via a footer link on S1, S2, S4, S6, S8, S12.
// No server calls — all text is static.
"use client";

import React from "react";
import { X } from "lucide-react";

interface LibraryInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LibraryInfoModal({ isOpen, onClose }: LibraryInfoModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lib-info-title"
    >
      <div
        className="w-full max-w-lg bg-[#1f1814] rounded-t-3xl px-5 pt-4 pb-10 space-y-4 shadow-2xl border-t border-[#3a2d24] animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-[#44352c] rounded-full mx-auto mb-2" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2
            id="lib-info-title"
            className="text-[17px] font-semibold text-white"
          >
            About this library
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#8f7e73] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 text-[14px] text-[#c9bbb2] leading-relaxed">
          <p>
            <strong className="text-[#f0e6e0]">200 photos</strong> sourced from{" "}
            <a
              href="https://pixabay.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#f59e6c] underline"
            >
              Pixabay
            </a>{" "}
            under their free content licence. Each photo is credited to the
            original photographer.
          </p>

          <p>
            <strong className="text-[#f0e6e0]">Synthetic metadata</strong> —
            names, dates, places, and cast labels shown in this app are
            computer-generated and do not represent real people or events.
          </p>

          <p>
            <strong className="text-[#f0e6e0]">Face recognition</strong> is not
            used. The &ldquo;People&rdquo; row shows avatar images from the
            library, not real face-match data. Labels are illustrative only.
          </p>

          <p>
            <strong className="text-[#f0e6e0]">No personal data</strong> is
            stored or transmitted. Searches run entirely in-process; recent
            searches are saved only in your browser&apos;s local storage.
          </p>

          <div className="mt-3 pt-3 border-t border-[#3a2d24]">
            <a
              href="/about"
              className="inline-flex items-center gap-1.5 text-[#f59e6c] font-medium hover:underline min-h-[44px]"
            >
              Full photographer credits →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
