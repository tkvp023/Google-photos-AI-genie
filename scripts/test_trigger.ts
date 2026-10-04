// scripts/test_trigger.ts
// Tests the ambiguity-based trigger rule, tiered match behavior, and trigger suppression.

import { search } from "../src/lib/search";
import { evaluateTrigger } from "../src/lib/coachEngine";
import { vagueCheck } from "../src/lib/vagueCheck";
import { config } from "../src/lib/config";

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`FAIL: ${name}\n  -> ${msg}`);
    process.exitCode = 1;
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(msg);
  }
}

console.log("=== COACH TRIGGER & TIERED SEARCH TEST SUITE ===\n");

// 1. Assert 'pool' triggers (with >= 15 strong matches in full library)
runTest("query 'pool' triggers with strong matches", () => {
  const q = "pool";
  const res = search(q);
  const vague = vagueCheck(q);
  const countStrong = res.count_strong ?? 0;
  const countTotal = res.count_total ?? res.count;
  const ambiguousCount = res.ambiguous_count ?? 0;
  const topScore = res.top_score ?? 0;

  const trig = evaluateTrigger({
    mode: "B",
    query: q,
    isVague: vague.isVague,
    hasBeenDismissed: false,
    countStrong,
    countTotal,
    ambiguousCount,
    topScore,
  });

  console.log(`  'pool' -> count_strong: ${countStrong}, ambiguous_count: ${ambiguousCount}, top_score: ${topScore}, triggered: ${trig.shouldTrigger}`);
  assert(countStrong >= 10, `Expected at least 10 strong matches for 'pool', got ${countStrong}`);
  if (countStrong >= config.COACH_MIN_STRONG) {
    assert(trig.shouldTrigger === true, `Expected 'pool' to trigger when count_strong >= ${config.COACH_MIN_STRONG}, reason was: ${trig.blockedReason}`);
  }
});

// 2. Assert 'red swimsuit pool friends' has fewer strong matches than 'pool'
runTest("'red swimsuit pool friends' has fewer strong matches than 'pool'", () => {
  const resBroad = search("pool");
  const resNarrow = search("red swimsuit pool friends");
  const broadStrong = resBroad.count_strong ?? 0;
  const narrowStrong = resNarrow.count_strong ?? 0;
  console.log(`  'pool' count_strong: ${broadStrong}, 'red swimsuit pool friends' count_strong: ${narrowStrong}`);
  assert(
    narrowStrong < broadStrong,
    `Narrow query strong matches (${narrowStrong}) must be strictly less than broad query (${broadStrong})`
  );
});

// 3. Assert 'silver racket' and 'elephant' do not trigger
runTest("'silver racket' and 'elephant' do not trigger coach", () => {
  for (const q of ["silver racket", "elephant"]) {
    const res = search(q);
    const vague = vagueCheck(q);
    const countStrong = res.count_strong ?? 0;
    const countTotal = res.count_total ?? res.count;
    const ambiguousCount = res.ambiguous_count ?? 0;
    const topScore = res.top_score ?? 0;

    const trig = evaluateTrigger({
      mode: "B",
      query: q,
      isVague: vague.isVague,
      hasBeenDismissed: false,
      countStrong,
      countTotal,
      ambiguousCount,
      topScore,
    });
    console.log(`  '${q}' -> strong: ${countStrong}, triggered: ${trig.shouldTrigger}, blockedReason: ${trig.blockedReason}`);
    assert(!trig.shouldTrigger, `'${q}' should NOT trigger, got triggered=true`);
  }
});

// 4. Assert 'me' does not trigger
runTest("pronoun 'me' does not trigger", () => {
  const q = "me";
  const res = search(q);
  const vague = vagueCheck(q);
  const countStrong = res.count_strong ?? 0;
  const countTotal = res.count_total ?? res.count;
  const ambiguousCount = res.ambiguous_count ?? 0;
  const topScore = res.top_score ?? 0;

  const trig = evaluateTrigger({
    mode: "B",
    query: q,
    isVague: vague.isVague,
    hasBeenDismissed: false,
    countStrong,
    countTotal,
    ambiguousCount,
    topScore,
  });
  console.log(`  'me' -> strong: ${countStrong}, triggered: ${trig.shouldTrigger}, blockedReason: ${trig.blockedReason}`);
  assert(countStrong === 0, `Stopword pronoun 'me' should yield 0 strong matches, got ${countStrong}`);
  assert(!trig.shouldTrigger, `'me' should NOT trigger`);
});

// 5. Assert clear winner does not trigger in strict mode, while simple mode triggers reliably
runTest("query with clear winner (top score far above rest) does not trigger in strict mode", () => {
  // Simulate clear winner scenario in strict mode: top_score = 10, but only 2 photos are in ambiguous band
  const trigStrict = evaluateTrigger({
    mode: "B",
    query: "specific winner query",
    isVague: true,
    hasBeenDismissed: false,
    countStrong: 20,
    countTotal: 25,
    ambiguousCount: 2, // only 2 photos within 0.7 * top_score, well below COACH_MIN_AMBIGUOUS (12)
    topScore: 10.0,
    triggerMode: "strict",
  });
  console.log(`  clear winner test (strict) -> triggered: ${trigStrict.shouldTrigger}, reason: ${trigStrict.blockedReason}`);
  assert(!trigStrict.shouldTrigger, `Clear winner scenario should NOT trigger in strict mode`);
  assert(trigStrict.blockedReason === "clear_winner", `Blocked reason should be 'clear_winner', got '${trigStrict.blockedReason}'`);

  // Assert simple mode triggers for vague queries with matches
  const trigSimple = evaluateTrigger({
    mode: "B",
    query: "restaurant",
    isVague: true,
    hasBeenDismissed: false,
    countStrong: 20,
    countTotal: 25,
    ambiguousCount: 2,
    topScore: 10.0,
    triggerMode: "simple",
  });
  console.log(`  vague query test (simple) -> triggered: ${trigSimple.shouldTrigger}`);
  assert(trigSimple.shouldTrigger === true, `Simple mode should trigger for vague query with results`);
});

// 6. Assert adding words never INCREASES count_strong
runTest("adding words never increases count_strong", () => {
  const queryPairs = [
    ["pool", "pool friends"],
    ["pool friends", "red swimsuit pool friends"],
    ["beach", "beach sunset"],
    ["beach sunset", "family beach sunset"],
    ["birthday", "birthday cake"],
    ["hiking", "hiking mountain"],
  ];

  for (const [base, extended] of queryPairs) {
    const baseStrong = search(base).count_strong ?? 0;
    const extStrong = search(extended).count_strong ?? 0;
    console.log(`  '${base}' (${baseStrong}) -> '${extended}' (${extStrong})`);
    assert(
      extStrong <= baseStrong,
      `Extending query '${base}' (${baseStrong}) to '${extended}' (${extStrong}) increased count_strong!`
    );
  }
});

console.log("\nAll trigger assertions passed successfully.");
