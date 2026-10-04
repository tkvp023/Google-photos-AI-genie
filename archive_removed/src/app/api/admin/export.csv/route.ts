// src/app/api/admin/export.csv/route.ts — Export Study Metrics as CSV
import { NextRequest, NextResponse } from "next/server";
import { readEvents } from "@/lib/eventLogger";
import { computeSessionMetrics, metricsToCsv } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // 1. Refuse to work if MODERATOR_PIN is unset (no default)
    const expectedPin = process.env.MODERATOR_PIN?.trim();
    if (!expectedPin) {
      return new NextResponse(
        "Server Configuration Error: MODERATOR_PIN is not configured on server",
        { status: 500 }
      );
    }

    // 2. Accept PIN ONLY via Authorization: Bearer header (no ?pin= support in URLs)
    const authHeader = req.headers.get("authorization") || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const providedPin = match ? match[1].trim() : "";

    if (!providedPin || providedPin !== expectedPin) {
      return new NextResponse("Unauthorized: Missing or invalid PIN", { status: 401 });
    }

    const isTest = req.headers.get("x-test-suite") === "true";
    const events = await readEvents(undefined, isTest);
    const metrics = computeSessionMetrics(events);
    const csvContent = metricsToCsv(metrics);

    const timestamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="study_metrics_${timestamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "CSV export failed";
    console.error("[GET /api/admin/export.csv] Error:", message);
    return new NextResponse(`Error: ${message}`, { status: 500 });
  }
}
