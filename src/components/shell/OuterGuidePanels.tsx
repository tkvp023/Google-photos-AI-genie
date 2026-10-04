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
      <div className="hidden lg:block relative w-[280px] xl:w-[320px] h-[860px] z-20 animate-fade-in pointer-events-auto">
        {/* Points to Top Search Bar (center y: ~90px) */}
        <div className="absolute top-[35px] left-0 right-3">
          <GuideCallout
            side="left"
            badgeType="concept"
            badgeText="Pre-Search Genie"
            targetLabel="Top Search Bar"
            title="Inline Cognitive Guidance"
            description="Users recall memories vaguely ('pool', 'trip'). AI Genie helps narrow down intent with memory cues before committing to search."
          />
        </div>

        {/* Points to Photo Grid (center y: ~480px) */}
        <div className="absolute top-[425px] left-0 right-3">
          <GuideCallout
            side="left"
            badgeType="dataset"
            badgeText="Curated Library"
            targetLabel="Photo Timeline"
            title="200 Curated Sample Photos"
            description="Pixabay photos enriched with synthetic episodic cues: Who was there, Where it was, Occasion, and Mood."
          />
        </div>
      </div>
    );

    rightColumn = (
      <div className="hidden lg:block relative w-[280px] xl:w-[320px] h-[860px] z-20 animate-fade-in pointer-events-auto">
        {/* Points to Memories Carousel (center y: ~200px) */}
        <div className="absolute top-[145px] left-3 right-0">
          <GuideCallout
            side="right"
            badgeType="trigger"
            badgeText="How to Trigger"
            targetLabel="Memories & Search"
            title="Try Broad Query Terms"
            description="Tap search and type 'pool', 'restaurant', 'beach', 'hiking', or 'birthday' to see the Genie strip activate."
          />
        </div>

        {/* Points to Bottom Navigation Search FAB (center y: ~770px) */}
        <div className="absolute top-[690px] left-3 right-0">
          <GuideCallout
            side="right"
            badgeType="interaction"
            badgeText="Smart Gating"
            targetLabel="Bottom Search FAB"
            title="Specific Queries Bypass"
            description="Queries with 2+ anchors (e.g. '12 March 2021 Goa pool') are recognized as precise and bypass Genie straight to results."
          />
        </div>
      </div>
    );
  }
  // 2. Search Page Callouts (S4) — Pixel-calibrated to actual search UI elements
  else if (pathname === "/search") {
    leftColumn = (
      <div className="hidden lg:block relative w-[280px] xl:w-[320px] h-[860px] z-20 animate-fade-in pointer-events-auto">
        {/* Points to Top People Row & Search Suggestions (center y: ~110px) */}
        <div className="absolute top-[50px] left-0 right-3">
          <GuideCallout
            side="left"
            badgeType="privacy"
            badgeText="Synthetic Cast"
            targetLabel="People Avatar Strip"
            title="Illustrative People Circles"
            description="People circles at the top demonstrate social face browsing without biometric facial recognition. All labels are synthetic."
          />
        </div>

        {/* Points to Bottom Search Input Pill (center y: ~525px) */}
        <div className="absolute top-[465px] left-0 right-3">
          <GuideCallout
            side="left"
            badgeType="concept"
            badgeText="Master State"
            targetLabel="Search Input (Bottom)"
            title="Search Bar Drives Query"
            description="The search bar is located here at the bottom. Tapping chips above directly appends or toggles the phrase into this bar."
          />
        </div>
      </div>
    );

    rightColumn = (
      <div className="hidden lg:block relative w-[280px] xl:w-[320px] h-[860px] z-20 animate-fade-in pointer-events-auto">
        {/* Points to Genie Coach Strip Header & Memory Rows (center y: ~265px) */}
        <div className="absolute top-[205px] left-3 right-0">
          <GuideCallout
            side="right"
            badgeType="interaction"
            badgeText="Inline Genie"
            targetLabel="Narrow-down Strip Header"
            title="2–3 Human Memory Rows"
            description="When broad queries return ≥6 candidates, Genie suggests Who, Where, and Vibe rows without covering the keyboard or results."
          />
        </div>

        {/* Points to Tappable Detail Chips (center y: ~415px) */}
        <div className="absolute top-[355px] left-3 right-0">
          <GuideCallout
            side="right"
            badgeType="dataset"
            badgeText="Dynamic Pruning"
            targetLabel="Tappable Chips"
            title="Interactive Chip Tapping"
            description="Tapping a chip (e.g. 'Friends') shrinks candidate photos in real time. Tapping again unselects it; another in row replaces it."
          />
        </div>
      </div>
    );
  }
  // 3. Results Page Callouts (S6 / S8)
  else if (pathname === "/results") {
    leftColumn = (
      <div className="hidden lg:block relative w-[280px] xl:w-[320px] h-[860px] z-20 animate-fade-in pointer-events-auto">
        {/* Points to Top Search Query Bar (center y: ~85px) */}
        <div className="absolute top-[35px] left-0 right-3">
          <GuideCallout
            side="left"
            badgeType="concept"
            badgeText="Query Composition"
            targetLabel="Search Bar (Top)"
            title="Natural Language Query"
            description="Results are searched using the natural prompt composed from your original query plus all selected memory chip phrases."
          />
        </div>

        {/* Points to Photo Results Grid (center y: ~450px) */}
        <div className="absolute top-[395px] left-0 right-3">
          <GuideCallout
            side="left"
            badgeType="ranking"
            badgeText="Relevance Ranking"
            targetLabel="Photo Results Grid"
            title="Multi-Cue Scoring Tiers"
            description="Photos are ranked by shared memory cue overlap: Tier 1 (exact multi-cue matches) and Tier 2 (partial/related)."
          />
        </div>
      </div>
    );

    rightColumn = (
      <div className="hidden lg:block relative w-[280px] xl:w-[320px] h-[860px] z-20 animate-fade-in pointer-events-auto">
        {/* Points to Ask Genie Button (center y: ~185px) */}
        <div className="absolute top-[130px] left-3 right-0">
          <GuideCallout
            side="right"
            badgeType="trigger"
            badgeText="Further Refinement"
            targetLabel="Ask Genie Button"
            title="Ask Genie for Ideas"
            description="If results return too many or too few photos, tap the Genie button to reopen suggestions and drill down further."
          />
        </div>

        {/* Points to Footer Credits (center y: ~740px) */}
        <div className="absolute top-[675px] left-3 right-0">
          <GuideCallout
            side="right"
            badgeType="dataset"
            badgeText="Attribution"
            targetLabel="Footer Credits"
            title="Pixabay & Synthetic License"
            description="Complete CC0 photographer attribution and synthetic disclosure are available at the base of the results."
          />
        </div>
      </div>
    );
  }
  // 4. Photo Detail Page Callouts
  else if (pathname.startsWith("/photo/")) {
    leftColumn = (
      <div className="hidden lg:block relative w-[280px] xl:w-[320px] h-[860px] z-20 animate-fade-in pointer-events-auto">
        <div className="absolute top-[320px] left-0 right-3">
          <GuideCallout
            side="left"
            badgeType="dataset"
            badgeText="Photo Metadata"
            targetLabel="Detail Inspector"
            title="Multi-Cue Tag Breakdown"
            description="Inspect the tags that matched this photo: People, Setting, Activity, Clothing, and Occasion."
          />
        </div>
      </div>
    );

    rightColumn = (
      <div className="hidden lg:block relative w-[280px] xl:w-[320px] h-[860px] z-20 animate-fade-in pointer-events-auto">
        <div className="absolute top-[320px] left-3 right-0">
          <GuideCallout
            side="right"
            badgeType="concept"
            badgeText="Explanation Engine"
            targetLabel="AI Why Explanation"
            title="Transparent AI Explanations"
            description="Explanations are dynamically generated from tag data — never hardcoded canned strings."
          />
        </div>
      </div>
    );
  }
  // 5. Default / About Page Callouts
  else {
    leftColumn = (
      <div className="hidden lg:block relative w-[280px] xl:w-[320px] h-[860px] z-20 animate-fade-in pointer-events-auto">
        <div className="absolute top-[320px] left-0 right-3">
          <GuideCallout
            side="left"
            badgeType="concept"
            badgeText="Architecture"
            targetLabel="MVP Prototype"
            title="Stateless Client Engine"
            description="Everything runs in-browser with zero database, zero telemetry, and zero backend tracking."
          />
        </div>
      </div>
    );

    rightColumn = (
      <div className="hidden lg:block relative w-[280px] xl:w-[320px] h-[860px] z-20 animate-fade-in pointer-events-auto">
        <div className="absolute top-[320px] left-3 right-0">
          <GuideCallout
            side="right"
            badgeType="dataset"
            badgeText="CC0 License"
            targetLabel="Photographer Credits"
            title="Public Domain Media"
            description="Every sample photo is verified CC0 from Pixabay with photographer credits preserved."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center w-full max-w-[1400px] h-full max-h-[860px] px-2 sm:px-4">
      {isGuideOn && leftColumn}
      {children}
      {isGuideOn && rightColumn}
    </div>
  );
}
