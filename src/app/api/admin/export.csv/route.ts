// src/app/api/admin/export.csv/route.ts — Export Study Metrics as CSV
import { NextResponse } from "next/server";
import { readEvents } from "@/lib/eventLogger";
import { computeSessionMetrics, metricsToCsv } from "@/lib/metrics";

export async function GET() {
  try {
    const events = await readEvents();
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
