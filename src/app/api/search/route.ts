// src/app/api/search/route.ts — Lexical Search API Endpoint
import { NextRequest, NextResponse } from "next/server";
import { search } from "@/lib/search";

export async function POST(req: NextRequest) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { query = "", mode = "A" } = body || {};

    if (typeof query !== "string") {
      return NextResponse.json({ error: "Query must be a string" }, { status: 400 });
    }

    // Execute lexical search
    const searchResult = search(query);

    // Optional fire-and-forget event log can be added here in Phase 5
    // e.g. logger.log({ type: "search_submitted", payload: { query, mode, count: searchResult.count } })

    return NextResponse.json({
      success: true,
      mode,
      ...searchResult,
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
  const mode = searchParams.get("mode") || "A";

  const searchResult = search(q);

  return NextResponse.json({
    success: true,
    mode,
    ...searchResult,
  });
}
