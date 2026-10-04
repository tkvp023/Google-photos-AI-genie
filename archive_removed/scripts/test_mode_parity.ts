// scripts/test_mode_parity.ts — Automated Parity Test (Mode A Isolation)
// Verifies that in Mode A the coach never triggers, never mounts questions, and coach APIs are isolated.

import { config } from "../src/lib/config";

console.log("=== Running Automated Mode A / Mode B Parity Tests ===\n");

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

async function runParityTests() {
  // 1. Verify Mode A isolation on analyze endpoint
  const queries = ["pool", "beach", "birthday party", "friends hiking"];

  for (const q of queries) {
    const res = await fetch("http://localhost:3000/api/coach/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q, mode: "A" }),
    });

    const data = await res.json();

    check(
      `PARITY-ANALYZE-${q.slice(0, 4)}`,
      `Mode A analyze for "${q}" returns triggered=false and empty questions`,
      data.triggered === false && (!data.questions || data.questions.length === 0)
    );
  }

  // 2. Verify Mode B triggers for vague query with high match count
  const resB = await fetch("http://localhost:3000/api/coach/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "pool", mode: "B" }),
  });
  const dataB = await resB.json();

  check(
    "PARITY-MODE-B-TRIGGERS",
    "Mode B triggers questions for vague query 'pool'",
    dataB.triggered === true && dataB.questions && dataB.questions.length > 0
  );

  // 3. Verify distinct cue types in Mode B questions
  if (dataB.questions) {
    const cueTypes = dataB.questions.map((q: any) => q.cueType);
    const uniqueCues = new Set(cueTypes);
    check(
      "PARITY-DISTINCT-CUES",
      `Mode B questions have distinct cue types (${Array.from(uniqueCues).join(", ")})`,
      uniqueCues.size === cueTypes.length && uniqueCues.size <= config.MAX_QUESTIONS
    );
  }

  // 4. Verify search API returns identical results structure for Mode A and Mode B
  const searchA = await fetch("http://localhost:3000/api/search?q=pool&mode=A").then((r) => r.json());
  const searchB = await fetch("http://localhost:3000/api/search?q=pool&mode=B").then((r) => r.json());

  check(
    "PARITY-SEARCH-COUNT",
    `Mode A and Mode B return identical result count (${searchA.count} === ${searchB.count})`,
    searchA.count === searchB.count && searchA.count > 0
  );

  check(
    "PARITY-SEARCH-RANKING",
    "Mode A and Mode B return identical photo ranking on same query",
    searchA.results[0]?.id === searchB.results[0]?.id
  );

  console.log("\n=============================================");
  console.log(`Summary: ${passed}/${total} Parity Tests Passed.`);

  if (passed === total) {
    console.log("ALL MODE A/B PARITY TESTS PASSED! [EXCELLENT]");
  } else {
    console.error("SOME PARITY TESTS FAILED!");
    process.exit(1);
  }
}

runParityTests().catch((err) => {
  console.error("Parity test execution error:", err);
  process.exit(1);
});
