import fs from "fs";
import path from "path";

// Load .env.local for standalone runner
try {
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
} catch {}

import { search } from "../src/lib/search";
import { rankPhotosWithLLM } from "../src/lib/llmSearch";
import { evaluateTrigger, selectQuestions } from "../src/lib/coachEngine";
import { planQuestionsWithLLM } from "../src/lib/questionPlanner";
import { vagueCheck } from "../src/lib/vagueCheck";

const tags = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "data/tags.json"), "utf8"));
const meta = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "data/photo_meta.json"), "utf8"));

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
  "two children in swimming pool with sunglasses", // Target T01 hint line
  "black and white dog sitting happily inside car", // Target T10 hint line
];

let reportOutput = "";
function logLine(str: string = "") {
  console.log(str);
  reportOutput += str + "\n";
}

async function run() {
  logLine("=== 15-QUERY ACCEPTANCE REPORT ===\n");

  for (const q of queries) {
    await new Promise((r) => setTimeout(r, 600));
    logLine(`\n======================================================`);
    logLine(`QUERY: "${q}"`);

    // 1. Search Candidates
    const rawSearch = search(q);
    let ranked = rawSearch.results;

    if (q.trim().length >= 3 && rawSearch.results.length > 0) {
      try {
        ranked = await rankPhotosWithLLM(q, rawSearch.results);
      } catch (err) {
        console.warn(`[LLM fallback for "${q}"]`);
      }
    }

    const top6 = ranked.slice(0, 6);
    logLine(`TOTAL RESULTS: ${ranked.length} (Tier 1 strong: ${ranked.filter(r => r.tier === 1).length})`);

    if (ranked.length === 0) {
      logLine(`RESULTS: No photos fit this description.`);
    } else {
      logLine(`TOP RESULTS (up to 6):`);
      top6.forEach((p, idx) => {
        const t = tags[`${p.id}.jpg`] || tags[p.id] || p.tag || {};
        const sceneSentence = t.one_line || "No scene sentence";
        const tier = p.tier || (p.score >= 10 ? 1 : 2);
        logLine(`  ${idx + 1}. [${p.id}] (Tier ${tier}, score: ${p.score})`);
        logLine(`     Scene: "${sceneSentence}"`);
        if (p.explanation) {
          logLine(`     Explanation: ${p.explanation}`);
        }
      });
    }

    // 2. Coach Strip (Trigger & Questions)
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

    logLine(`COACH STRIP TRIGGERED: ${trig.shouldTrigger} ${trig.blockedReason ? `(blocked: ${trig.blockedReason})` : ""}`);

    if (trig.shouldTrigger && trig.candidatePhotos.length > 0) {
      const candidates = trig.candidatePhotos;
      let questions: any[] = [];

      // Try LLM planner first
      try {
        const fallbackQs = selectQuestions(candidates, q, []);
        const plannedRes = await planQuestionsWithLLM(q, candidates, fallbackQs, []);
        if (plannedRes?.questions && plannedRes.questions.length > 0) {
          questions = plannedRes.questions;
          logLine(`COACH STRIP SOURCE: LLM Question Planner (${plannedRes.planner_source})`);
        }
      } catch (e) {
        // Fallback
      }

      if (questions.length === 0) {
        questions = selectQuestions(candidates, q, []);
        logLine(`COACH STRIP SOURCE: Deterministic Coach Engine`);
      }

      logLine(`COACH STRIP ROWS & OPTIONS (${questions.length} rows):`);
      questions.forEach((qu, qIdx) => {
        const opts = (qu.options || []).map((o: any) => o.label).join(" | ");
        logLine(`  Row ${qIdx + 1} [${qu.field} / ${qu.cueType}]: "${qu.text}"`);
        logLine(`    Options: [ ${opts} ]`);
      });
    } else {
      logLine(`COACH STRIP: [Not shown]`);
    }
  }

  const reportsDir = path.resolve(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.resolve(reportsDir, "15_query_acceptance_report.txt"), reportOutput, "utf-8");
  console.log("\n=== Acceptance report written to reports/15_query_acceptance_report.txt ===");
}

run();

