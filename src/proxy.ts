import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // Only process /api routes
  if (request.nextUrl.pathname.startsWith("/api")) {
    const origin = request.headers.get("origin") || "*";

    // Handle preflight OPTIONS request
    if (request.method === "OPTIONS") {
      const preflightResponse = new NextResponse(null, { status: 204 });
      preflightResponse.headers.set("Access-Control-Allow-Origin", origin);
      preflightResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      preflightResponse.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Requested-With, Accept"
      );
      preflightResponse.headers.set("Access-Control-Max-Age", "86400");
      return preflightResponse;
    }

    const response = NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", origin);
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
