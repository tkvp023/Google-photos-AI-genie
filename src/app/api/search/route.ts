// src/app/api/search/route.ts — AI Semantic Search API Endpoint
import { NextRequest, NextResponse } from "next/server";
import { search } from "@/lib/search";
import { rankPhotosWithLLM } from "@/lib/llmSearch";

export async function POST(req: NextRequest) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { query = "", mode = "B" } = body || {};

    if (typeof query !== "string") {
      return NextResponse.json({ error: "Query must be a string" }, { status: 400 });
    }

    // 1. Initial fast candidate retrieval
    const searchResult = search(query);

    // 2. LLM semantic re-ranking (if query has content terms and candidates exist)
    let finalResults = searchResult.results;
    if (query.trim().length >= 3 && searchResult.results.length > 0) {
      try {
        finalResults = await rankPhotosWithLLM(query, searchResult.results);
      } catch (llmErr) {
        console.warn("[POST /api/search] LLM ranking fallback to lexical:", llmErr);
      }
    }

    const strongMatches = finalResults.filter((r) => (r.tier || 3) === 1);

    return NextResponse.json({
      success: true,
      mode,
      ...searchResult,
      results: finalResults,
      count: finalResults.length,
      count_strong: strongMatches.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal search error";
    console.error("[POST /api/search] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const mode = searchParams.get("mode") || "B";

  const searchResult = search(q);

  let finalResults = searchResult.results;
  if (q.trim().length >= 3 && searchResult.results.length > 0) {
    try {
      finalResults = await rankPhotosWithLLM(q, searchResult.results);
    } catch (llmErr) {
      console.warn("[GET /api/search] LLM ranking fallback to lexical:", llmErr);
    }
  }

  const strongMatches = finalResults.filter((r) => (r.tier || 3) === 1);

  return NextResponse.json({
    success: true,
    mode,
    ...searchResult,
    results: finalResults,
    count: finalResults.length,
    count_strong: strongMatches.length,
  });
}
