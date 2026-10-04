// scripts/test_vague_evals.ts — Automated Unit Tests for vagueCheck.ts
import { vagueCheck } from "../src/lib/vagueCheck";

interface TestCase {
  id: string;
  input: string;
  expectedVague: boolean;
  expectedPreciseCount: number;
}

const testCases: TestCase[] = [
  { id: "VC-01", input: "pool", expectedVague: true, expectedPreciseCount: 0 },
  { id: "VC-02", input: "pool 2023", expectedVague: true, expectedPreciseCount: 1 },
  { id: "VC-03", input: "pool goa 2023", expectedVague: false, expectedPreciseCount: 2 },
  { id: "VC-04", input: "pool with Priya", expectedVague: true, expectedPreciseCount: 1 },
  { id: "VC-05", input: "pool with Priya goa", expectedVague: false, expectedPreciseCount: 2 },
  { id: "VC-06", input: "me at the beach", expectedVague: true, expectedPreciseCount: 0 },
  { id: "VC-07", input: "Priya in Goa 2022", expectedVague: false, expectedPreciseCount: 3 },
  { id: "VC-08", input: "", expectedVague: true, expectedPreciseCount: 0 },
  { id: "VC-09", input: "silver racket", expectedVague: true, expectedPreciseCount: 0 },
  { id: "VC-10", input: "birthday party", expectedVague: true, expectedPreciseCount: 0 },
  { id: "VC-11", input: "pool last summer", expectedVague: true, expectedPreciseCount: 0 }, // Relative phrase is NOT precise
  { id: "VC-12", input: "pool few years ago", expectedVague: true, expectedPreciseCount: 0 }, // Relative phrase is NOT precise
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
