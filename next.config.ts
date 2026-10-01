import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Support standalone output for containerized/Railway deployments
  output: process.env.NEXT_OUTPUT_STANDALONE === "true" ? "standalone" : undefined,

  // When deployed to Vercel (frontend), proxy /api/* requests to Railway backend if BACKEND_URL is set
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
    if (backendUrl) {
      const cleanUrl = backendUrl.replace(/\/+$/, "");
      return [
        {
          source: "/api/:path*",
          destination: `${cleanUrl}/api/:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
