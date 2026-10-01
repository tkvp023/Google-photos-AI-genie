// src/app/api/targets/route.ts — Returns study targets
import { NextResponse } from "next/server";
import { dataStore } from "@/lib/dataLoader";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const targets = dataStore.getTargets();
    return NextResponse.json(targets);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load targets";
    console.error("[GET /api/targets] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
