// scripts/diagnose/trace_trigger_after.ts
import fs from "fs";
import path from "path";
import { search, normalise } from "../../src/lib/search";
import { evaluateTrigger } from "../../src/lib/coachEngine";
import { vagueCheck } from "../../src/lib/vagueCheck";
import { unmatchedTerms } from "../../src/lib/unmatchedTerms";

const QUERIES = [
  "me in a restaurant",
  "restaurant",
  "family picnic",
  "family",
  "friends",
  "pool",
  "me in a pool",
  "beach",
  "birthday party",
  "hiking",
  "festival",
  "kids park",
  "graduation",
  "dog",
  "road trip",
  "cake",
  "sunset",
  "elephant",
  "me",
];

export interface TraceRow {
  query: string;
  tokens: string[];
  recognisedTokens: string[];
  countTotal: number;
  countStrong: number;
  ambiguousCount: number;
  topSecond: string;
  blockedReason: string;
  shouldTrigger: boolean;
}

export function runTrace(): TraceRow[] {
  const rows: TraceRow[] = [];

  for (const q of QUERIES) {
    const rawTokens = q
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi, " ")
      .split(/\s+/)
      .filter(Boolean);

    const unmatched = new Set(unmatchedTerms(q));
    const norm = normalise(q);
    const recognised = norm.filter((t) => !unmatched.has(t));

    const sr = search(q);
    const countTotal = sr.count_total ?? sr.count;
    const countStrong = sr.count_strong ?? 0;
    const ambiguousCount = sr.ambiguous_count ?? 0;

    const topScore = sr.results[0]?.score ?? 0;
    const secondScore = sr.results[1]?.score ?? 0;
    const topSecond = `${topScore.toFixed(1)}/${secondScore.toFixed(1)}`;

    const vc = vagueCheck(q);
    const trig = evaluateTrigger({
      mode: "B",
      query: q,
      isVague: vc.isVague,
      hasBeenDismissed: false,
      countStrong,
      countTotal,
      ambiguousCount,
      topScore,
    });

    const blockedReason = trig.shouldTrigger ? "none" : trig.blockedReason;

    rows.push({
      query: q,
      tokens: rawTokens,
      recognisedTokens: recognised,
      countTotal,
      countStrong,
      ambiguousCount,
      topSecond,
      blockedReason,
      shouldTrigger: trig.shouldTrigger,
    });
  }

  return rows;
}

const rows = runTrace();
const lines: string[] = [
  "query | tokens | recognised tokens | count_total | count_strong | ambiguous_count | top/second | blockedReason",
];

for (const r of rows) {
  const line = `${r.query} | [${r.tokens.join(", ")}] | [${r.recognisedTokens.join(", ")}] | ${r.countTotal} | ${r.countStrong} | ${r.ambiguousCount} | ${r.topSecond} | ${r.blockedReason}`;
  lines.push(line);
  console.log(line);
}

const outDir = path.resolve(process.cwd(), "reports");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
const outPath = path.join(outDir, "trace_after.txt");
fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf-8");
console.log(`\nSaved to ${outPath}`);
