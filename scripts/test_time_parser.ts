// scripts/test_time_parser.ts — Automated Unit Tests for timeParser.ts
import { parseTimeQuery, scoreTimeMatch } from "../src/lib/timeParser";

function assert(name: string, condition: boolean, details: string) {
  const icon = condition ? "PASS [OK]" : "FAIL [X]";
  console.log(`${icon} ${name} — ${details}`);
  if (!condition) {
    process.exitCode = 1;
  }
}

console.log("=== Testing src/lib/timeParser.ts ===\n");

// 1. Exact year
const t1 = parseTimeQuery("pool 2023");
assert("Exact year 2023", t1 !== null && t1.targetYear === 2023 && t1.isPrecise === true, `parsed: ${JSON.stringify(t1)}`);

// 2. Month + Year
const t2 = parseTimeQuery("beach May 2023");
assert("Month + Year", t2 !== null && t2.targetMonth === 5 && t2.targetYear === 2023 && t2.isPrecise === true, `parsed: ${JSON.stringify(t2)}`);

// 3. Month alone
const t3 = parseTimeQuery("hiking in January");
assert("Month alone", t3 !== null && t3.targetMonth === 1 && t3.isPrecise === false, `parsed: ${JSON.stringify(t3)}`);

// 4. Season alone
const t4 = parseTimeQuery("pool in summer");
assert("Season alone", t4 !== null && t4.targetSeason === "summer" && t4.isPrecise === false, `parsed: ${JSON.stringify(t4)}`);

// 5. Relative phrases
const t5a = parseTimeQuery("photos from this year");
assert("this year (2026)", t5a !== null && t5a.targetYear === 2026 && t5a.isRelative === true && t5a.isPrecise === false, `year=${t5a?.targetYear}`);

const t5b = parseTimeQuery("roadtrip last year");
assert("last year (2025)", t5b !== null && t5b.targetYear === 2025 && t5b.isRelative === true, `year=${t5b?.targetYear}`);

const t5c = parseTimeQuery("pool two years ago");
assert("two years ago (2024)", t5c !== null && t5c.targetYear === 2024 && t5c.isRelative === true, `year=${t5c?.targetYear}`);

const t5d = parseTimeQuery("a couple of years ago in goa");
assert("couple of years ago (2024)", t5d !== null && t5d.targetYear === 2024, `year=${t5d?.targetYear}`);

const t5e = parseTimeQuery("few years ago birthday");
assert("few years ago (2023)", t5e !== null && t5e.targetYear === 2023, `year=${t5e?.targetYear}`);

const t5f = parseTimeQuery("pool last summer");
assert("last summer (summer 2025)", t5f !== null && t5f.targetYear === 2025 && t5f.targetSeason === "summer", `parsed=${JSON.stringify(t5f)}`);

const t5g = parseTimeQuery("pool two summers ago");
assert("two summers ago (summer 2024)", t5g !== null && t5g.targetYear === 2024 && t5g.targetSeason === "summer", `parsed=${JSON.stringify(t5g)}`);

// 6. Soft range matching
const filter2023 = parseTimeQuery("pool 2023")!;
// Photo in 2023 -> 1.0
const scoreExact = scoreTimeMatch(2023, 6, "summer", filter2023);
assert("Soft matching exact year (1.0x)", scoreExact.scoreMultiplier === 1.0 && scoreExact.isMatch === true, `multiplier=${scoreExact.scoreMultiplier}`);

// Photo in 2024 (+1 year) -> 0.5
const scoreSoftPlus = scoreTimeMatch(2024, 6, "summer", filter2023);
assert("Soft matching +1 year (0.5x)", scoreSoftPlus.scoreMultiplier === 0.5 && scoreSoftPlus.isMatch === true, `multiplier=${scoreSoftPlus.scoreMultiplier}`);

// Photo in 2022 (-1 year) -> 0.5
const scoreSoftMinus = scoreTimeMatch(2022, 6, "summer", filter2023);
assert("Soft matching -1 year (0.5x)", scoreSoftMinus.scoreMultiplier === 0.5 && scoreSoftMinus.isMatch === true, `multiplier=${scoreSoftMinus.scoreMultiplier}`);

// Photo in 2020 (+3 years away) -> 0.0
const scoreFar = scoreTimeMatch(2020, 6, "summer", filter2023);
assert("Soft matching far year (0.0x)", scoreFar.scoreMultiplier === 0.0 && scoreFar.isMatch === false, `multiplier=${scoreFar.scoreMultiplier}`);

console.log("\n=============================================");
console.log("All time parser tests executed successfully.");
