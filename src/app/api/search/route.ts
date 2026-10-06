// src/app/api/search/route.ts — AI Semantic Search API Endpoint
import { NextRequest, NextResponse } from "next/server";
import { search } from "@/lib/search";
import { rankPhotosWithLLM } from "@/lib/llmSearch";
import { understandQuery } from "@/lib/queryUnderstanding";

function logSearchTelemetry(data: {
  timestamp: string;
  query: string;
  mode: string;
  candidate_count: number;
  count_strong: number;
  llm_used: boolean;
  mapping_ran: boolean;
  verify_ran: boolean;
  llm_latency_ms: number;
  llm_fallback: boolean;
  latency_ms: number;
}) {
  console.log(`[TELEMETRY_SEARCH] ${JSON.stringify(data)}`);
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
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

    // 1. Query Understanding on EVERY query: Groq LLM mapping + vocab.json validation
    const quStart = Date.now();
    const understanding = await understandQuery(query);
    const quLatency = Date.now() - quStart;

    // 2. Initial candidate retrieval
    const searchResult = search(query);

    // 3. LLM semantic re-ranking (if query has content terms and candidates exist)
    let finalResults = searchResult.results;
    let llmUsed = false;
    if (query.trim().length >= 3 && searchResult.results.length > 0) {
      try {
        finalResults = await rankPhotosWithLLM(query, searchResult.results);
        llmUsed = true;
      } catch (llmErr) {
        console.warn("[POST /api/search] LLM ranking fallback to lexical:", llmErr);
      }
    }

    const strongMatches = finalResults.filter((r) => (r.tier || 3) === 1);
    const latency_ms = Date.now() - startTime;

    logSearchTelemetry({
      timestamp: new Date().toISOString(),
      query,
      mode,
      candidate_count: finalResults.length,
      count_strong: strongMatches.length,
      llm_used: llmUsed,
      mapping_ran: true,
      verify_ran: true,
      llm_latency_ms: quLatency,
      llm_fallback: Boolean(understanding.llm_fallback),
      latency_ms,
    });

    return NextResponse.json({
      success: true,
      mode,
      ...searchResult,
      results: finalResults,
      count: finalResults.length,
      count_strong: strongMatches.length,
      query_understanding: understanding,
      latency_ms,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal search error";
    console.error("[POST /api/search] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const mode = searchParams.get("mode") || "B";

  // 1. Query Understanding on EVERY query: Groq LLM mapping + vocab.json validation
  const quStart = Date.now();
  const understanding = await understandQuery(q);
  const quLatency = Date.now() - quStart;

  const searchResult = search(q);

  let finalResults = searchResult.results;
  let llmUsed = false;
  if (q.trim().length >= 3 && searchResult.results.length > 0) {
    try {
      finalResults = await rankPhotosWithLLM(q, searchResult.results);
      llmUsed = true;
    } catch (llmErr) {
      console.warn("[GET /api/search] LLM ranking fallback to lexical:", llmErr);
    }
  }

  const strongMatches = finalResults.filter((r) => (r.tier || 3) === 1);
  const latency_ms = Date.now() - startTime;

  logSearchTelemetry({
    timestamp: new Date().toISOString(),
    query: q,
    mode,
    candidate_count: finalResults.length,
    count_strong: strongMatches.length,
    llm_used: llmUsed,
    mapping_ran: true,
    verify_ran: true,
    llm_latency_ms: quLatency,
    llm_fallback: Boolean(understanding.llm_fallback),
    latency_ms,
  });

  return NextResponse.json({
    success: true,
    mode,
    ...searchResult,
    results: finalResults,
    count: finalResults.length,
    count_strong: strongMatches.length,
    query_understanding: understanding,
    latency_ms,
  });
}
