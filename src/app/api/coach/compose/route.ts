// src/app/api/coach/compose/route.ts — Compose Refined Search Prompt API
import { NextRequest, NextResponse } from "next/server";
import { composePrompt } from "@/lib/promptComposer";
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

    const composed = await composePrompt(query, answers);

    return NextResponse.json({
      success: true,
      initialQuery: query,
      ...composed,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Coach compose error";
    console.error("[POST /api/coach/compose] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
