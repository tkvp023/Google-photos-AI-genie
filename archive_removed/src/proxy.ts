// src/proxy.ts — Universal CORS & Preflight Handler for API Routes (Next.js 16 convention)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // Only handle /api/ routes
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin") || "*";
    const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
    const effectiveOrigin = allowedOrigin === "*" ? origin : allowedOrigin;

    // Handle preflight OPTIONS request
    if (request.method === "OPTIONS") {
      const response = new NextResponse(null, { status: 204 });
      response.headers.set("Access-Control-Allow-Origin", effectiveOrigin);
      response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      response.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Requested-With, Accept"
      );
      response.headers.set("Access-Control-Max-Age", "86400");
      return response;
    }

    const response = NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", effectiveOrigin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept"
    );
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
