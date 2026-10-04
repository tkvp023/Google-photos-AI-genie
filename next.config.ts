import type { NextConfig } from "next";

const rawBackendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
const backendUrl = rawBackendUrl ? rawBackendUrl.replace(/\/+$/, "") : undefined;

const nextConfig: NextConfig = {
  // Support standalone output for containerized/Railway deployments
  output: process.env.NEXT_OUTPUT_STANDALONE === "true" ? "standalone" : undefined,

  // Ensure data files and library photos are bundled into serverless functions on Vercel
  outputFileTracingIncludes: {
    "/api/**/*": ["./data/**/*", "./public/library/**/*"],
  },

  // Optional backend proxy rewrite when frontend (Vercel) talks to a separate backend (Railway)
  async rewrites() {
    if (backendUrl) {
      return [
        {
          source: "/api/:path*",
          destination: `${backendUrl}/api/:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
