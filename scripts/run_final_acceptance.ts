import fs from "fs";
import path from "path";

// Load .env.local into process.env using built-in fs
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envLines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of envLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        process.env[key] = val;
      }
    }
  }
}

import { search } from "../src/lib/search";
import { rankPhotosWithLLM } from "../src/lib/llmSearch";
import { understandQuery } from "../src/lib/queryUnderstanding";
import { vagueCheck } from "../src/lib/vagueCheck";
import { evaluateTrigger, selectQuestions } from "../src/lib/coachEngine";
import tagsData from "../data/tags.json";
import { Question } from "../src/types";

const QUERIES_19 = [
  "dinner with friends",
  "friends at pool",
  "sunset at beach",
  "birthday party cake",
  "hiking in mountains",
  "dog playing outdoor",
  "graduation ceremony",
  "music festival crowd",
  "road trip highway",
  "black and white dog sitting happily inside car",
  "a couple of summers ago, with friends",
  "kids park",
  "kid playing in sand",
  "kids at a pool",
  "friends in goa",
  "red dress",
  "me",
  "child playing on the beach",
  "friends at a restaurant"
];

const SINGLE_WORDS = [
  "pool",
  "beach",
  "dog",
  "kids",
  "festival",
  "graduation",
  "hiking",
  "road trip",
  "restaurant",
  "birthday"
];

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log("================================================================================");
  console.log("FINAL ACCEPTANCE EVALUATION: 19 BENCHMARK QUERIES + 10 SINGLE WORDS");
  console.log("================================================================================\n");

  console.log("=== PART 1: 19 BENCHMARK QUERIES ===");
  for (let i = 0; i < QUERIES_19.length; i++) {
    const q = QUERIES_19[i];
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`QUERY [${i + 1}/19]: "${q}"`);
    console.log(`--------------------------------------------------------------------------------`);

    // Pacing between LLM calls to respect Groq rate limits
    if (i > 0) await sleep(2500);

    const t0 = Date.now();
    const qu = await understandQuery(q);
    const quLatency = Date.now() - t0;

    const llmCalled = !qu.llm_fallback;
    const model = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
    console.log(`[LLM Status] Called: ${llmCalled ? "YES" : "NO"} | Model: ${model} | Latency: ${quLatency}ms | Fallback: ${qu.llm_fallback}`);
    console.log(`[Query Understanding] Must: [${qu.must.join(", ")}] | Should: [${qu.should.join(", ")}] | Unmatched: [${qu.unmatched_words.join(", ")}] | Vague: ${qu.is_vague}`);

    // Lexical initial search
    const searchRes = search(q);

    // LLM Re-ranking / Verification step
    let finalResults = searchRes.results;
    if (q.trim().length >= 3 && searchRes.results.length > 0) {
      try {
        finalResults = await rankPhotosWithLLM(q, searchRes.results);
      } catch (err) {
        console.warn("LLM ranking error:", err);
      }
    }

    const tier1 = finalResults.filter((p) => (p.tier || 3) === 1);
    const tier2 = finalResults.filter((p) => (p.tier || 3) === 2);
    console.log(`[Search Results] Tier 1 Count: ${tier1.length} | Tier 2 Count: ${tier2.length} | Total: ${finalResults.length}`);

    // Top 6 photos with scene sentences
    console.log(`[Top 6 Photos]:`);
    const top6 = finalResults.slice(0, 6);
    if (top6.length === 0) {
      console.log(`  (No photos fit this description)`);
    } else {
      top6.forEach((p, idx) => {
        const tag = (tagsData as any)[p.id] || (tagsData as any)[p.id + ".jpg"] || (tagsData as any)[p.file] || {};
        const sceneSentence = tag.one_line || "(No scene sentence)";
        const tierStr = p.tier === 1 ? "Tier 1" : (p.tier === 2 ? "Tier 2" : "Tier 3");
        console.log(`  ${idx + 1}. [${p.id}] (${tierStr}) - "${sceneSentence}"`);
      });
    }

    // Specificity & Strip Trigger Evaluation
    const vc = vagueCheck(q);
    const trigger = evaluateTrigger({
      query: q,
      isVague: vc.isVague,
      genieOff: false,
      hasBeenDismissed: false,
      mode: "B",
    });

    const stripShown = trigger.shouldTrigger;
    const reason = trigger.shouldTrigger
      ? "Triggered (passes ambiguity & candidate thresholds)"
      : (trigger.blockedReason ? `Blocked: ${trigger.blockedReason}` : (trigger.noMatchState ? "No matching photos" : "Not triggered"));
    console.log(`[AI Genie Strip] Shown: ${stripShown ? "YES" : "NO"} | Reason: ${reason}`);

    if (stripShown && trigger.candidatePhotos.length > 0) {
      const questions: Question[] = selectQuestions(trigger.candidatePhotos, q);
      console.log(`[Question Rows (${questions.length})]:`);
      if (questions.length === 0) {
        console.log(`  (No questions passed filtering thresholds)`);
      } else {
        questions.forEach((row, rIdx) => {
          const optsStr = row.options.map((o) => `"${o.label}" (${o.count ?? 0} photos)`).join(", ");
          console.log(`  Row ${rIdx + 1} [${row.cueType}]: "${row.text}" -> Options: [${optsStr}]`);
        });
      }
    } else {
      console.log(`[Strip Rows]: (Strip hidden)`);
    }
  }

  console.log("\n================================================================================");
  console.log("=== PART 2: 10 SINGLE-WORD QUERIES (Tier 1 Counts) ===");
  console.log("================================================================================\n");

  for (let i = 0; i < SINGLE_WORDS.length; i++) {
    const word = SINGLE_WORDS[i];
    const res = search(word);
    console.log(`- "${word}": Tier 1 = ${res.count_strong} photos (Total = ${res.results.length})`);
  }

  console.log("\n================================================================================");
  console.log("EVALUATION FINISHED");
  console.log("================================================================================");
}

run().catch((err) => {
  console.error("Evaluation error:", err);
  process.exit(1);
});
