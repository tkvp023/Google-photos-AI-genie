import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envLines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of envLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

import { understandQuery } from "../src/lib/queryUnderstanding";

const queries = [
  "pasta",
  "xyzq",
  "pool",
  "kids park",
  "birthday",
  "dog",
  "beach",
  "red dress",
  "dinner with friends",
  "pool with friends in Goa",
  "a couple of summers ago, with friends",
  "me",
  "12 March 2021 Goa pool",
  "two children in swimming pool with sunglasses",
  "black and white dog sitting happily inside car",
  "kid playing in sand",
  "kids at a pool",
];

async function main() {
  console.log("GROQ_API_KEY present:", Boolean(process.env.GROQ_API_KEY));
  for (const q of queries) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await understandQuery(q);
    console.log(`Query: "${q}" -> fallback: ${res.llm_fallback}, latency: ${res.latency_ms}ms, model: ${res.model}, must: [${res.must.join(", ")}]`);
  }
}

main();
