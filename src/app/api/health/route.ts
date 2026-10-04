// src/app/api/health/route.ts — Health Check Endpoint for Deployment & Monitoring
import { NextResponse } from "next/server";
import { dataStore } from "@/lib/dataLoader";

export const dynamic = "force-dynamic";

export async function GET() {
  const version = "0.2.0";

  let tagCoverage = 0;
  let photoCount = 0;
  try {
    const photos = dataStore.getPhotos();
    const tags = dataStore.getTags();
    photoCount = photos.length;
    if (photoCount > 0) {
      const taggedCount = photos.filter((p) => Boolean(tags[p.file])).length;
      tagCoverage = Math.round((taggedCount / photoCount) * 100) / 100;
    }
  } catch {
    tagCoverage = 0;
  }

  return NextResponse.json({
    ok: true,
    version,
    tagCoverage,
    photoCount,
  });
}

