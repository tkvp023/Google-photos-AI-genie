// src/app/api/coach/analyze/route.ts — Coach Analysis API Endpoint
// Integrates: Ambiguity-based trigger + Gemini Question Planner + "no photos fit" state
import { NextRequest, NextResponse } from "next/server";
import { vagueCheck } from "@/lib/vagueCheck";
import { search } from "@/lib/search";
import { selectQuestions, evaluateTrigger, genericFallbackQuestions } from "@/lib/coachEngine";
import { planQuestions } from "@/lib/questionPlanner";
import { unmatchedTerms } from "@/lib/unmatchedTerms";
import { readQuery, QueryReaderResult } from "@/lib/queryReader";
import { config } from "@/lib/config";

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const {
      query = "",
      mode = "B",
      dismissed = false,
      explicit = false,
      genieOff = false,
    } = body as {
      query?: string;
      mode?: string;
      dismissed?: boolean;
      explicit?: boolean;
      genieOff?: boolean;
    };

    const trimmedQuery = (String(query)).trim();

    // 1. Run specificity check
    const vagueResult = vagueCheck(trimmedQuery);

    // 2. Evaluate trigger according to Step 4 rules
    const triggerEval = evaluateTrigger({
      query: trimmedQuery,
      isVague: vagueResult.isVague,
      genieOff: Boolean(genieOff),
      hasBeenDismissed: Boolean(dismissed),
      mode,
    });

    const isTriggered = explicit ? true : triggerEval.shouldTrigger;
    const triggerBlockedReason = triggerEval.blockedReason;
    const noMatchState = triggerEval.noMatchState;
    const candidatePhotos = triggerEval.candidatePhotos;
    const candidateCount = triggerEval.candidateCount;

    // 3. Select deterministic questions (always computed, used as chip source)
    let deterministicQuestions: import("@/types").Question[] = [];
    let layer: "library" | "generic" = "library";

    if (isTriggered && candidatePhotos.length > 0) {
      deterministicQuestions = selectQuestions(
        candidatePhotos,
        trimmedQuery,
        [],
        1.0,
        Boolean(explicit)
      );
      if (deterministicQuestions.length === 0) {
        deterministicQuestions = genericFallbackQuestions(trimmedQuery, [], candidatePhotos);
      }
      layer = deterministicQuestions[0]?.layer === "generic_fallback" ? "generic" : "library";
    }

    // 4. Gemini Question Planner (Mode B only, after all trigger conditions pass)
    let plannerSource: "gemini" | "deterministic" = "deterministic";
    let plannerLatencyMs = 0;
    let plannerFallbackReason: string = "";
    let plannerSameFieldsAsDeterministic = true;
    let finalQuestions = deterministicQuestions;

    if (isTriggered && mode === "B" && deterministicQuestions.length > 0) {
      try {
        const planResult = await planQuestions(
          trimmedQuery,
          candidatePhotos,
          deterministicQuestions,
          []
        );
        finalQuestions = planResult.questions;
        plannerSource = planResult.planner_source;
        plannerLatencyMs = planResult.planner_latency_ms;
        plannerFallbackReason = planResult.planner_fallback_reason;
        plannerSameFieldsAsDeterministic = planResult.planner_same_fields_as_deterministic;
      } catch (planErr: unknown) {
        console.error("[/api/coach/analyze] Planner threw:", planErr);
        plannerFallbackReason = "error";
      }
    }

    return NextResponse.json({
      success: true,
      query: trimmedQuery,
      mode,
      isVague: vagueResult.isVague,
      anchors: vagueResult.anchors,
      preciseCount: vagueResult.preciseCount,
      count: candidateCount,
      count_strong: triggerEval.countStrong ?? candidateCount,
      count_total: triggerEval.countTotal ?? candidateCount,
      ambiguous_count: triggerEval.ambiguousCount ?? 0,
      top_score: triggerEval.topScore ?? 0,
      triggered: isTriggered,
      layer,
      questions: finalQuestions,
      candidates: isTriggered ? candidatePhotos : [],
      tokens: triggerEval.tokens,
      recognised_tokens: triggerEval.recognisedTokens,
      unrecognised_tokens: triggerEval.unrecognisedTokens,
      // No-match signals
      no_match_state: noMatchState,        // "zero" | "partial" | "none"
      unmatched_terms: triggerEval.unrecognisedTokens.slice(0, 2),  // at most 2 shown in UI
      trigger_blocked_reason: triggerBlockedReason,
      // Planner diagnostics
      planner_source: plannerSource,
      planner_latency_ms: plannerLatencyMs,
      planner_fallback_reason: plannerFallbackReason,
      planner_same_fields_as_deterministic: plannerSameFieldsAsDeterministic,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Coach analyze error";
    console.error("[POST /api/coach/analyze] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
