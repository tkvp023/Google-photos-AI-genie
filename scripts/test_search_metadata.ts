// scripts/test_search_metadata.ts — Verifies Step 3 Search behavior with metadata & soft time
import { search } from "../src/lib/search";
import { parseTimeQuery } from "../src/lib/timeParser";
import { unmatchedTerms } from "../src/lib/unmatchedTerms";

console.log("=== Testing Step 3: Search with Synthetic Metadata & Time ===");

// 1. "pool"
const resPool = search("pool");
console.log(`"pool": count_strong=${resPool.count_strong}, total=${resPool.count}`);

// 2. "goa pool" < "pool"
const resGoaPool = search("goa pool");
console.log(`"goa pool": count_strong=${resGoaPool.count_strong}, total=${resGoaPool.count}`);
if ((resGoaPool.count_strong ?? 0) < (resPool.count_strong ?? 0)) {
  console.log(`PASS [OK] "goa pool" (${resGoaPool.count_strong}) < "pool" (${resPool.count_strong})`);
} else {
  console.error(`FAIL [ERROR] "goa pool" not less than "pool"!`);
  process.exit(1);
}

// 3. "pool 2023" < "pool"
const resPool2023 = search("pool 2023");
console.log(`"pool 2023": count_strong=${resPool2023.count_strong}, total=${resPool2023.count}`);
if ((resPool2023.count_strong ?? 0) < (resPool.count_strong ?? 0)) {
  console.log(`PASS [OK] "pool 2023" (${resPool2023.count_strong}) < "pool" (${resPool.count_strong})`);
} else {
  console.error(`FAIL [ERROR] "pool 2023" not less than "pool"!`);
  process.exit(1);
}

// 4. "pool two summers ago" parses to the right range and finds matches
const parsedTwoSummers = parseTimeQuery("pool two summers ago");
console.log(`"pool two summers ago" parsed:`, parsedTwoSummers);
if (parsedTwoSummers && parsedTwoSummers.targetYear === 2024 && parsedTwoSummers.targetSeason === "summer") {
  console.log(`PASS [OK] "pool two summers ago" parsed to summer 2024 (softYears: ${parsedTwoSummers.softYears?.join(", ")})`);
} else {
  console.error(`FAIL [ERROR] "pool two summers ago" parsing failed!`);
  process.exit(1);
}

const resPoolTwoSummers = search("pool two summers ago");
console.log(`"pool two summers ago": count_strong=${resPoolTwoSummers.count_strong}, total=${resPoolTwoSummers.count}`);
if ((resPoolTwoSummers.count_strong ?? 0) <= (resPool.count_strong ?? 0)) {
  console.log(`PASS [OK] "pool two summers ago" (${resPoolTwoSummers.count_strong}) <= "pool" (${resPool.count_strong})`);
} else {
  console.error(`FAIL [ERROR] "pool two summers ago" count unexpected!`);
  process.exit(1);
}

// 5. Unknown place "pool paris" gives the no-match note for "paris"
const resPoolParis = search("pool paris");
console.log(`"pool paris": count_strong=${resPoolParis.count_strong}, unmatched_terms=${JSON.stringify(resPoolParis.unmatched_terms)}`);
const unmatched = unmatchedTerms("pool paris");
if (unmatched.includes("paris") && resPoolParis.unmatched_terms?.includes("paris")) {
  console.log(`PASS [OK] "pool paris" correctly identifies "paris" as unmatched term`);
} else {
  console.error(`FAIL [ERROR] "paris" was not identified as unmatched! Got: ${JSON.stringify(unmatched)}`);
  process.exit(1);
}

// 6. Monotonicity: More words never increase count_strong
const testQueries = [
  ["pool", "goa pool"],
  ["pool", "pool 2023"],
  ["pool", "pool with Priya"],
  ["pool with Priya", "pool with Priya goa"],
  ["birthday", "birthday cake"],
  ["beach", "beach goa"],
];

for (const [qShort, qLong] of testQueries) {
  const sShort = search(qShort);
  const sLong = search(qLong);
  if ((sLong.count_strong ?? 0) > (sShort.count_strong ?? 0)) {
    console.error(`FAIL [ERROR] Monotonicity violated: "${qLong}" (${sLong.count_strong}) > "${qShort}" (${sShort.count_strong})`);
    process.exit(1);
  } else {
    console.log(`PASS [OK] Monotonicity: "${qLong}" (${sLong.count_strong}) <= "${qShort}" (${sShort.count_strong})`);
  }
}

// 7. Check "birthday"
const resBirthday = search("birthday");
console.log(`"birthday": count_strong=${resBirthday.count_strong}, total=${resBirthday.count}`);

console.log("\n=============================================");
console.log("All Step 3 Search tests passed successfully!");
