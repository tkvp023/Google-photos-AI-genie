// scripts/test_coach_evals.ts — Automated Unit Tests for coachEngine.ts (CE-01 to CE-12)
import {
  selectQuestions,
  computeBalanceScore,
  genericFallbackQuestions,
  filterCandidates,
  FieldDistribution,
} from "../src/lib/coachEngine";
import { dataStore } from "../src/lib/dataLoader";
import { Answer, PhotoItem, PhotoTag } from "../src/types";

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(id: string, name: string, condition: boolean, details: string) {
  results.push({ id, name, passed: condition, details });
  const icon = condition ? "PASS [OK]" : "FAIL [X]";
  console.log(`${icon} ${id}: ${name} — ${details}`);
}

console.log("=== Running Unit Evals for lib/coachEngine.ts ===\n");

const allPhotos = dataStore.getPhotos();
// Mock a set of 15 pool candidates
const poolCandidates = allPhotos.slice(0, 15);

// CE-01: selectQuestions on pool candidates returns <= 3 questions with distinct cue types
const q1 = selectQuestions(poolCandidates, "pool", []);
const distinctCuesQ1 = new Set(q1.map((q) => q.cueType)).size;
assert("CE-01", "distinct cue types <= 3", q1.length <= 3 && distinctCuesQ1 === q1.length && q1.length > 0, `count=${q1.length}, cues=${q1.map((q) => q.cueType).join(", ")}`);

// CE-02: Query already contains "friends" -> who question NOT in returned questions
const q2 = selectQuestions(poolCandidates, "pool friends", []);
const hasWhoQ2 = q2.some((q) => q.cueType === "who");
assert("CE-02", "query contains friends excludes who", !hasWhoQ2, `cues=${q2.map((q) => q.cueType).join(", ")}`);

// CE-03: Query already contains "outdoor" -> indoor/outdoor question NOT shown
const q3 = selectQuestions(poolCandidates, "pool outdoors", []);
const hasWhereInOutQ3 = q3.some((q) => q.field === "indoor_outdoor");
assert("CE-03", "query contains outdoor excludes indoor/outdoor", !hasWhereInOutQ3, `fields=${q3.map((q) => q.field).join(", ")}`);

// CE-04: Field coverage < 0.6 -> that field skipped
const lowCoverageDist: FieldDistribution = {
  field: "mood",
  cueType: "what",
  counts: { happy: 3, sad: 2 },
  totalValid: 5,
  coverage: 0.5, // < 0.6
};
const scoreLowCov = computeBalanceScore(lowCoverageDist, 1.0);
assert("CE-04", "field coverage < 0.6 skipped", scoreLowCov === 0, `score=${scoreLowCov}`);

// CE-05: Candidates < 4 -> generic fallback questions returned
const threeCandidates = poolCandidates.slice(0, 3);
const q5 = selectQuestions(threeCandidates, "pool", []);
const isFallbackQ5 = q5.length > 0 && q5.every((q) => q.layer === "generic_fallback");
assert("CE-05", "candidates < 4 returns generic fallback", isFallbackQ5, `layer=${q5[0]?.layer}, count=${q5.length}`);

// CE-06: All 3 questions answered -> selectQuestions returns empty array
const threeAnswers: Answer[] = [
  { questionId: "q1", cueType: "who", value: "friends", source: "chip" },
  { questionId: "q2", cueType: "where", value: "outdoor", source: "chip" },
  { questionId: "q3", cueType: "occasion", value: "party", source: "chip" },
];
const q6 = selectQuestions(poolCandidates, "pool", threeAnswers);
assert("CE-06", "all 3 questions answered returns empty", q6.length === 0, `count=${q6.length}`);

// CE-07: Balance score: even split has higher score than lopsided split
const evenDist: FieldDistribution = {
  field: "test",
  cueType: "who",
  counts: { a: 10, b: 10 },
  totalValid: 20,
  coverage: 1.0,
};
const lopsidedDist: FieldDistribution = {
  field: "test",
  cueType: "who",
  counts: { a: 19, b: 1 },
  totalValid: 20,
  coverage: 1.0,
};
const scoreEven = computeBalanceScore(evenDist, 1.0);
const scoreLopsided = computeBalanceScore(lopsidedDist, 1.0);
assert("CE-07", "even split score > lopsided split score", scoreEven > scoreLopsided, `even=${scoreEven.toFixed(3)} vs lopsided=${scoreLopsided.toFixed(3)}`);

// CE-08: Balance score: 100% one value has score ≈ 0
const singleValDist: FieldDistribution = {
  field: "test",
  cueType: "who",
  counts: { a: 20 },
  totalValid: 20,
  coverage: 1.0,
};
const scoreSingle = computeBalanceScore(singleValDist, 1.0);
assert("CE-08", "100% one value score is 0", scoreSingle === 0, `score=${scoreSingle}`);

// CE-09: Re-rank after chip tap (filter reduces candidates and changes top question)
const filteredAfterWho = filterCandidates(allPhotos, [
  { questionId: "q_group_type", cueType: "who", value: "friends", source: "chip" },
]);
const q9 = selectQuestions(filteredAfterWho, "pool", [
  { questionId: "q_group_type", cueType: "who", value: "friends", source: "chip" },
]);
assert("CE-09", "questions adapt after chip tap", q9.length > 0 && !q9.some((q) => q.cueType === "who"), `new cues=${q9.map((q) => q.cueType).join(", ")}`);

// CE-10: Occasion option labelled with "?" suffix
const genericOccasion = genericFallbackQuestions("pool", []).find((q) => q.cueType === "occasion");
const hasQuestionMarkSuffix = genericOccasion?.options.every((opt) => opt.label.endsWith("?"));
assert("CE-10", "occasion option has '?' suffix", Boolean(hasQuestionMarkSuffix), `labels=${genericOccasion?.options.map((o) => o.label).join(", ")}`);

// CE-11: tag_coverage < MIN_TAG_COVERAGE (0.9) returns Layer 1 generic questions
const q11 = selectQuestions(poolCandidates, "pool", [], 0.85); // 0.85 < 0.90
const isFallbackQ11 = q11.every((q) => q.layer === "generic_fallback");
assert("CE-11", "tag coverage < 0.9 returns generic fallback", isFallbackQ11, `layer=${q11[0]?.layer}`);

// CE-12: COACH_STOP_AT (8) candidates reached -> selectQuestions returns empty
const eightCandidates = poolCandidates.slice(0, 8);
const q12 = selectQuestions(eightCandidates, "pool", []);
assert("CE-12", "COACH_STOP_AT reached returns empty", q12.length === 0, `count=${q12.length}`);

console.log("\n=============================================");
const total = results.length;
const passed = results.filter((r) => r.passed).length;
console.log(`Summary: ${passed}/${total} Coach Engine Evals Passed.`);

if (passed === total) {
  console.log("ALL CE-01 to CE-12 TESTS PASSED! [EXCELLENT]");
} else {
  console.error("SOME TESTS FAILED!");
  process.exit(1);
}
