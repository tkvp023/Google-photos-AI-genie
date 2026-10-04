import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Support standalone output for containerized/Railway deployments
  output: process.env.NEXT_OUTPUT_STANDALONE === "true" ? "standalone" : undefined,
};

export default nextConfig;

