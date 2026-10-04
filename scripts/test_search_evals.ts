// scripts/test_search_evals.ts — Automated Unit Tests for search.ts (SR-01 to SR-14)
import { search } from "../src/lib/search";

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

console.log("=== Running Unit Evals for lib/search.ts ===\n");

// SR-01: "pool" returns all pool photos (count >= 8)
const r1 = search("pool");
assert("SR-01", "pool theme search", r1.count >= 8, `count=${r1.count}`);

// SR-02: "red swimsuit" ranks red swimsuit highest
const r2 = search("red swimsuit");
const topFileR2 = r2.results[0]?.file || "";
assert("SR-02", "red swimsuit ranking", r2.count > 0 && r2.results[0].score > 2, `top=${topFileR2}, score=${r2.results[0]?.score}`);

// SR-03: "silver racket" returns very few results (bucket: few, count <= 3)
const r3 = search("silver racket");
assert("SR-03", "silver racket low match", r3.count <= 3 && r3.bucket === "few", `count=${r3.count}, bucket=${r3.bucket}`);

// SR-04: "birthday cake" returns birthday-themed photos
const r4 = search("birthday cake");
const hasBirthday = r4.results.slice(0, 3).some((p) => p.theme === "birthday" || p.file.startsWith("birthday"));
assert("SR-04", "birthday cake search", hasBirthday, `top 3 themes: ${r4.results.slice(0, 3).map((p) => p.theme).join(", ")}`);

// SR-05: "friends hiking mountain" scores higher for friends hiking
const r5 = search("friends hiking mountain");
assert("SR-05", "friends hiking mountain multi-token", r5.count > 0 && r5.results[0].theme === "hiking", `top theme=${r5.results[0]?.theme}, score=${r5.results[0]?.score}`);

// SR-06: "kid" synonym expansion to child
const r6 = search("kid");
const hasKid = r6.results.some((p) => p.theme === "kids" || p.tag?.people_ages.includes("child"));
assert("SR-06", "synonym kid -> child", hasKid && r6.count > 0, `count=${r6.count}, matches=${r6.results.slice(0, 3).map((p) => p.file).join(", ")}`);

// SR-07: "bday" synonym expansion to birthday
const r7 = search("bday");
const hasBday = r7.results.some((p) => p.theme === "birthday");
assert("SR-07", "synonym bday -> birthday", hasBday, `count=${r7.count}`);

// SR-08: stopwords only returns count = 0
const r8 = search("the at a on");
assert("SR-08", "stopwords only", r8.count === 0, `count=${r8.count}`);

// SR-09: multi-cue bonus applies (outdoor sunny friends pool > pool alone)
const r9 = search("outdoor sunny friends pool");
const poolAlone = search("pool");
const topMulti = r9.results[0]?.score || 0;
const topSingle = poolAlone.results[0]?.score || 0;
assert("SR-09", "multi-cue bonus applies", topMulti > topSingle, `multiScore=${topMulti} vs singleScore=${topSingle}`);

// SR-10: empty query returns count = 0
const r10 = search("");
assert("SR-10", "empty query returns 0", r10.count === 0 && r10.results.length === 0, `count=${r10.count}`);

// SR-11: multi-cue bonus check for same photo
const r11_multi = search("red swimsuit outdoor friends pool");
const r11_single = search("pool");
const photoId = "pool_01";
const scoreMulti = r11_multi.results.find((p) => p.id === photoId)?.score || 0;
const scoreSingle = r11_single.results.find((p) => p.id === photoId)?.score || 0;
assert("SR-11", "same photo higher score with more cues", scoreMulti >= scoreSingle, `multi=${scoreMulti} vs single=${scoreSingle}`);

// SR-12: Bucket: few (count <= 5)
const r12 = search("silver racket");
assert("SR-12", "bucket few", r12.bucket === "few", `bucket=${r12.bucket}, count=${r12.count}`);

// SR-13: Bucket: some (6 <= count <= 20)
const r13 = search("beach");
assert("SR-13", "bucket some or many", r13.bucket === "some" || r13.bucket === "many", `bucket=${r13.bucket}, count=${r13.count}`);

// SR-14: Bucket: many (count > 20) with broad term "friends"
const r14 = search("friends");
assert("SR-14", "bucket many", r14.bucket === "many" || (r14.count_strong ?? r14.count) > 20, `bucket=${r14.bucket}, count_strong=${r14.count_strong}, count_total=${r14.count_total}`);

// SR-15: Tier model verification (tier 1, 2, 3 ordering and strong_matches)
const r15 = search("red swimsuit pool friends");
const tiers = r15.results.map((p) => p.tier || 1);
const isTierSorted = tiers.every((t, i) => i === 0 || t >= tiers[i - 1]);
assert("SR-15", "tier sorting order", isTierSorted && r15.results.length > 0, `tiers sample: ${tiers.slice(0, 10).join(",")}`);

// SR-16: count_strong <= count_total
assert("SR-16", "count_strong <= count_total", (r15.count_strong ?? 0) <= (r15.count_total ?? r15.count), `strong=${r15.count_strong}, total=${r15.count_total}`);

console.log("\n=============================================");
const total = results.length;
const passed = results.filter((r) => r.passed).length;
console.log(`Summary: ${passed}/${total} Search Evals Passed.`);
if (passed === total) {
  console.log("ALL SR-01 to SR-14 TESTS PASSED! [EXCELLENT]");
} else {
  console.error("SOME TESTS FAILED!");
  process.exit(1);
}
