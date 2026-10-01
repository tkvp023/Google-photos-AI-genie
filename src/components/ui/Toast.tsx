"use client";

import React, { useEffect } from "react";

interface ToastProps {
  message: string | null;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, onClose, duration = 2500 }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, onClose, duration]);

  if (!message) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-200">
      <div className="bg-[#323232] text-white text-xs sm:text-sm font-medium px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 max-w-[90vw] text-center">
        <span>{message}</span>
      </div>
    </div>
  );
}
