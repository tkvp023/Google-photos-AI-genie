// src/app/api/moderator/verify/route.ts — Server-side Moderator PIN Validation
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const providedPin = String(body.pin || "").trim();
    const expectedPin = String(process.env.MODERATOR_PIN || "1234").trim();

    if (providedPin === expectedPin) {
      return NextResponse.json({ valid: true });
    }

    return NextResponse.json({ valid: false, error: "Invalid moderator PIN" }, { status: 401 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Verification error";
    return NextResponse.json({ valid: false, error: message }, { status: 500 });
  }
}
