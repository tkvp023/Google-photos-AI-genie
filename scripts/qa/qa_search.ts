// scripts/qa/qa_search.ts
import { search } from "../../src/lib/search";
import { vagueCheck } from "../../src/lib/vagueCheck";
import { parseTimeQuery, scoreTimeMatch, DEMO_TODAY } from "../../src/lib/timeParser";
import { dataStore } from "../../src/lib/dataLoader";

console.log("=== STAGE 3: SEARCH & VAGUE CHECK AUDIT ===\n");

// Ensure dataStore is initialized
dataStore.init();

let stage3Pass = true;
const stage3Failures: string[] = [];

// 1. Single theme words typed alone
console.log("--- 1. Single Theme Words (Expect >= 10 Tier-1 Matches in Own Theme) ---");
const themeWords: Record<string, string> = {
  pool: "pool",
  beach: "beach",
  restaurant: "restaurant",
  birthday: "birthday",
  festival: "festival",
  hiking: "hiking",
  kids: "kids",
  graduation: "graduation",
  dog: "pets",
  "road trip": "roadtrip",
};

for (const [query, expectedTheme] of Object.entries(themeWords)) {
  const res = search(query);
  const tier1 = res.results.filter((r) => r.tier === 1);
  const tier1InTheme = tier1.filter((r) => (r.id && r.id.startsWith(expectedTheme)) || (r.file && r.file.startsWith(expectedTheme)) || r.theme === expectedTheme);
  const pass = tier1InTheme.length >= 10;
  console.log(
    `Query: "${query}" -> Total: ${res.count}, Tier-1: ${tier1.length}, Tier-1 in theme '${expectedTheme}': ${tier1InTheme.length} | ${pass ? "PASS [OK]" : "FAIL [<10]"}`
  );
  if (!pass) {
    stage3Pass = false;
    stage3Failures.push(`Single theme word "${query}" has ${tier1InTheme.length} tier-1 matches in theme ${expectedTheme} (expected >= 10)`);
  }
}

// 2. Multi-word queries
console.log("\n--- 2. Multi-Word Queries Audit ---");
const multiWordQueries = [
  "me in a pool",
  "red swimsuit pool friends",
  "birthday party",
  "family picnic",
  "kids park",
  "park kids",
  "friends at the beach",
  "silver racket",
  "pool 2023",
  "pool goa",
  "pool goa 2023",
  "pool two summers ago",
  "pool with Meera",
  "elephant",
  "asdfgh",
  "me",
];

const resultsMap: Record<string, any> = {};

for (const q of multiWordQueries) {
  const res = search(q);
  resultsMap[q] = res;
  const top5 = res.results.slice(0, 5).map((r) => `${r.id || r.file} (T${r.tier}, sc:${r.score}, flds:[${r.matchedFields.join(",")}])`);
  console.log(`\nQuery: "${q}"`);
  console.log(`  Tokens: [${res.unmatched_terms ? "unmatched:" + res.unmatched_terms.join(",") : ""}], Total: ${res.count_total}, Strong(T1): ${res.count_strong}, Ambiguous: ${res.ambiguous_count}`);
  console.log(`  Top 5: ${top5.length > 0 ? top5.join(" | ") : "None"}`);
}

// Verify "kids park" and "park kids" return identical results
const resKidsPark = resultsMap["kids park"];
const resParkKids = resultsMap["park kids"];
const kpIds = resKidsPark.results.map((r: any) => r.id || r.file).join(",");
const pkIds = resParkKids.results.map((r: any) => r.id || r.file).join(",");
const sameKpPk = kpIds === pkIds;
console.log(`\nOrder invariance: "kids park" vs "park kids" identical results: ${sameKpPk ? "PASS [OK]" : "FAIL [DIFF]"}`);
if (!sameKpPk) {
  stage3Pass = false;
  stage3Failures.push('"kids park" vs "park kids" produced different order/results');
}

// Verify "elephant" and "asdfgh" have 0 matches
const elCount = resultsMap["elephant"].count_total;
const asdfCount = resultsMap["asdfgh"].count_total;
console.log(`No-match queries: "elephant" count=${elCount}, "asdfgh" count=${asdfCount} | ${elCount === 0 && asdfCount === 0 ? "PASS [OK]" : "FAIL [NONZERO]"}`);
if (elCount !== 0 || asdfCount !== 0) {
  stage3Pass = false;
  stage3Failures.push(`Zero-match queries returned non-zero results: elephant=${elCount}, asdfgh=${asdfCount}`);
}

// Verify "me" does not match anything (it is a stopword)
const meCount = resultsMap["me"].count_total;
console.log(`Stopword query "me": count=${meCount} | ${meCount === 0 ? "PASS [OK]" : "FAIL [NONZERO]"}`);
if (meCount !== 0) {
  stage3Pass = false;
  stage3Failures.push(`Stopword "me" matched ${meCount} photos`);
}

// 3. Property Tests: 300 random 1-4 word queries
console.log("\n--- 3. Property Tests (300 queries: Monotonicity, Determinism, Mode Parity) ---");
const vocab = [
  "pool", "beach", "restaurant", "birthday", "festival", "hiking", "kids",
  "graduation", "dog", "road trip", "friends", "family", "red", "blue",
  "swimsuit", "party", "cake", "sunset", "mountain", "outdoor", "indoor",
  "summer", "winter", "goa", "chennai", "meera", "rohan", "backpack",
  "water", "dancing", "eating", "picnic", "table", "trees", "yellow"
];

let monotonicityViolations = 0;
let determinismViolations = 0;

for (let i = 0; i < 300; i++) {
  const len = Math.floor(Math.random() * 3) + 1; // 1 to 3 words
  const words: string[] = [];
  for (let j = 0; j < len; j++) {
    words.push(vocab[Math.floor(Math.random() * vocab.length)]);
  }
  const q1 = words.join(" ");
  const extraWord = vocab[Math.floor(Math.random() * vocab.length)];
  const q2 = `${q1} ${extraWord}`;

  const res1 = search(q1);
  const res1_again = search(q1);

  // Determinism check
  if (res1.count_total !== res1_again.count_total || res1.count_strong !== res1_again.count_strong) {
    determinismViolations++;
  }

  // Monotonicity check: adding a word must never increase count_strong (tier-1)
  const res2 = search(q2);
  const s1 = res1.count_strong ?? 0;
  const s2 = res2.count_strong ?? 0;
  if (s2 > s1) {
    monotonicityViolations++;
    console.log(`Monotonicity VIOLATION: "${q1}" (${s1}) -> "${q2}" (${s2})`);
  }
}

console.log(`Monotonicity violations: ${monotonicityViolations} / 300 (PASS: ${monotonicityViolations === 0})`);
console.log(`Determinism violations: ${determinismViolations} / 300 (PASS: ${determinismViolations === 0})`);
if (monotonicityViolations > 0) {
  stage3Pass = false;
  stage3Failures.push(`Found ${monotonicityViolations} monotonicity violations in count_strong`);
}
if (determinismViolations > 0) {
  stage3Pass = false;
  stage3Failures.push(`Found ${determinismViolations} non-deterministic search executions`);
}

// 4. Time parser test
console.log("\n--- 4. Time Parser and Soft-Range Scoring Audit ---");
const timeCases = [
  { phrase: "2023", expectedPrecise: true, targetYear: 2023 },
  { phrase: "March 2021", expectedPrecise: true, targetYear: 2021, targetMonth: 3 },
  { phrase: "summer 2024", expectedPrecise: true, targetYear: 2024, targetSeason: "summer" },
  { phrase: "last year", expectedPrecise: false, targetYear: 2025 },
  { phrase: "two years ago", expectedPrecise: false, targetYear: 2024 },
  { phrase: "a couple of years ago", expectedPrecise: false, targetYear: 2024 },
  { phrase: "few years ago", expectedPrecise: false, targetYear: 2023 },
  { phrase: "earlier", expectedPrecise: false },
];

for (const tc of timeCases) {
  const parsed = parseTimeQuery(`pool ${tc.phrase}`);
  if (!parsed) {
    console.log(`FAIL: Could not parse time phrase: "${tc.phrase}"`);
    stage3Pass = false;
    stage3Failures.push(`Time parser failed to parse "${tc.phrase}"`);
    continue;
  }
  const matchInside = scoreTimeMatch(parsed, parsed.targetYear || 2023, parsed.targetMonth, parsed.targetSeason);
  const matchAdjacent = scoreTimeMatch(parsed, (parsed.targetYear || 2023) - 1, parsed.targetMonth, parsed.targetSeason);
  const matchFar = scoreTimeMatch(parsed, (parsed.targetYear || 2023) - 5, parsed.targetMonth, parsed.targetSeason);

  console.log(
    `Phrase: "${tc.phrase}" -> parsedYear=${parsed.targetYear}, isPrecise=${parsed.isPrecise} | score(target)=${matchInside.scoreMultiplier}, score(+/-1yr)=${matchAdjacent.scoreMultiplier}, score(far)=${matchFar.scoreMultiplier}`
  );
  if (matchInside.scoreMultiplier !== 1.0) {
    console.log(`  FAIL: Exact target year multiplier was ${matchInside.scoreMultiplier}, expected 1.0`);
    stage3Failures.push(`Time scoreMultiplier for target year was ${matchInside.scoreMultiplier} on "${tc.phrase}"`);
  }
  if (matchFar.scoreMultiplier !== 0) {
    console.log(`  FAIL: Far year multiplier was ${matchFar.scoreMultiplier}, expected 0.0`);
    stage3Failures.push(`Time scoreMultiplier for far year was ${matchFar.scoreMultiplier} on "${tc.phrase}"`);
  }
}

// 5. Vague check table (expected vs actual)
console.log("\n--- 5. Vague Check Table ---");
const vagueTable = [
  { query: "pool", expectedVague: true, note: "0 precise anchors" },
  { query: "me in a pool", expectedVague: true, note: "0 precise anchors" },
  { query: "pool 2021", expectedVague: true, note: "1 precise (time)" },
  { query: "pool goa", expectedVague: true, note: "1 precise (location)" },
  { query: "12 March 2021 Goa pool", expectedVague: false, note: "2 precise (time + location)" },
  { query: "pool with Meera goa", expectedVague: false, note: "2 precise (person + location)" },
  { query: "last summer at the beach", expectedVague: true, note: "0 precise (last summer is relative/fuzzy)" },
];

let vagueErrors = 0;
for (const item of vagueTable) {
  const vc = vagueCheck(item.query);
  const pass = vc.isVague === item.expectedVague;
  console.log(
    `Query: "${item.query}" -> isVague=${vc.isVague} (precise=${vc.preciseCount}, P:${vc.anchors.person}, T:${vc.anchors.time}, L:${vc.anchors.location}) | Expected: ${item.expectedVague} (${item.note}) -> ${pass ? "PASS [OK]" : "FAIL [MISMATCH]"}`
  );
  if (!pass) {
    vagueErrors++;
    stage3Failures.push(`vagueCheck("${item.query}") returned isVague=${vc.isVague}, expected ${item.expectedVague}`);
  }
}

// 6. Substring false positive checks
console.log("\n--- 6. Substring False Positives Audit ---");
const resWomen = search("women");
const resSummer = search("summer");
const resTime = search("time");
// "me" alone
const resMe = search("me");
// Check that none of the results for "women", "summer", "time" matched because of "me"
let meFalsePositives = 0;
for (const p of [...resWomen.results, ...resSummer.results, ...resTime.results]) {
  if (p.matches?.some(m => m.token === "me")) {
    meFalsePositives++;
  }
}
console.log(`False positive "me" matches inside whole words (women/summer/time): ${meFalsePositives} | ${meFalsePositives === 0 ? "PASS [OK]" : "FAIL [LEAK]"}`);
if (meFalsePositives > 0) {
  stage3Pass = false;
  stage3Failures.push(`Substring "me" matched inside other words ${meFalsePositives} times`);
}

// 7. Latency benchmark (p50 / p95 for 200 search calls)
console.log("\n--- 7. Latency Benchmark (200 search calls) ---");
const testQueries = [
  "pool", "beach", "me in a pool", "red swimsuit pool friends", "birthday party",
  "kids park", "restaurant", "hiking mountain trail", "dog park", "road trip"
];
const latencies: number[] = [];
for (let i = 0; i < 200; i++) {
  const q = testQueries[i % testQueries.length];
  const t0 = performance.now();
  search(q);
  const t1 = performance.now();
  latencies.push(t1 - t0);
}
latencies.sort((a, b) => a - b);
const p50 = latencies[Math.floor(latencies.length * 0.5)].toFixed(2);
const p95 = latencies[Math.floor(latencies.length * 0.95)].toFixed(2);
const maxLat = latencies[latencies.length - 1].toFixed(2);
console.log(`Search latency over 200 calls: p50 = ${p50} ms, p95 = ${p95} ms, max = ${maxLat} ms`);

console.log("\n=============================================");
console.log(`STAGE 3 OVERALL: ${stage3Pass && vagueErrors === 0 ? "PASS [OK]" : "FAIL / DEVIATIONS DETECTED"}`);
if (stage3Failures.length > 0) {
  console.log(`Failures/Deviations (${stage3Failures.length}):`);
  stage3Failures.forEach(f => console.log(`  - ${f}`));
}
