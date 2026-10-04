"use client";

import React from "react";
import { Sparkles, Compass, Tag, Layers, Search, Eye } from "lucide-react";

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

const BADGE_STYLES: Record<CalloutBadgeType, { bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  concept:     { bg: "bg-blue-50 border-blue-200 text-blue-700",     icon: Sparkles },
  dataset:     { bg: "bg-emerald-50 border-emerald-200 text-emerald-700", icon: Tag },
  trigger:     { bg: "bg-amber-50 border-amber-200 text-amber-700",   icon: Compass },
  interaction: { bg: "bg-purple-50 border-purple-200 text-purple-700", icon: Layers },
  ranking:     { bg: "bg-indigo-50 border-indigo-200 text-indigo-700", icon: Search },
  privacy:     { bg: "bg-rose-50 border-rose-200 text-rose-700",      icon: Eye },
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
  const { bg, icon: Icon } = BADGE_STYLES[badgeType];

  return (
    <div
      className={`relative bg-white/96 backdrop-blur-sm rounded-lg p-2.5 border border-[#e2e8f0] shadow-[0_2px_12px_rgba(0,0,0,0.07)] text-left ${className}`}
    >
      {/* Connector arrow pointing at phone */}
      {side === "left" ? (
        <div className="absolute -right-[13px] top-1/2 -translate-y-1/2 flex items-center pointer-events-none" aria-hidden>
          <div className="w-[10px] h-[1.5px] bg-[#94a3b8]" />
          <div className="w-0 h-0 border-y-[4px] border-y-transparent border-l-[5px] border-l-[#94a3b8]" />
        </div>
      ) : (
        <div className="absolute -left-[13px] top-1/2 -translate-y-1/2 flex items-center pointer-events-none" aria-hidden>
          <div className="w-0 h-0 border-y-[4px] border-y-transparent border-r-[5px] border-r-[#94a3b8]" />
          <div className="w-[10px] h-[1.5px] bg-[#94a3b8]" />
        </div>
      )}

      {/* Badge row */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold border ${bg}`}>
          <Icon className="w-2.5 h-2.5" />
          {badgeText}
        </span>
        <span className="text-[9px] text-gray-400 ml-auto">
          → <span className="font-medium text-gray-500">{targetLabel}</span>
        </span>
      </div>

      {/* Title */}
      <h4 className="text-[11.5px] font-bold text-gray-900 leading-tight mb-0.5">
        {title}
      </h4>

      {/* Body */}
      <p className="text-[10.5px] text-gray-600 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
