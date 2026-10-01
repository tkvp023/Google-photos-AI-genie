// src/app/api/coach/analyze/route.ts — Coach Analysis API Endpoint
import { NextRequest, NextResponse } from "next/server";
import { vagueCheck } from "@/lib/vagueCheck";
import { search } from "@/lib/search";
import { selectQuestions, shouldTrigger } from "@/lib/coachEngine";

export async function POST(req: NextRequest) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { query = "", mode = "B", dismissed = false } = body || {};

    // 1. Run specificity check
    const vagueResult = vagueCheck(query);

    // 2. Run preliminary search to determine candidate pool size
    const searchPreview = search(query);
    const candidatePhotos = searchPreview.results;
    const count = searchPreview.count;
    const bucket = searchPreview.bucket;

    // 3. Evaluate trigger condition
    const isTriggered = shouldTrigger(mode, query, count, vagueResult.isVague, dismissed);

    // 4. Select questions if triggered
    let questions: import("@/types").Question[] = [];
    let layer = "dynamic_adaptive";

    if (isTriggered) {
      questions = selectQuestions(candidatePhotos, query, []);
      layer = questions[0]?.layer || "dynamic_adaptive";
    }

    return NextResponse.json({
      success: true,
      query,
      mode,
      isVague: vagueResult.isVague,
      anchors: vagueResult.anchors,
      preciseCount: vagueResult.preciseCount,
      count,
      bucket,
      triggered: isTriggered,
      layer,
      questions,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Coach analyze error";
    console.error("[POST /api/coach/analyze] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
