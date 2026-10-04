"use client";

import React from "react";
import { Sparkles, Compass, Tag, Layers, Search, Eye, ArrowRight, ArrowLeft } from "lucide-react";

export type CalloutBadgeType = "concept" | "dataset" | "trigger" | "interaction" | "ranking" | "privacy";

interface GuideCalloutProps {
  side: "left" | "right";
  badgeType?: CalloutBadgeType;
  badgeText: string;
  title: string;
  description: string;
  targetLabel: string;
  className?: string;
}

const BADGE_STYLES: Record<CalloutBadgeType, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
  concept: { bg: "bg-blue-50 border-blue-200 text-blue-700", text: "text-blue-700", icon: Sparkles },
  dataset: { bg: "bg-emerald-50 border-emerald-200 text-emerald-700", text: "text-emerald-700", icon: Tag },
  trigger: { bg: "bg-amber-50 border-amber-200 text-amber-700", text: "text-amber-700", icon: Compass },
  interaction: { bg: "bg-purple-50 border-purple-200 text-purple-700", text: "text-purple-700", icon: Layers },
  ranking: { bg: "bg-indigo-50 border-indigo-200 text-indigo-700", text: "text-indigo-700", icon: Search },
  privacy: { bg: "bg-rose-50 border-rose-200 text-rose-700", text: "text-rose-700", icon: Eye },
};

export function GuideCallout({
  side,
  badgeType = "concept",
  badgeText,
  title,
  description,
  targetLabel,
  className = "",
}: GuideCalloutProps) {
  const badgeConfig = BADGE_STYLES[badgeType];
  const Icon = badgeConfig.icon;

  return (
    <div
      className={`relative bg-white/95 backdrop-blur-sm rounded-xl p-3.5 border border-[#e2e8f0] shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:shadow-md transition-all text-left ${className}`}
    >
      {/* Connector Arrow pointing towards phone chassis */}
      {side === "left" ? (
        <div
          className="absolute -right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none drop-shadow-xs"
          aria-hidden="true"
        >
          <div className="w-2.5 h-[2px] bg-[#94a3b8]" />
          <div className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[6px] border-l-[#94a3b8]" />
        </div>
      ) : (
        <div
          className="absolute -left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none drop-shadow-xs"
          aria-hidden="true"
        >
          <div className="w-0 h-0 border-y-[5px] border-y-transparent border-r-[6px] border-r-[#94a3b8]" />
          <div className="w-2.5 h-[2px] bg-[#94a3b8]" />
        </div>
      )}

      {/* Header with Badge & Target Label */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${badgeConfig.bg}`}
        >
          <Icon className="w-3 h-3" />
          {badgeText}
        </span>
        <span className="text-[10px] text-gray-400 font-medium tracking-tight flex items-center gap-0.5">
          {side === "left" ? (
            <>
              Points to <ArrowRight className="w-2.5 h-2.5 text-gray-400" />
            </>
          ) : (
            <>
              <ArrowLeft className="w-2.5 h-2.5 text-gray-400" /> Points to
            </>
          )}
        </span>
      </div>

      {/* Pointing target highlight */}
      <div className="text-[11px] font-medium text-gray-500 mb-1">
        Target: <span className="text-gray-800 font-semibold">{targetLabel}</span>
      </div>

      {/* Title */}
      <h4 className="text-[13px] font-semibold text-gray-900 leading-snug">
        {title}
      </h4>

      {/* Body */}
      <p className="text-[11.5px] text-gray-600 leading-relaxed mt-1">
        {description}
      </p>
    </div>
  );
}
