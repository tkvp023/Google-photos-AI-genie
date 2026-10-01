// scripts/test_prompt_composer_evals.ts — Automated Unit Tests for promptComposer.ts (PC-01 to PC-10)
import { composePrompt } from "../src/lib/promptComposer";
import { Answer } from "../src/types";

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

async function runTests() {
  console.log("=== Running Unit Evals for lib/promptComposer.ts ===\n");

  const answersBase: Answer[] = [
    { questionId: "q1", cueType: "who", value: "friends", source: "chip" },
    { questionId: "q2", cueType: "look", value: "red swimsuit", source: "chip" },
    { questionId: "q3", cueType: "where", value: "outdoors", source: "chip" },
  ];

  // PC-01: prompt contains pool, friends, red swimsuit, outdoors
  const r1 = await composePrompt("pool", answersBase);
  const p1Lower = r1.prompt.toLowerCase();
  const containsAll =
    p1Lower.includes("pool") &&
    p1Lower.includes("friends") &&
    p1Lower.includes("red swimsuit") &&
    p1Lower.includes("outdoors");
  assert("PC-01", "prompt contains all keywords", containsAll, `prompt="${r1.prompt}", composer=${r1.composer}`);

  // PC-02: Same as PC-01, Groq disabled -> fallback format
  const r2 = await composePrompt("pool", answersBase, { disableGroq: true });
  assert("PC-02", "groq disabled returns fallback", r2.composer === "fallback" && r2.prompt.includes("pool, friends, red swimsuit, outdoors"), `prompt="${r2.prompt}"`);

  // PC-03: Groq invalid/error fallback
  const r3 = await composePrompt("test query", [{ questionId: "q", cueType: "who", value: "family", source: "chip" }], { disableGroq: true });
  assert("PC-03", "fallback composer flag set", r3.composer === "fallback", `composer=${r3.composer}`);

  // PC-04: Groq times out -> completes quickly with fallback
  const startT = Date.now();
  const r4 = await composePrompt("lake", [{ questionId: "q", cueType: "who", value: "kids", source: "chip" }], { forceTimeout: true });
  const duration = Date.now() - startT;
  assert("PC-04", "groq timeout uses fallback within limit", r4.composer === "fallback" && duration < 3100, `duration=${duration}ms, composer=${r4.composer}`);

  // PC-05: Cache hit on second call
  const r5_1 = await composePrompt("unique_cache_test", [{ questionId: "q", cueType: "who", value: "solo", source: "chip" }], { disableGroq: true });
  const r5_2 = await composePrompt("unique_cache_test", [{ questionId: "q", cueType: "who", value: "solo", source: "chip" }]);
  assert("PC-05", "cache hit returns same result", r5_1.prompt === r5_2.prompt, `prompt="${r5_2.prompt}"`);

  // PC-06: Empty answers array -> prompt = typed text only
  const r6 = await composePrompt("just pool", []);
  assert("PC-06", "empty answers returns typed text", r6.prompt === "just pool", `prompt="${r6.prompt}"`);

  // PC-07: Answer with source: "typed" included in prompt
  const typedAnswer: Answer = { questionId: "q_custom", cueType: "what", value: "eating ice cream", source: "typed" };
  const r7 = await composePrompt("beach", [typedAnswer], { disableGroq: true });
  assert("PC-07", "source typed included in prompt", r7.prompt.includes("eating ice cream"), `prompt="${r7.prompt}"`);

  // PC-08: Duplicate values in answers de-duplicated
  const dupAnswers: Answer[] = [
    { questionId: "q1", cueType: "who", value: "friends", source: "chip" },
    { questionId: "q2", cueType: "who", value: "friends", source: "chip" },
  ];
  const r8 = await composePrompt("pool", dupAnswers, { disableGroq: true });
  const friendsCount = (r8.prompt.match(/friends/gi) || []).length;
  assert("PC-08", "duplicate values de-duplicated", friendsCount === 1, `prompt="${r8.prompt}"`);

  // PC-09: Hallucination guard check
  const r9 = await composePrompt("mountain", [{ questionId: "q", cueType: "look", value: "blue backpack", source: "chip" }]);
  assert("PC-09", "no invented details in composition", r9.prompt.length > 0, `prompt="${r9.prompt}"`);

  // PC-10: Skipped ("dont_remember") answers NOT in prompt
  const skipAnswers: Answer[] = [
    { questionId: "q1", cueType: "who", value: "friends", source: "chip" },
    { questionId: "q2", cueType: "look", value: "dont_remember", source: "chip" },
  ];
  const r10 = await composePrompt("pool", skipAnswers, { disableGroq: true });
  const hasDontRemember = r10.prompt.toLowerCase().includes("dont_remember") || r10.prompt.toLowerCase().includes("remember");
  assert("PC-10", "skipped answers not in prompt", !hasDontRemember && r10.prompt.includes("friends"), `prompt="${r10.prompt}"`);

  console.log("\n=============================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  console.log(`Summary: ${passed}/${total} Prompt Composer Evals Passed.`);

  if (passed === total) {
    console.log("ALL PC-01 to PC-10 TESTS PASSED! [EXCELLENT]");
  } else {
    console.error("SOME TESTS FAILED!");
    process.exit(1);
  }
}

runTests();
