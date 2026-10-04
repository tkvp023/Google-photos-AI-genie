// scripts/test_cue_classifier.ts — Automated Unit Tests for classifyCues
import { classifyCues } from "../src/lib/cueClassifier";

interface TestCase {
  id: string;
  input: string;
  mustInclude?: string[];
  minCount: number;
  expectedCount?: number;
  expectedHas2Plus: boolean;
}

const testCases: TestCase[] = [
  {
    id: "CC-01",
    input: "pool",
    mustInclude: ["where"],
    minCount: 1,
    expectedCount: 1,
    expectedHas2Plus: false,
  },
  {
    id: "CC-02",
    input: "me with friends at the pool in red swimsuits, outdoors",
    mustInclude: ["who", "where", "look"],
    minCount: 3,
    expectedHas2Plus: true,
  },
  {
    id: "CC-03",
    input: "birthday party in summer",
    mustInclude: ["occasion", "when"],
    minCount: 2,
    expectedHas2Plus: true,
  },
  {
    id: "CC-04",
    input: "swimming in Goa",
    mustInclude: ["what", "where"],
    minCount: 2,
    expectedHas2Plus: true,
  },
  {
    id: "CC-05",
    input: "Alice with family",
    mustInclude: ["who"],
    minCount: 1,
    expectedCount: 1,
    expectedHas2Plus: false,
  },
  {
    id: "CC-06",
    input: "2023 graduation",
    mustInclude: ["when", "occasion"],
    minCount: 2,
    expectedHas2Plus: true,
  },
  {
    id: "CC-07",
    input: "",
    minCount: 0,
    expectedCount: 0,
    expectedHas2Plus: false,
  },
  {
    id: "CC-08",
    input: "cheerful party",
    mustInclude: ["mood", "occasion"],
    minCount: 2,
    expectedHas2Plus: true,
  },
  {
    id: "CC-09",
    input: "relaxed vibe at beach",
    mustInclude: ["mood", "where"],
    minCount: 2,
    expectedHas2Plus: true,
  },
];

console.log("=== Running Unit Evals for lib/cueClassifier.ts ===\n");

let passed = 0;
for (const tc of testCases) {
  const res = classifyCues(tc.input);

  const includesOk = tc.mustInclude
    ? tc.mustInclude.every((c) => (res.cueTypes as string[]).includes(c))
    : true;
  const countOk = tc.expectedCount !== undefined ? res.cueCount === tc.expectedCount : res.cueCount >= tc.minCount;
  const has2PlusOk = res.has2PlusCues === tc.expectedHas2Plus;

  const ok = includesOk && countOk && has2PlusOk;

  if (ok) {
    passed++;
    console.log(
      `PASS [OK] ${tc.id}: "${tc.input}" -> cues=[${res.cueTypes.join(", ")}], count=${res.cueCount}, has2Plus=${res.has2PlusCues}`
    );
  } else {
    console.error(
      `FAIL [X] ${tc.id}: "${tc.input}" -> got cues=[${res.cueTypes.join(", ")}], count=${res.cueCount}, has2Plus=${res.has2PlusCues} (expected minCount=${tc.minCount}, mustInclude=${tc.mustInclude?.join(",")})`
    );
  }
}

console.log("\n=============================================");
console.log(`Summary: ${passed}/${testCases.length} Cue Classifier Evals Passed.`);

if (passed === testCases.length) {
  console.log("ALL CC-01 to CC-07 TESTS PASSED! [EXCELLENT]");
} else {
  console.error("SOME TESTS FAILED!");
  process.exit(1);
}
