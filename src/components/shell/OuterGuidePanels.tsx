"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { GuideCallout } from "./GuideCallout";
import { GenieHintBox } from "@/components/ui/GenieHintBox";

interface OuterGuideLayoutProps {
  isGuideOn: boolean;
  children: React.ReactNode;
}

/**
 * Layout maths:
 *   Phone chassis height  = 860px
 *   Compact callout height ≈ 85px
 *   Toggle widget (top-left, ~110px tall)
 *
 *   → Left column: first box must be ≥ top-[120] to clear toggle
 *   → Right column: toggle is on the LEFT so right column is fully free from top-[20]
 *   → Last safe top for any box: 860 - 85 - 5 = 770  →  use max top-[760]
 *
 *   Both columns: w-[210px] xl:w-[240px], h-[860px] overflow-hidden
 */

// ─── Screen anatomy helpers ────────────────────────────────────────────────
// HOME /
//   56px  : status bar + top bar (search pill, Google Photos header)
//   220px : memories carousel strip
//   260px : date group header + first photo row
//   560px : second photo row
//   680px : bottom nav bar starts
//   830px : gesture pill
//
// SEARCH /search  (empty state — no query)
//   56px  : header bar (back + "Search" label)
//   120px : people avatar row
//   180px : divider + "Recent searches" label
//   180–500: recent search items
//   700px : bottom search input pill
//   760px : gesture pill
//
// SEARCH /search  (with query / Genie visible)
//   56px  : header bar
//   350px : Genie strip header ("Lots of photos match...")
//   410px : WHAT row chips
//   480px : LOOK row chips
//   545px : WHEN row chips
//   640px : search input pill
//   720px : keyboard / gesture
//
// RESULTS /results
//   56px  : header + search bar pill
//   140px : "Ask Genie for ideas" button
//   200px : photo grid starts
//   700px : footer + attribution

export function OuterGuideLayout({ isGuideOn, children }: OuterGuideLayoutProps) {
  const pathname = usePathname();

  let leftColumn: React.ReactNode = null;
  let rightColumn: React.ReactNode = null;

  // ────────────────────────────────────────────────────────────────
  // HOME  /
  // Left:  toggle occupies 0–110 → first box at 125
  //        second box at 390 (photo grid mid)
  // Right: free from top → first at 30 (search bar)
  //        second at 590 (second photo row)
  // ────────────────────────────────────────────────────────────────
  if (pathname === "/") {
    leftColumn = (
      <div className="hidden lg:block relative flex-shrink-0 w-[210px] xl:w-[240px] h-[860px] overflow-hidden z-20 animate-fade-in pointer-events-auto pr-3">
        {/* Points → memories strip area ~180px */}
        <div className="absolute top-[125px] left-0 right-0">
          <GuideCallout
            side="left"
            badgeType="concept"
            badgeText="Pre-Search Genie"
            targetLabel="Search Bar"
            title="Inline Cognitive Guide"
            description="Users recall vaguely ('pool', 'trip'). Genie narrows intent with memory cues before search fires."
          />
        </div>
        {/* Points → photo grid ~450px */}
        <div className="absolute top-[390px] left-0 right-0">
          <GuideCallout
            side="left"
            badgeType="dataset"
            badgeText="Curated Library"
            targetLabel="Photo Timeline"
            title="200 Sample Photos"
            description="Pixabay CC0 photos enriched with synthetic cues: Who, Where, Occasion, Mood."
          />
        </div>
      </div>
    );

    rightColumn = (
      <div className="hidden lg:flex flex-col relative flex-shrink-0 w-[210px] xl:w-[240px] h-[860px] overflow-hidden z-20 animate-fade-in pointer-events-auto pl-3">
        {/* ── Always-visible Genie hint for MVP testers ── */}
        <div className="absolute top-[20px] left-0 right-0">
          <GenieHintBox />
        </div>
        {/* Points → memories carousel ~190px */}
        <div className="absolute top-[230px] left-0 right-0">
          <GuideCallout
            side="right"
            badgeType="trigger"
            badgeText="How to Trigger"
            targetLabel="Memories Carousel"
            title="Try Broad Search Terms"
            description="Type 'pool', 'beach', 'hiking' or 'birthday' in search to see the Genie strip appear."
          />
        </div>
        {/* Points → bottom nav FAB ~710px */}
        <div className="absolute top-[660px] left-0 right-0">
          <GuideCallout
            side="right"
            badgeType="interaction"
            badgeText="Smart Gating"
            targetLabel="Bottom Nav FAB"
            title="Precise Queries Bypass"
            description="'12 March 2021 Goa pool' has 2 anchors → Genie skips straight to results."
          />
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────
  // SEARCH  /search  (covers both empty + Genie-active states)
  // Left:  toggle at top-left → first box at 125
  //        People row is at ~120px → box at 125 lines up perfectly
  //        Search input pill ~640–700 → second box at 570
  // Right: Genie strip header ~350px → box at 295
  //        Chip rows ~410–545 → second box at 480
  //        Both boxes: 295+85=380 ✓, 480+85=565 ✓ — well within 860
  // ────────────────────────────────────────────────────────────────
  else if (pathname === "/search") {
    leftColumn = (
      <div className="hidden lg:block relative flex-shrink-0 w-[210px] xl:w-[240px] h-[860px] overflow-hidden z-20 animate-fade-in pointer-events-auto pr-3">
        {/* Points → people avatar row ~120px */}
        <div className="absolute top-[80px] left-0 right-0">
          <GuideCallout
            side="left"
            badgeType="privacy"
            badgeText="Synthetic Cast"
            targetLabel="People Avatar Row"
            title="Illustrative Circles"
            description="Face circles simulate person-based browsing without real biometric recognition."
          />
        </div>
        {/* Points → search input pill ~670px */}
        <div className="absolute top-[590px] left-0 right-0">
          <GuideCallout
            side="left"
            badgeType="concept"
            badgeText="Master State"
            targetLabel="Search Input Pill"
            title="Bar = Single Source of Truth"
            description="Chips append phrases directly here. Edit, delete or retype freely."
          />
        </div>
      </div>
    );

    rightColumn = (
      <div className="hidden lg:block relative flex-shrink-0 w-[210px] xl:w-[240px] h-[860px] overflow-hidden z-20 animate-fade-in pointer-events-auto pl-3">
        {/* Points → Genie strip header ~350px */}
        <div className="absolute top-[295px] left-0 right-0">
          <GuideCallout
            side="right"
            badgeType="interaction"
            badgeText="Inline Genie"
            targetLabel="Genie Strip Header"
            title="2–3 Memory Cue Rows"
            description="Genie shows Who, Where and Vibe rows when ≥6 candidates match — no keyboard coverage."
          />
        </div>
        {/* Points → chip rows ~480px */}
        <div className="absolute top-[460px] left-0 right-0">
          <GuideCallout
            side="right"
            badgeType="dataset"
            badgeText="Dynamic Pruning"
            targetLabel="Tappable Chips"
            title="Chips Shrink Candidates"
            description="Tapping 'Friends' or 'Afternoon' refines photo set live. Tap again to deselect."
          />
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────
  // RESULTS  /results
  // Left:  top-left toggle → first box at 125 (points to search bar ~60px)
  //        second box at 350 (photo grid mid)
  // Right: first at 100 (Ask Genie button ~140px)
  //        second at 650 (footer ~720px)   650+85=735 ✓
  // ────────────────────────────────────────────────────────────────
  else if (pathname === "/results") {
    leftColumn = (
      <div className="hidden lg:block relative flex-shrink-0 w-[210px] xl:w-[240px] h-[860px] overflow-hidden z-20 animate-fade-in pointer-events-auto pr-3">
        <div className="absolute top-[125px] left-0 right-0">
          <GuideCallout
            side="left"
            badgeType="concept"
            badgeText="Query Composition"
            targetLabel="Search Bar (Top)"
            title="Natural Language Query"
            description="Original query + chip phrases are composed into a natural language search prompt."
          />
        </div>
        <div className="absolute top-[360px] left-0 right-0">
          <GuideCallout
            side="left"
            badgeType="ranking"
            badgeText="Relevance Ranking"
            targetLabel="Photo Results Grid"
            title="Tier 1 & Tier 2 Scoring"
            description="Tier 1: exact multi-cue match. Tier 2: partial overlap. Deterministic, no hallucination."
          />
        </div>
      </div>
    );

    rightColumn = (
      <div className="hidden lg:block relative flex-shrink-0 w-[210px] xl:w-[240px] h-[860px] overflow-hidden z-20 animate-fade-in pointer-events-auto pl-3">
        <div className="absolute top-[100px] left-0 right-0">
          <GuideCallout
            side="right"
            badgeType="trigger"
            badgeText="Further Refinement"
            targetLabel="Ask Genie Button"
            title="Reopen Genie Anytime"
            description="Too many or too few results? Tap Ask Genie for fresh cue chips to drill down."
          />
        </div>
        <div className="absolute top-[650px] left-0 right-0">
          <GuideCallout
            side="right"
            badgeType="dataset"
            badgeText="Attribution"
            targetLabel="Footer Credits"
            title="CC0 + Synthetic Disclosure"
            description="Full Pixabay photographer credits and synthetic-data notice at bottom of results."
          />
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────
  // PHOTO DETAIL  /photo/[id]
  // Both single boxes centred vertically in safe zone
  // ────────────────────────────────────────────────────────────────
  else if (pathname.startsWith("/photo/")) {
    leftColumn = (
      <div className="hidden lg:block relative flex-shrink-0 w-[210px] xl:w-[240px] h-[860px] overflow-hidden z-20 animate-fade-in pointer-events-auto pr-3">
        <div className="absolute top-[320px] left-0 right-0">
          <GuideCallout
            side="left"
            badgeType="dataset"
            badgeText="Photo Metadata"
            targetLabel="Detail Inspector"
            title="Multi-Cue Tag View"
            description="People, Setting, Activity, Clothing and Occasion tags that powered the match."
          />
        </div>
      </div>
    );

    rightColumn = (
      <div className="hidden lg:block relative flex-shrink-0 w-[210px] xl:w-[240px] h-[860px] overflow-hidden z-20 animate-fade-in pointer-events-auto pl-3">
        <div className="absolute top-[440px] left-0 right-0">
          <GuideCallout
            side="right"
            badgeType="concept"
            badgeText="Explanation Engine"
            targetLabel="AI Why Card"
            title="100% Data-Driven"
            description="Explanations built from tag data — never hardcoded or hallucinated canned strings."
          />
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────
  // ABOUT / DEFAULT
  // ────────────────────────────────────────────────────────────────
  else {
    leftColumn = (
      <div className="hidden lg:block relative flex-shrink-0 w-[210px] xl:w-[240px] h-[860px] overflow-hidden z-20 animate-fade-in pointer-events-auto pr-3">
        <div className="absolute top-[320px] left-0 right-0">
          <GuideCallout
            side="left"
            badgeType="concept"
            badgeText="Architecture"
            targetLabel="MVP Overview"
            title="Stateless Client Engine"
            description="Runs entirely in-browser: zero database, zero telemetry, zero backend tracking."
          />
        </div>
      </div>
    );

    rightColumn = (
      <div className="hidden lg:block relative flex-shrink-0 w-[210px] xl:w-[240px] h-[860px] overflow-hidden z-20 animate-fade-in pointer-events-auto pl-3">
        <div className="absolute top-[440px] left-0 right-0">
          <GuideCallout
            side="right"
            badgeType="dataset"
            badgeText="CC0 License"
            targetLabel="Photographer Credits"
            title="Public Domain Media"
            description="Every photo is CC0 from Pixabay with full photographer credits preserved."
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
