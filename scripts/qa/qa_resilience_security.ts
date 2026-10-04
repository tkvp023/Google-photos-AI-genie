// scripts/qa/qa_resilience_security.ts
import fs from "fs";
import path from "path";
import http from "http";
import { execSync } from "child_process";
import { search } from "../../src/lib/search";
import { vagueCheck } from "../../src/lib/vagueCheck";
import { composePrompt } from "../../src/lib/promptComposer";

console.log("=== STAGE 7: RESILIENCE & SECURITY AUDIT ===\n");

const BASE_URL = "http://localhost:3000";

let moderatorPin = "";
if (fs.existsSync(".env.local")) {
  const match = fs.readFileSync(".env.local", "utf-8").match(/MODERATOR_PIN\s*=\s*(.+)/);
  if (match) moderatorPin = match[1].trim();
}

async function request(options: {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(options.path, BASE_URL);
    const reqHeaders: Record<string, string> = { "x-test-suite": "true", ...options.headers };
    let payload = "";
    if (options.body) {
      payload = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
      reqHeaders["Content-Type"] = "application/json";
      reqHeaders["Content-Length"] = Buffer.byteLength(payload).toString();
    }
    const req = http.request(
      url,
      {
        method: options.method || "GET",
        headers: reqHeaders,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode || 0, headers: res.headers, body: data }));
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runStage7() {
  let stage7Pass = true;
  const stage7Failures: string[] = [];

  // --- 1. Adversarial & Malformed Inputs ---
  console.log("--- 1. Adversarial & Malformed Input Handling ---");
  const testInputs = [
    { name: "Long text (5,000 chars)", input: "pool ".repeat(1000) },
    { name: "Emoji", input: "🏊‍♂️ 🌊 🎂 🏖️ 🎉" },
    { name: "Unicode & Multilingual", input: "café mañana 日本語 한국어 русский 123" },
    { name: "HTML injection", input: "<script>alert('xss')</script><img src=x onerror=alert(1)>" },
    { name: "SQL injection pattern", input: "' OR '1'='1' -- DROP TABLE events; SELECT * FROM users;" },
    { name: "Quotes and control characters", input: "\"'`\\0\\n\\r\t<>&" },
  ];

  for (const t of testInputs) {
    try {
      // 1. In-process search
      const sRes = search(t.input);
      // 2. HTTP search
      const httpRes = await request({ path: `/api/search?q=${encodeURIComponent(t.input.slice(0, 500))}` });
      // 3. HTTP coach analyze
      const coachRes = await request({
        path: "/api/coach/analyze",
        method: "POST",
        body: { query: t.input.slice(0, 500), mode: "B" },
      });

      const pass = httpRes.status === 200 && coachRes.status === 200 && !isNaN(sRes.count);
      console.log(`Input [${t.name}]: HTTP search=${httpRes.status}, coach=${coachRes.status}, count=${sRes.count} | ${pass ? "PASS [OK]" : "FAIL"}`);
      if (!pass) {
        stage7Pass = false;
        stage7Failures.push(`Adversarial input "${t.name}" failed: HTTP search=${httpRes.status}, coach=${coachRes.status}`);
      }
    } catch (err: any) {
      console.log(`Input [${t.name}]: CRASHED with error: ${err.message}`);
      stage7Pass = false;
      stage7Failures.push(`Adversarial input "${t.name}" threw an unhandled exception: ${err.message}`);
    }
  }

  // --- 2. Path Traversal Audit on Photo Route ---
  console.log("\n--- 2. Path Traversal Audit (/api/photos/[id] and /photo/[id]) ---");
  const traversalPayloads = [
    "../../package.json",
    "..%2f..%2fpackage.json",
    "%2e%2e%2f%2e%2e%2fpackage.json",
    "....//....//package.json",
    "/etc/passwd",
    "C:\\Windows\\win.ini",
  ];

  for (const p of traversalPayloads) {
    const res = await request({ path: `/api/photos/${encodeURIComponent(p)}` });
    // Must return 400, 404, or refused without leaking file contents
    const leaked = res.body.includes('"name": "google-photos-mvp"') || res.body.includes("[fonts]");
    console.log(`Traversal payload "${p}": HTTP ${res.status}, leaked: ${leaked} | ${!leaked ? "PASS [SECURE]" : "FAIL [LEAK]"}`);
    if (leaked) {
      stage7Pass = false;
      stage7Failures.push(`Path traversal payload "${p}" LEAKED sensitive file content!`);
    }
  }

  // --- 3. Client Bundle (.next/static) Secret Grep ---
  console.log("\n--- 3. Client Bundle (.next/static) Secret Leakage Scan ---");
  const staticDir = path.join(process.cwd(), ".next", "static");
  if (fs.existsSync(staticDir)) {
    const patterns = [
      { name: "Google AIza Key", regex: /AIza[0-9A-Za-z_-]{35}/g },
      { name: "Groq Key", regex: /gsk_[0-9A-Za-z]{20,}/g },
      { name: "OpenAI Key", regex: /sk-[0-9A-Za-z]{20,}/g },
    ];

    let bundleHits = 0;
    const staticFiles = execSync("powershell -Command \"Get-ChildItem -Recurse .next/static -Filter *.js | Select-Object -ExpandProperty FullName\"", { encoding: "utf-8" })
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);

    console.log(`Scanning ${staticFiles.length} client JavaScript chunks in .next/static...`);

    let pinInBundle = false;
    for (const f of staticFiles) {
      try {
        const content = fs.readFileSync(f, "utf-8");
        for (const pat of patterns) {
          if (pat.regex.test(content)) {
            console.log(`[ALERT] Client bundle chunk "${path.basename(f)}" matched ${pat.name}! REDACTED.`);
            bundleHits++;
          }
        }
        const nonPolyfillContent = content.replace(/["']0123456789["']/g, "");
        if (moderatorPin && nonPolyfillContent.includes(moderatorPin)) {
          pinInBundle = true;
          console.log(`[CRITICAL] Client bundle chunk "${path.basename(f)}" contains literal MODERATOR_PIN!`);
        }
      } catch {}
    }

    console.log(`API keys in client bundle: ${bundleHits === 0 ? "PASS [NONE FOUND]" : `FAIL [${bundleHits} HITS]`}`);
    console.log(`Moderator PIN in client bundle: ${!pinInBundle ? "PASS [NONE FOUND]" : "FAIL [PIN EXPOSED IN CLIENT BUNDLE]"}`);
    if (pinInBundle) {
      stage7Pass = false;
      stage7Failures.push("Literal MODERATOR_PIN is bundled into client JavaScript in .next/static (from src/app/moderator/page.tsx default state)");
    }
    if (bundleHits > 0) {
      stage7Pass = false;
      stage7Failures.push(`Found ${bundleHits} API key patterns in client bundle chunks`);
    }
  } else {
    console.log("No .next/static directory found to scan.");
  }

  // --- 4. CORS and Rate Limiting Audit ---
  console.log("\n--- 4. CORS & Rate Limiting Audit ---");
  const testEndpoints = ["/api/search?q=pool", "/api/coach/analyze", "/api/log", "/api/photos"];

  for (const ep of testEndpoints) {
    const isPost = ep.includes("analyze") || ep.includes("log");
    const res = await request({
      path: ep,
      method: isPost ? "POST" : "GET",
      body: isPost ? { query: "pool", mode: "B", sessionId: "qa_cors_check", participantId: "P_TEST" } : undefined,
    });
    const cors = res.headers["access-control-allow-origin"] || "None";
    const rateLimit = res.headers["x-ratelimit-limit"] || res.headers["ratelimit-limit"] || "None";
    console.log(`Endpoint ${ep}: CORS = ${cors}, RateLimit = ${rateLimit}`);
  }
  console.log("Rate limiting: None configured on Next.js API routes (report as finding/absence).");

  // --- 5. Unset Environment Variables Fallback Audit ---
  console.log("\n--- 5. Unset Environment Variables Resilience Audit ---");
  // Test prompt composer fallback when Groq key is dummy / unset
  const originalGroqKey = process.env.GROQ_API_KEY;
  try {
    delete process.env.GROQ_API_KEY;
    const composed = await composePrompt("pool", [
      { questionId: "q_who", cueType: "who", value: "friends", source: "chip" },
    ]);
    console.log(`Prompt composer fallback without GROQ_API_KEY: composer=${composed.composer}, prompt="${composed.prompt}" | ${composed.prompt.includes("friends") ? "PASS [OK]" : "FAIL"}`);
  } finally {
    if (originalGroqKey) process.env.GROQ_API_KEY = originalGroqKey;
  }

  console.log("\n=============================================");
  console.log(`STAGE 7 OVERALL: ${stage7Pass ? "PASS [OK]" : "FAIL / VULNERABILITIES DETECTED"}`);
  if (stage7Failures.length > 0) {
    console.log(`Failures/Vulnerabilities (${stage7Failures.length}):`);
    stage7Failures.forEach((f) => console.log(`  - ${f}`));
  }
}

runStage7().catch((err) => {
  console.error("Stage 7 execution error:", err);
  process.exit(1);
});
