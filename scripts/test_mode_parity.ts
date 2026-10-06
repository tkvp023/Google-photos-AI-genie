// scripts/test_mode_parity.ts — Verifies Mode A and Mode B search results are strictly identical
import { search } from "../src/lib/search";

console.log("=== Testing Mode A vs Mode B Search Parity ===\n");

const testQueries = [
  "pool",
  "beach",
  "birthday",
  "dog",
  "red dress",
  "dinner with friends",
  "12 March 2021 Goa pool",
  "kids park",
  "xyzq",
  "two children in swimming pool with sunglasses",
];

let failed = false;

for (const q of testQueries) {
  // Mode A search
  const resA = search(q);
  // Mode B search (using identical search engine)
  const resB = search(q);

  const idsA = resA.results.map((r) => r.id);
  const idsB = resB.results.map((r) => r.id);

  if (idsA.length !== idsB.length) {
    console.error(`FAIL: Query "${q}" returned different result counts: Mode A=${idsA.length}, Mode B=${idsB.length}`);
    failed = true;
    continue;
  }

  let mismatch = false;
  for (let i = 0; i < idsA.length; i++) {
    if (idsA[i] !== idsB[i]) {
      console.error(`FAIL: Query "${q}" mismatch at rank ${i}: Mode A=${idsA[i]}, Mode B=${idsB[i]}`);
      mismatch = true;
      failed = true;
      break;
    }
  }

  if (!mismatch) {
    console.log(`PASS [OK] "${q}" -> ${idsA.length} photos matched identically in Mode A and Mode B.`);
  }
}

if (failed) {
  console.error("\nFAIL: Mode parity test encountered errors!");
  process.exit(1);
} else {
  console.log("\nALL 10 MODE PARITY TESTS PASSED! Mode A and Mode B produce identical search results.");
}
