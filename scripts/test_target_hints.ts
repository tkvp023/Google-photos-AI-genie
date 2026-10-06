// scripts/test_target_hints.ts — Tests Target Hint Queries T01 and T10
import { search } from "../src/lib/search";

console.log("=== Testing Target Hint Queries ===\n");

// Target T01 hint line: "two children in swimming pool with sunglasses"
const q1 = "two children in swimming pool with sunglasses";
const res1 = search(q1);
console.log(`Query 1: "${q1}" -> ${res1.results.length} matches`);
if (res1.results.length === 0) {
  console.error("FAIL: Expected matches for query 1");
  process.exit(1);
}
console.log(`PASS [OK] Target T01 query matched. Top result: ${res1.results[0].id} (Score: ${res1.results[0].score})`);

// Target T10 hint line: "black and white dog sitting happily inside car"
const q2 = "black and white dog sitting happily inside car";
const res2 = search(q2);
console.log(`Query 2: "${q2}" -> ${res2.results.length} matches`);
if (res2.results.length === 0) {
  console.error("FAIL: Expected matches for query 2");
  process.exit(1);
}
console.log(`PASS [OK] Target T10 query matched. Top result: ${res2.results[0].id} (Score: ${res2.results[0].score})`);

console.log("\nALL TARGET HINT TESTS PASSED! [EXCELLENT]");
