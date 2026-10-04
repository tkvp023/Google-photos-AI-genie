"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { GuideCallout } from "./GuideCallout";

interface OuterGuideLayoutProps {
  isGuideOn: boolean;
  children: React.ReactNode;
}

/**
 * Callout box ~90px tall (compact).
 * Phone chassis: 860px total height.
 * Safe last top: 860 - 90 - 8 = 762px.
 *
 * Each column is `h-[860px] overflow-hidden relative` so nothing clips outside the chassis boundaries.
 */
export function OuterGuideLayout({ isGuideOn, children }: OuterGuideLayoutProps) {
  const pathname = usePathname();

  let leftColumn: React.ReactNode = null;
  let rightColumn: React.ReactNode = null;

  // ──────────────────────────────────────────────────────────────
  // HOME PAGE  /
  // Left:  Top Search Bar (~50px), Photo Grid (~430px)
  // Right: Memories Carousel (~160px), Bottom Nav FAB (~730px)
  // ──────────────────────────────────────────────────────────────
  if (pathname === "/") {
    leftColumn = (
      <div className="hidden lg:block relative flex-shrink-0 w-[230px] xl:w-[260px] h-[860px] overflow-hidden z-20 animate-fade-in pointer-events-auto pr-3">
        <div className="absolute top-[32px] left-0 right-0">
          <GuideCallout
            side="left"
            badgeType="concept"
            badgeText="Pre-Search Genie"
            targetLabel="Top Search Bar"
            title="Inline Cognitive Guidance"
            description="Users recall vaguely ('pool', 'trip'). Genie narrows intent with memory cues before search."
          />
        </div>
        <div className="absolute top-[390px] left-0 right-0">
          <GuideCallout
            side="left"
            badgeType="dataset"
            badgeText="Curated Library"
            targetLabel="Photo Timeline"
            title="200 Sample Photos"
            description="Pixabay photos with synthetic episodic cues: Who, Where, Occasion, and Mood."
          />
        </div>
      </div>
    );

    rightColumn = (
      <div className="hidden lg:block relative flex-shrink-0 w-[230px] xl:w-[260px] h-[860px] overflow-hidden z-20 animate-fade-in pointer-events-auto pl-3">
        <div className="absolute top-[130px] left-0 right-0">
          <GuideCallout
            side="right"
            badgeType="trigger"
            badgeText="How to Trigger"
            targetLabel="Memories Strip"
            title="Try Broad Search Terms"
            description="Tap search and type 'pool', 'beach', 'hiking' or 'birthday' to see the Genie strip appear."
          />
        </div>
        <div className="absolute top-[720px] left-0 right-0">
          <GuideCallout
            side="right"
            badgeType="interaction"
            badgeText="Smart Gating"
            targetLabel="Bottom Nav FAB"
            title="Specific Queries Bypass"
            description="Queries with 2+ anchors (e.g. '12 March 2021 Goa pool') bypass Genie straight to results."
          />
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // SEARCH PAGE  /search
  // Screen anatomy (top→bottom):
  //   ~0–56px   : top header bar (back arrow + "Search")
  //   ~56–120px : people avatar row
  //   ~120–164px: divider + "Recent searches" heading
  //   ~164–450px: recent search items list
  //   ~450–700px: when typing — coach strip (Genie rows)
  //   ~700–760px: search input pill
  //   ~760–820px: optional keyboard
  //   ~820–860px: gesture pill
  //
  // Left:  People Avatars (~88px), Search Input Pill (~725px)
  // Right: Genie Strip Header (~480px), Chip Row (~580px)
  // ──────────────────────────────────────────────────────────────
  else if (pathname === "/search") {
    leftColumn = (
      <div className="hidden lg:block relative flex-shrink-0 w-[230px] xl:w-[260px] h-[860px] overflow-hidden z-20 animate-fade-in pointer-events-auto pr-3">
        <div className="absolute top-[50px] left-0 right-0">
          <GuideCallout
            side="left"
            badgeType="privacy"
            badgeText="Synthetic Cast"
            targetLabel="People Avatar Row"
            title="Illustrative Circles"
            description="Face circles simulate person-browsing without real biometric recognition. All labels are synthetic."
          />
        </div>
        <div className="absolute top-[640px] left-0 right-0">
          <GuideCallout
            side="left"
            badgeType="concept"
            badgeText="Master State"
            targetLabel="Search Input Pill"
            title="Bar = Single Source of Truth"
            description="Chips at the top append phrases directly here. Edit, delete or retype freely at any time."
          />
        </div>
      </div>
    );

    rightColumn = (
      <div className="hidden lg:block relative flex-shrink-0 w-[230px] xl:w-[260px] h-[860px] overflow-hidden z-20 animate-fade-in pointer-events-auto pl-3">
        <div className="absolute top-[420px] left-0 right-0">
          <GuideCallout
            side="right"
            badgeType="interaction"
            badgeText="Inline Genie"
            targetLabel="Genie Strip Header"
            title="2–3 Memory Cue Rows"
            description="When broad queries return ≥6 candidates, Genie shows Who, Where and Vibe rows above the keyboard."
          />
        </div>
        <div className="absolute top-[535px] left-0 right-0">
          <GuideCallout
            side="right"
            badgeType="dataset"
            badgeText="Dynamic Pruning"
            targetLabel="Tappable Chips"
            title="Chips Shrink Candidates"
            description="Tapping 'Friends' or 'Afternoon' refines the photo set live. Tap again to deselect; another in row replaces."
          />
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // RESULTS PAGE  /results
  // Left:  Search bar top (~50px), Photo grid (~380px)
  // Right: Ask Genie button (~130px), Footer credits (~720px)
  // ──────────────────────────────────────────────────────────────
  else if (pathname === "/results") {
    leftColumn = (
      <div className="hidden lg:block relative flex-shrink-0 w-[230px] xl:w-[260px] h-[860px] overflow-hidden z-20 animate-fade-in pointer-events-auto pr-3">
        <div className="absolute top-[32px] left-0 right-0">
          <GuideCallout
            side="left"
            badgeType="concept"
            badgeText="Query Composition"
            targetLabel="Search Bar (Top)"
            title="Natural Language Query"
            description="Results are searched using the original query plus all selected chip phrases composed together."
          />
        </div>
        <div className="absolute top-[340px] left-0 right-0">
          <GuideCallout
            side="left"
            badgeType="ranking"
            badgeText="Relevance Ranking"
            targetLabel="Photo Results Grid"
            title="Multi-Cue Scoring Tiers"
            description="Tier 1: exact multi-cue matches. Tier 2: partial or related cue overlaps. No AI hallucination."
          />
        </div>
      </div>
    );

    rightColumn = (
      <div className="hidden lg:block relative flex-shrink-0 w-[230px] xl:w-[260px] h-[860px] overflow-hidden z-20 animate-fade-in pointer-events-auto pl-3">
        <div className="absolute top-[105px] left-0 right-0">
          <GuideCallout
            side="right"
            badgeType="trigger"
            badgeText="Further Refinement"
            targetLabel="Ask Genie Button"
            title="Reopen Genie Anytime"
            description="Too many or too few results? Tap Ask Genie to drill down with fresh memory cue chips."
          />
        </div>
        <div className="absolute top-[720px] left-0 right-0">
          <GuideCallout
            side="right"
            badgeType="dataset"
            badgeText="Attribution"
            targetLabel="Footer Credits"
            title="CC0 Pixabay + Synthetic"
            description="Full photographer credits and synthetic-data disclosure at the bottom of every results page."
          />
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // PHOTO DETAIL PAGE  /photo/[id]
  // ──────────────────────────────────────────────────────────────
  else if (pathname.startsWith("/photo/")) {
    leftColumn = (
      <div className="hidden lg:block relative flex-shrink-0 w-[230px] xl:w-[260px] h-[860px] overflow-hidden z-20 animate-fade-in pointer-events-auto pr-3">
        <div className="absolute top-[300px] left-0 right-0">
          <GuideCallout
            side="left"
            badgeType="dataset"
            badgeText="Photo Metadata"
            targetLabel="Detail Inspector"
            title="Multi-Cue Tag View"
            description="Each photo carries People, Setting, Activity, Clothing and Occasion tags that powered the search."
          />
        </div>
      </div>
    );

    rightColumn = (
      <div className="hidden lg:block relative flex-shrink-0 w-[230px] xl:w-[260px] h-[860px] overflow-hidden z-20 animate-fade-in pointer-events-auto pl-3">
        <div className="absolute top-[450px] left-0 right-0">
          <GuideCallout
            side="right"
            badgeType="concept"
            badgeText="Explanation Engine"
            targetLabel="AI Why Explanation"
            title="100% Data-Driven"
            description="Explanations are built from tag data — never hardcoded or hallucinated canned strings."
          />
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // ABOUT / DEFAULT
  // ──────────────────────────────────────────────────────────────
  else {
    leftColumn = (
      <div className="hidden lg:block relative flex-shrink-0 w-[230px] xl:w-[260px] h-[860px] overflow-hidden z-20 animate-fade-in pointer-events-auto pr-3">
        <div className="absolute top-[300px] left-0 right-0">
          <GuideCallout
            side="left"
            badgeType="concept"
            badgeText="Architecture"
            targetLabel="MVP Overview"
            title="Stateless Client Engine"
            description="Runs entirely in-browser. Zero database, zero telemetry, zero backend tracking."
          />
        </div>
      </div>
    );

    rightColumn = (
      <div className="hidden lg:block relative flex-shrink-0 w-[230px] xl:w-[260px] h-[860px] overflow-hidden z-20 animate-fade-in pointer-events-auto pl-3">
        <div className="absolute top-[450px] left-0 right-0">
          <GuideCallout
            side="right"
            badgeType="dataset"
            badgeText="CC0 License"
            targetLabel="Photographer Credits"
            title="Public Domain Media"
            description="Every sample photo is CC0 from Pixabay with full photographer credits preserved."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center w-full max-w-[1400px] h-full max-h-[860px] px-1 sm:px-2">
      {isGuideOn && leftColumn}
      {children}
      {isGuideOn && rightColumn}
    </div>
  );
}
