// src/app/api/log/route.ts — Event Logging API Endpoint
import { NextRequest, NextResponse } from "next/server";
import { writeEvent, readEvents } from "@/lib/eventLogger";

export async function POST(req: NextRequest) {
  try {
    const isTestHeader = req.headers.get("x-test-suite") === "true";
    const event = await req.json();
    if (isTestHeader) {
      event._isTest = true;
    }
    await writeEvent(event);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn("[POST /api/log] Error:", err);
    return NextResponse.json({ ok: true }); // Always return ok so client never crashes
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId") || undefined;
  const isTest = req.headers.get("x-test-suite") === "true";
  const events = await readEvents(sessionId, isTest);
  return NextResponse.json({ events });
}

