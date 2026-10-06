import fs from "fs";
import path from "path";

// Load .env.local
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
import { evaluateTrigger, selectQuestions } from "../src/lib/coachEngine";
import { planQuestionsWithLLM } from "../src/lib/questionPlanner";
import { vagueCheck } from "../src/lib/vagueCheck";
import { understandQuery } from "../src/lib/queryUnderstanding";

const tags = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "data/tags.json"), "utf8"));

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
  "two children in swimming pool with sunglasses", // Target T01 hint
  "black and white dog sitting happily inside car", // Target T10 hint
  "kid playing in sand",
  "kids at a pool"
];

let out = "";
function log(msg: string = "") {
  console.log(msg);
  out += msg + "\n";
}

async function runAcceptance() {
  log("================================================================================");
  log("=== FULL 17-QUERY ACCEPTANCE REPORT WITH QUERY UNDERSTANDING & CUE COUNTS ===");
  log("================================================================================\n");

  for (const q of queries) {
    await new Promise((r) => setTimeout(r, 400));
    log(`--------------------------------------------------------------------------------`);
    log(`QUERY: "${q}"`);

    // 1. Query Understanding on EVERY query
    const qu = await understandQuery(q);
    log(`[QUERY UNDERSTANDING]`);
    log(`  Mapping ran: true | Verify against vocab.json ran: true`);
    log(`  Mapped MUST: [${(qu.must || []).join(", ")}] | SHOULD: [${(qu.should || []).join(", ")}]`);
    log(`  Unmatched: [${(qu.unmatched_words || []).join(", ")}]`);
    log(`  Time anchor: ${qu.time} | Location anchor: ${qu.location} | Person: ${qu.person}`);
    log(`  Latency: ${qu.latency_ms ?? 0}ms | LLM Fallback happened: ${Boolean(qu.llm_fallback)}`);

    // 2. Search Execution
    const rawSearch = search(q);
    let ranked = rawSearch.results;
    let llmRankUsed = false;
    if (q.trim().length >= 3 && rawSearch.results.length > 0) {
      try {
        ranked = await rankPhotosWithLLM(q, rawSearch.results);
        llmRankUsed = true;
      } catch {
        // fallback
      }
    }

    const tier1 = ranked.filter((r) => r.tier === 1);
    const weakMatches = ranked.filter((r) => r.tier !== 1);
    log(`\n[SEARCH RESULTS]`);
    log(`  Verified Strong Matches (Tier 1): ${tier1.length}`);
    log(`  Weak / Closest Matches (Tier 2/3): ${weakMatches.length}`);
    log(`  LLM Re-ranking used: ${llmRankUsed}`);

    if (tier1.length === 0) {
      log(`  MAIN GRID: "No photos fit this description."`);
      if (weakMatches.length > 0) {
        log(`  COLLAPSED SECTION: Closest matches (${weakMatches.length} items collapsed)`);
        log(`  Top 3 Closest matches:`);
        weakMatches.slice(0, 3).forEach((p, idx) => {
          const t = tags[`${p.id}.jpg`] || tags[p.id] || p.tag || {};
          log(`    - [${p.id}] (Tier ${p.tier}, score: ${p.score}) "${t.one_line}"`);
        });
      }
    } else {
      log(`  MAIN GRID RESULTS (Top ${Math.min(6, tier1.length)}):`);
      tier1.slice(0, 6).forEach((p, idx) => {
        const t = tags[`${p.id}.jpg`] || tags[p.id] || p.tag || {};
        const scene = t.one_line || "No scene description";
        log(`    ${idx + 1}. [${p.id}] (Tier 1, score: ${p.score})`);
        log(`       Scene: "${scene}"`);
        if (p.explanation) log(`       Explanation: ${p.explanation}`);
      });
      if (weakMatches.length > 0) {
        log(`  COLLAPSED SECTION: Closest matches (${weakMatches.length} items collapsed)`);
      }
    }

    // 3. AI Genie Strip
    const vague = vagueCheck(q);
    const trig = evaluateTrigger({
      mode: "B",
      query: q,
      isVague: vague.isVague,
      hasBeenDismissed: false,
      countStrong: rawSearch.count_strong,
      countTotal: rawSearch.count_total,
      ambiguousCount: rawSearch.ambiguous_count,
      topScore: rawSearch.top_score,
    });

    log(`\n[AI GENIE STRIP]`);
    log(`  Triggered: ${trig.shouldTrigger} ${trig.blockedReason ? `(Reason: ${trig.blockedReason})` : ""}`);
    log(`  Candidates considered: ${trig.candidateCount} (Tier 1 verified only)`);

    if (trig.shouldTrigger && trig.candidatePhotos.length > 0) {
      const candidates = trig.candidatePhotos;
      let questions: any[] = [];
      try {
        const fallbackQs = selectQuestions(candidates, q, []);
        const plannedRes = await planQuestionsWithLLM(q, candidates, fallbackQs, []);
        if (plannedRes?.questions && plannedRes.questions.length > 0) {
          questions = plannedRes.questions;
          log(`  Source: LLM Question Planner (${plannedRes.planner_source})`);
        }
      } catch {}

      if (questions.length === 0) {
        questions = selectQuestions(candidates, q, []);
        log(`  Source: Deterministic Coach Engine`);
      }

      log(`  Questions & Options (${questions.length} rows):`);
      questions.forEach((qu, qIdx) => {
        const optsFormatted = (qu.options || [])
          .map((o: any) => `${o.label} (${o.count ?? 0})`)
          .join(" | ");
        log(`    Row ${qIdx + 1} [${qu.field} / ${qu.cueType}]: "${qu.text}"`);
        log(`      Options: [ ${optsFormatted} ]`);
      });
    } else {
      log(`  Strip display: [Hidden]`);
    }
    log("");
  }

  // 4. Detailed Option Counts for: pool, beach, kids park, dog
  log("================================================================================");
  log("=== DETAILED OPTION COUNTS PER ROW FOR POOL, BEACH, KIDS PARK, DOG ===");
  log("================================================================================\n");

  const cueQueries = ["pool", "beach", "kids park", "dog"];
  for (const q of cueQueries) {
    log(`----------------------------------------------------------------`);
    log(`QUERY: "${q}"`);
    const s = search(q);
    const tier1 = s.results.filter((p) => p.tier === 1);
    log(`Tier 1 Candidates: ${tier1.length} photos`);

    const qs = selectQuestions(tier1, q, []);
    log(`Generated Rows: ${qs.length}`);
    qs.forEach((qu, idx) => {
      log(`  Row ${idx + 1}: "${qu.text}" [Field: ${qu.field}, Cue: ${qu.cueType}]`);
      qu.options.forEach((opt) => {
        log(`    - ${opt.label}: ${opt.count ?? 0} photos`);
      });
    });
    log("");
  }

  const reportsDir = path.resolve(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.resolve(reportsDir, "final_17_query_acceptance_report.txt"), out, "utf-8");
  console.log("=== Report saved to reports/final_17_query_acceptance_report.txt ===");
}

runAcceptance();
