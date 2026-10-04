// src/app/api/moderator/verify/route.ts — Server-side Moderator PIN Validation
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. Refuse to work if MODERATOR_PIN is unset (no default)
    const expectedPin = process.env.MODERATOR_PIN?.trim();
    if (!expectedPin) {
      return NextResponse.json(
        { valid: false, error: "Server Configuration Error: MODERATOR_PIN is not configured on server" },
        { status: 500 }
      );
    }

    // 2. Accept PIN via POST body or Authorization: Bearer header
    let providedPin = "";
    const authHeader = req.headers.get("authorization") || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      providedPin = match[1].trim();
    } else {
      try {
        const body = await req.json();
        providedPin = String(body.pin || "").trim();
      } catch {
        providedPin = "";
      }
    }

    if (providedPin && providedPin === expectedPin) {
      return NextResponse.json({ valid: true });
    }

    return NextResponse.json({ valid: false, error: "Invalid moderator PIN" }, { status: 401 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Verification error";
    return NextResponse.json({ valid: false, error: message }, { status: 500 });
  }
}
