// scripts/test_vague_evals.ts — Automated Unit Tests for vagueCheck.ts (VC-01 to VC-10)
import { vagueCheck } from "../src/lib/vagueCheck";

interface TestCase {
  id: string;
  input: string;
  expectedVague: boolean;
  expectedPreciseCount: number;
}

const testCases: TestCase[] = [
  { id: "VC-01", input: "pool", expectedVague: true, expectedPreciseCount: 0 },
  { id: "VC-02", input: "me at the pool", expectedVague: true, expectedPreciseCount: 0 },
  { id: "VC-03", input: "silver racket", expectedVague: true, expectedPreciseCount: 0 },
  { id: "VC-04", input: "12 March 2021 pool", expectedVague: false, expectedPreciseCount: 2 },
  { id: "VC-05", input: "beach", expectedVague: true, expectedPreciseCount: 0 },
  { id: "VC-06", input: "birthday party", expectedVague: true, expectedPreciseCount: 0 },
  { id: "VC-07", input: "2023 pool", expectedVague: false, expectedPreciseCount: 1 },
  { id: "VC-08", input: "", expectedVague: true, expectedPreciseCount: 0 },
  { id: "VC-09", input: "pool me friends", expectedVague: true, expectedPreciseCount: 0 },
  { id: "VC-10", input: "january 2022 beach", expectedVague: false, expectedPreciseCount: 1 },
];

console.log("=== Running Unit Evals for lib/vagueCheck.ts ===\n");

let passed = 0;
for (const tc of testCases) {
  const res = vagueCheck(tc.input);
  const matchVague = res.isVague === tc.expectedVague;
  const matchCount = res.preciseCount === tc.expectedPreciseCount;
  const ok = matchVague && matchCount;

  if (ok) {
    passed++;
    console.log(`PASS [OK] ${tc.id}: "${tc.input}" -> isVague=${res.isVague}, count=${res.preciseCount}`);
  } else {
    console.error(`FAIL [X] ${tc.id}: "${tc.input}" -> expected (isVague=${tc.expectedVague}, count=${tc.expectedPreciseCount}), got (isVague=${res.isVague}, count=${res.preciseCount})`);
  }
}

console.log("\n=============================================");
console.log(`Summary: ${passed}/${testCases.length} Vague Check Evals Passed.`);

if (passed === testCases.length) {
  console.log("ALL VC-01 to VC-10 TESTS PASSED! [EXCELLENT]");
} else {
  console.error("SOME TESTS FAILED!");
  process.exit(1);
}
