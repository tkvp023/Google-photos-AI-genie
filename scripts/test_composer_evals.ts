// scripts/test_composer_evals.ts — Unit Evals for promptComposer.ts and Stemming Guard
import { isValidComposition, stemWord, sanitizeAnswers, buildFallbackPrompt } from "../src/lib/promptComposer";

console.log("=== Running Unit Evals for lib/promptComposer.ts ===\n");

let passed = 0;
let total = 0;

function check(id: string, description: string, condition: boolean) {
  total++;
  if (condition) {
    passed++;
    console.log(`PASS [OK] ${id}: ${description}`);
  } else {
    console.error(`FAIL [X] ${id}: ${description}`);
  }
}

// 1. Stemming tests
check("STEM-01", "stemWord('swimsuits') -> 'swimsuit'", stemWord("swimsuits") === "swimsuit");
check("STEM-02", "stemWord('swimming') -> 'swim'", stemWord("swimming") === "swim");
check("STEM-03", "stemWord('running') -> 'run'", stemWord("running") === "run");
check("STEM-04", "stemWord('parties') -> 'party'", stemWord("parties") === "party");
check("STEM-05", "stemWord('dresses') -> 'dress'", stemWord("dresses") === "dress");

// 2. Hallucination Guard Accept cases (with stemming)
const allowedSet1 = new Set(["pool", "swimsuit", "friends"]);
check(
  "GUARD-01",
  "Accepts plural 'swimsuits' when 'swimsuit' in allowed set",
  isValidComposition("friends at pool wearing swimsuits", allowedSet1) === true
);

const allowedSet2 = new Set(["beach", "family", "sunset"]);
check(
  "GUARD-02",
  "Accepts exact words + connectors",
  isValidComposition("family on the beach at sunset", allowedSet2) === true
);

// 3. Hallucination Guard Reject cases (invented detail words)
check(
  "GUARD-03",
  "Rejects invented detail 'pizza' not in allowed set",
  isValidComposition("friends at the pool eating pizza", allowedSet1) === false
);

check(
  "GUARD-04",
  "Rejects invented place 'hawaii' not in allowed set",
  isValidComposition("family on the beach in hawaii", allowedSet2) === false
);

// 4. Sanitize and Fallback builder
const sanitized = sanitizeAnswers([
  { questionId: "q1", cueType: "who", value: "friends", source: "chip" },
  { questionId: "q2", cueType: "where", value: "dont_remember", source: "chip" },
  { questionId: "q3", cueType: "look", value: "swimsuit", source: "chip" },
]);
check("CLEAN-01", "Sanitize removes 'dont_remember'", sanitized.length === 2 && !sanitized.includes("dont_remember"));

const fallback = buildFallbackPrompt("pool", ["friends", "red swimsuit"]);
check("FB-01", "Fallback builds comma-joined prompt", fallback === "pool, friends, red swimsuit");

console.log("\n=============================================");
console.log(`Summary: ${passed}/${total} Composer Evals Passed.`);

if (passed === total) {
  console.log("ALL COMPOSER EVALS PASSED! [EXCELLENT]");
} else {
  console.error("SOME EVALS FAILED!");
  process.exit(1);
}
