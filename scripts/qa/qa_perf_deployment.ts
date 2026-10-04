// scripts/qa/qa_perf_deployment.ts
import fs from "fs";
import path from "path";
import http from "http";

console.log("=== STAGE 8: PERFORMANCE & DEPLOYMENT READINESS AUDIT ===\n");

const BASE_URL = "http://localhost:3000";

async function request(options: {
  path: string;
  method?: string;
  body?: any;
}): Promise<{ status: number; durationMs: number }> {
  return new Promise((resolve, reject) => {
    const url = new URL(options.path, BASE_URL);
    const headers: Record<string, string> = {};
    let payload = "";
    if (options.body) {
      payload = JSON.stringify(options.body);
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(payload).toString();
    }
    const t0 = performance.now();
    const req = http.request(
      url,
      {
        method: options.method || "GET",
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          const t1 = performance.now();
          resolve({ status: res.statusCode || 0, durationMs: t1 - t0 });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function calcPercentiles(arr: number[]): { p50: number; p95: number; min: number; max: number } {
  const sorted = [...arr].sort((a, b) => a - b);
  return {
    p50: Math.round(sorted[Math.floor(sorted.length * 0.5)] * 10) / 10,
    p95: Math.round(sorted[Math.floor(sorted.length * 0.95)] * 10) / 10,
    min: Math.round(sorted[0] * 10) / 10,
    max: Math.round(sorted[sorted.length - 1] * 10) / 10,
  };
}

async function runStage8() {
  // 1. Latency: 100 calls of /api/search
  console.log("--- 1. API Latency Benchmark (100 calls each) ---");
  const searchQueries = ["pool", "beach", "me in a pool", "restaurant", "kids park", "birthday", "hiking"];
  const searchLatencies: number[] = [];

  for (let i = 0; i < 100; i++) {
    const q = searchQueries[i % searchQueries.length];
    const res = await request({ path: `/api/search?q=${encodeURIComponent(q)}` });
    if (res.status === 200) searchLatencies.push(res.durationMs);
  }
  const searchStats = calcPercentiles(searchLatencies);
  console.log(`/api/search (100 calls): p50 = ${searchStats.p50} ms, p95 = ${searchStats.p95} ms, min = ${searchStats.min} ms, max = ${searchStats.max} ms`);

  // 100 calls of /api/coach/analyze
  const coachLatencies: number[] = [];
  for (let i = 0; i < 100; i++) {
    const q = searchQueries[i % searchQueries.length];
    const res = await request({
      path: "/api/coach/analyze",
      method: "POST",
      body: { query: q, mode: "B" },
    });
    if (res.status === 200) coachLatencies.push(res.durationMs);
  }
  const coachStats = calcPercentiles(coachLatencies);
  console.log(`/api/coach/analyze (100 calls): p50 = ${coachStats.p50} ms, p95 = ${coachStats.p95} ms, min = ${coachStats.min} ms, max = ${coachStats.max} ms`);

  // 2. Client JS Bundle Size
  console.log("\n--- 2. Client JS Bundle Size Audit ---");
  const staticDir = path.join(process.cwd(), ".next", "static");
  let totalBytes = 0;
  let chunkCount = 0;

  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const item of fs.readdirSync(dir)) {
      const p = path.join(dir, item);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        scanDir(p);
      } else if (item.endsWith(".js")) {
        totalBytes += stat.size;
        chunkCount++;
      }
    }
  }
  scanDir(staticDir);
  const totalKB = Math.round(totalBytes / 1024);
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
  console.log(`Total client JS bundle size: ${totalKB} KB (${totalMB} MB) across ${chunkCount} chunks.`);

  // 3. Largest Images in public/library
  console.log("\n--- 3. Image Assets Audit ---");
  const libraryDir = path.join(process.cwd(), "public", "library");
  const photos = fs.readdirSync(libraryDir).filter((f) => f.endsWith(".jpg") || f.endsWith(".png"));
  const photoSizes: { file: string; sizeKB: number }[] = photos.map((f) => ({
    file: f,
    sizeKB: Math.round(fs.statSync(path.join(libraryDir, f)).size / 1024),
  }));
  photoSizes.sort((a, b) => b.sizeKB - a.sizeKB);
  console.log(`Total photos: ${photos.length}. Top 5 largest:`);
  photoSizes.slice(0, 5).forEach((p, idx) => console.log(`  ${idx + 1}. ${p.file}: ${p.sizeKB} KB`));
  const over400k = photoSizes.filter((p) => p.sizeKB > 400);
  console.log(`Photos over 400 KB: ${over400k.length}`);

  // 4. Deployment Config Audit
  console.log("\n--- 4. Deployment Configuration Audit ---");
  const railwayJsonExists = fs.existsSync("railway.json");
  const procfileExists = fs.existsSync("Procfile");
  const nextConfigExists = fs.existsSync("next.config.ts");
  console.log(`railway.json: ${railwayJsonExists ? "PASS [EXISTS]" : "FAIL"}`);
  console.log(`Procfile: ${procfileExists ? "PASS [EXISTS]" : "FAIL"}`);
  console.log(`next.config.ts: ${nextConfigExists ? "PASS [EXISTS]" : "FAIL"}`);

  // Health check response fields
  const healthRes = await request({ path: "/api/health" });
  console.log(`/api/health status: HTTP ${healthRes.status}`);

  // Environment variables list (names only)
  console.log("\n--- 5. Environment Variables List (Names Only) ---");
  const envExample = fs.readFileSync(".env.example", "utf-8");
  const envNames = envExample
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => l.split("=")[0].trim());
  console.log("Configured Environment Variable Names (.env.example):");
  envNames.forEach((name) => console.log(`  - ${name}`));

  // Check deployed URL
  const deployedUrl = process.env.DEPLOYED_URL;
  if (!deployedUrl) {
    console.log("\n[DEPLOYMENT STATUS] BLOCKED: no public URL configured (process.env.DEPLOYED_URL is unset)");
  } else {
    console.log(`\n[DEPLOYMENT STATUS] DEPLOYED_URL is set: ${deployedUrl}`);
  }

  console.log("\n=============================================");
  console.log("STAGE 8 AUDIT COMPLETED");
}

runStage8().catch((err) => {
  console.error("Stage 8 execution error:", err);
  process.exit(1);
});
