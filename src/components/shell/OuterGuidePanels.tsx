"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { GuideCallout } from "./GuideCallout";

interface OuterGuideLayoutProps {
  isGuideOn: boolean;
  children: React.ReactNode;
}

export function OuterGuideLayout({ isGuideOn, children }: OuterGuideLayoutProps) {
  const pathname = usePathname();

  let leftColumn: React.ReactNode = null;
  let rightColumn: React.ReactNode = null;

  // 1. Home Page Callouts (S1)
  if (pathname === "/") {
    leftColumn = (
      <div className="hidden lg:flex flex-col justify-between w-[280px] xl:w-[320px] h-[640px] pr-4 z-20 animate-fade-in pointer-events-auto">
        <GuideCallout
          side="left"
          badgeType="concept"
          badgeText="Pre-Search Genie"
          targetLabel="Top Search Bar"
          title="Inline Cognitive Guidance"
          description="Users recall memories vaguely ('pool', 'trip'). AI Genie helps narrow down intent with memory cues before committing to search."
        />
        <GuideCallout
          side="left"
          badgeType="dataset"
          badgeText="Curated Library"
          targetLabel="Photo Timeline"
          title="200 Curated Sample Photos"
          description="Pixabay photos enriched with synthetic episodic cues: Who was there, Where it was, Occasion, and Mood."
        />
      </div>
    );

    rightColumn = (
      <div className="hidden lg:flex flex-col justify-between w-[280px] xl:w-[320px] h-[640px] pl-4 z-20 animate-fade-in pointer-events-auto">
        <GuideCallout
          side="right"
          badgeType="trigger"
          badgeText="How to Trigger"
          targetLabel="Search Trigger"
          title="Try Broad Query Terms"
          description="Tap the search bar and try 'pool', 'restaurant', 'beach', 'hiking', or 'birthday' to see the Genie strip activate."
        />
        <GuideCallout
          side="right"
          badgeType="interaction"
          badgeText="Smart Gating"
          targetLabel="Bottom Navigation"
          title="Specific Queries Bypass"
          description="Queries with 2+ anchors (e.g. '12 March 2021 Goa pool') are recognized as precise and bypass Genie straight to results."
        />
      </div>
    );
  }
  // 2. Search Page Callouts (S4)
  else if (pathname === "/search") {
    leftColumn = (
      <div className="hidden lg:flex flex-col justify-between w-[280px] xl:w-[320px] h-[640px] pr-4 z-20 animate-fade-in pointer-events-auto">
        <GuideCallout
          side="left"
          badgeType="concept"
          badgeText="Master State"
          targetLabel="Search Input Bar"
          title="Search Bar Drives Query"
          description="The search bar is the single source of truth. Tapping suggestion chips appends or toggles the phrase directly in the bar."
        />
        <GuideCallout
          side="left"
          badgeType="privacy"
          badgeText="Synthetic Data"
          targetLabel="People Avatar Strip"
          title="Illustrative People Circles"
          description="People circles demonstrate social face browsing without biometric facial recognition. All labels are synthetic."
        />
      </div>
    );

    rightColumn = (
      <div className="hidden lg:flex flex-col justify-between w-[280px] xl:w-[320px] h-[640px] pl-4 z-20 animate-fade-in pointer-events-auto">
        <GuideCallout
          side="right"
          badgeType="interaction"
          badgeText="Inline Genie"
          targetLabel="Narrow-down Chip Strip"
          title="2–3 Human Memory Rows"
          description="When broad queries return ≥6 candidates, Genie suggests Who, Where, and Vibe rows without covering the keyboard or results."
        />
        <GuideCallout
          side="right"
          badgeType="dataset"
          badgeText="Dynamic Pruning"
          targetLabel="Tappable Chips"
          title="Interactive Chip Tapping"
          description="Tapping a chip (e.g. 'Friends') shrinks candidate photos in real time. Tapping again unselects it; tapping another row replaces it."
        />
      </div>
    );
  }
  // 3. Results Page Callouts (S6 / S8)
  else if (pathname === "/results") {
    leftColumn = (
      <div className="hidden lg:flex flex-col justify-between w-[280px] xl:w-[320px] h-[640px] pr-4 z-20 animate-fade-in pointer-events-auto">
        <GuideCallout
          side="left"
          badgeType="concept"
          badgeText="Query Composition"
          targetLabel="Search Bar"
          title="Natural Language Query"
          description="Results are searched using the natural prompt composed from your original query plus all selected memory chip phrases."
        />
        <GuideCallout
          side="left"
          badgeType="ranking"
          badgeText="Relevance Ranking"
          targetLabel="Photo Results Grid"
          title="Multi-Cue Scoring Tiers"
          description="Photos are ranked by shared memory cue overlap: Tier 1 (exact multi-cue matches) and Tier 2 (partial/related)."
        />
      </div>
    );

    rightColumn = (
      <div className="hidden lg:flex flex-col justify-between w-[280px] xl:w-[320px] h-[640px] pl-4 z-20 animate-fade-in pointer-events-auto">
        <GuideCallout
          side="right"
          badgeType="trigger"
          badgeText="Further Refinement"
          targetLabel="Ask Genie Button"
          title="Ask Genie for Ideas"
          description="If results return too many or too few photos, tap the Genie button to reopen suggestions and drill down further."
        />
        <GuideCallout
          side="right"
          badgeType="dataset"
          badgeText="Attribution"
          targetLabel="Footer Credits"
          title="Pixabay & Synthetic License"
          description="Complete CC0 photographer attribution and synthetic disclosure are available at the base of the results."
        />
      </div>
    );
  }
  // 4. Photo Detail Page Callouts
  else if (pathname.startsWith("/photo/")) {
    leftColumn = (
      <div className="hidden lg:flex flex-col justify-center w-[280px] xl:w-[320px] h-[640px] pr-4 z-20 animate-fade-in pointer-events-auto">
        <GuideCallout
          side="left"
          badgeType="dataset"
          badgeText="Photo Metadata"
          targetLabel="Detail Inspector"
          title="Multi-Cue Tag Breakdown"
          description="Inspect the tags that matched this photo: People, Setting, Activity, Clothing, and Occasion."
        />
      </div>
    );

    rightColumn = (
      <div className="hidden lg:flex flex-col justify-center w-[280px] xl:w-[320px] h-[640px] pl-4 z-20 animate-fade-in pointer-events-auto">
        <GuideCallout
          side="right"
          badgeType="concept"
          badgeText="Explanation Engine"
          targetLabel="AI Why Explanation"
          title="Transparent AI Explanations"
          description="Explanations are dynamically generated from tag data — never hardcoded canned strings."
        />
      </div>
    );
  }
  // 5. Default / About Page Callouts
  else {
    leftColumn = (
      <div className="hidden lg:flex flex-col justify-center w-[280px] xl:w-[320px] h-[640px] pr-4 z-20 animate-fade-in pointer-events-auto">
        <GuideCallout
          side="left"
          badgeType="concept"
          badgeText="Architecture"
          targetLabel="MVP Prototype"
          title="Stateless Client Engine"
          description="Everything runs in-browser with zero database, zero telemetry, and zero backend tracking."
        />
      </div>
    );

    rightColumn = (
      <div className="hidden lg:flex flex-col justify-center w-[280px] xl:w-[320px] h-[640px] pl-4 z-20 animate-fade-in pointer-events-auto">
        <GuideCallout
          side="right"
          badgeType="dataset"
          badgeText="CC0 License"
          targetLabel="Photographer Credits"
          title="Public Domain Media"
          description="Every sample photo is verified CC0 from Pixabay with photographer credits preserved."
        />
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center w-full max-w-[1400px] h-full max-h-[880px] px-2 sm:px-4">
      {isGuideOn && leftColumn}
      {children}
      {isGuideOn && rightColumn}
    </div>
  );
}
