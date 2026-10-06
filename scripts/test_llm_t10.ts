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

import { search } from "../src/lib/search";
import { rankPhotosWithLLM } from "../src/lib/llmSearch";

async function main() {
  const q = "black and white dog sitting happily inside car";
  const raw = search(q);
  console.log("Raw candidates count:", raw.results.length);
  const ranked = await rankPhotosWithLLM(q, raw.results);
  const tier1 = ranked.filter(p => p.tier === 1);
  console.log("Tier 1 count after LLM ranking:", tier1.length);
  console.log("Top 3 ranked:");
  ranked.slice(0, 3).forEach((p, i) => {
    console.log(`  ${i+1}. [${p.id}] (tier ${p.tier}, score ${p.score}) explanation: ${p.explanation}`);
  });
}

main();
