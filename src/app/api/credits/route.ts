// src/app/api/credits/route.ts — Serves structured photographer credits
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { CreditRow } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
    const csvPath = path.join(dataDir, "credits.csv");
    if (!fs.existsSync(csvPath)) {
      return NextResponse.json({ credits: [] });
    }

    const content = fs.readFileSync(csvPath, "utf-8");
    const lines = content.split("\n").map((line) => line.trim()).filter(Boolean);

    const credits: CreditRow[] = [];

    // Skip header line: file,theme,pexels_id,photographer,url
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",");
      if (parts.length >= 5) {
        credits.push({
          file: parts[0],
          theme: parts[1],
          pexels_id: parts[2],
          photographer: parts[3],
          url: parts.slice(4).join(","), // in case URL has commas
        });
      }
    }

    return NextResponse.json({ credits, count: credits.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load credits";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
