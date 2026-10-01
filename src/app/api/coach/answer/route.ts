// src/app/api/coach/answer/route.ts — Coach Interactive Answer & Candidate Filter
import { NextRequest, NextResponse } from "next/server";
import { search } from "@/lib/search";
import { filterCandidates, selectQuestions } from "@/lib/coachEngine";
import { config } from "@/lib/config";
import { Answer } from "@/types";

export async function POST(req: NextRequest) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { query = "", answers = [] }: { query: string; answers: Answer[] } = body || {};

    // 1. Get initial candidates for query
    const searchResult = search(query);
    const initialCandidates = searchResult.results;

    // 2. Filter candidates based on current answers
    const filteredCandidates = filterCandidates(initialCandidates, answers);
    const candidateCount = filteredCandidates.length;

    // 3. Compute updated bucket
    let bucket: "few" | "some" | "many" = "few";
    if (candidateCount <= config.MATCH_BUCKETS.few) {
      bucket = "few";
    } else if (candidateCount <= config.MATCH_BUCKETS.some) {
      bucket = "some";
    } else {
      bucket = "many";
    }

    // 4. Select remaining questions for narrowed candidate set
    const remainingQuestions = selectQuestions(filteredCandidates, query, answers);

    return NextResponse.json({
      success: true,
      query,
      candidateCount,
      bucket,
      isStopCondition: candidateCount <= config.COACH_STOP_AT || answers.length >= config.MAX_QUESTIONS,
      questions: remainingQuestions,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Coach answer error";
    console.error("[POST /api/coach/answer] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
