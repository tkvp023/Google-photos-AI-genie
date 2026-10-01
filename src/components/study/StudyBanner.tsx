// src/components/study/StudyBanner.tsx — Sticky 180s Timer Banner for Study Mode
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { config } from "@/lib/config";
import { logClientEvent } from "@/lib/clientLogger";

interface StudyBannerProps {
  sessionId?: string | null;
  targetId?: string | null;
  mode?: "A" | "B";
}

export function StudyBanner({ sessionId, targetId, mode }: StudyBannerProps) {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState<number>(config.TASK_TIME_LIMIT_SEC); // 180s

  useEffect(() => {
    if (!sessionId || !targetId) return;

    // Check if start time already saved in sessionStorage
    const storageKey = `study_timer_start_${sessionId}`;
    let startTime = Number(sessionStorage.getItem(storageKey));
    if (!startTime) {
      startTime = Date.now();
      sessionStorage.setItem(storageKey, String(startTime));
    }

    const interval = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, config.TASK_TIME_LIMIT_SEC - elapsedSec);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        logClientEvent("timeout", { targetId, elapsedSec: config.TASK_TIME_LIMIT_SEC }, { sessionId });
        router.push(`/study?step=end&outcome=timeout&session=${encodeURIComponent(sessionId)}&target=${encodeURIComponent(targetId)}&mode=${mode || "A"}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionId, targetId, mode, router]);

  if (!sessionId || !targetId) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeStr = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

  const handleGiveUp = () => {
    if (confirm("Are you sure you want to give up on this search?")) {
      logClientEvent("gave_up", { targetId, timeLeft }, { sessionId });
      router.push(`/study?step=end&outcome=gave_up&session=${encodeURIComponent(sessionId)}&target=${encodeURIComponent(targetId)}&mode=${mode || "A"}`);
    }
  };

  const isLowTime = timeLeft < 30;

  return (
    <div className="sticky top-0 z-50 bg-[#1F1F1F] text-white px-3.5 py-2 flex items-center justify-between shadow-md select-none border-b border-white/10">
      {/* Target Pill */}
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#FF9F5A] animate-ping" />
        <span className="text-[12px] font-mono font-semibold tracking-wide uppercase">
          Target • {targetId}
        </span>
      </div>

      {/* Timer & Give up */}
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-1 font-mono text-[13px] font-bold px-2.5 py-0.5 rounded-full ${
            isLowTime ? "bg-red-500/20 text-red-400 animate-pulse" : "bg-white/10 text-white"
          }`}
        >
          <span className="material-symbols-outlined text-[15px]">timer</span>
          <span>{timeStr}</span>
        </div>

        <button
          type="button"
          onClick={handleGiveUp}
          className="text-[11px] text-white/70 hover:text-white underline cursor-pointer"
        >
          Give up
        </button>
      </div>
    </div>
  );
}
