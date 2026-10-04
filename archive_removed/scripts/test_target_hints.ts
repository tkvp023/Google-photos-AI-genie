// scripts/test_target_hints.ts — Automated Unit Tests for Target Hints
import fs from "fs";
import path from "path";

console.log("=== Running Unit Tests for Target Hints ===");

const targetsPath = path.resolve(__dirname, "../data/targets.json");
const castPath = path.resolve(__dirname, "../data/cast.json");
const placesPath = path.resolve(__dirname, "../data/places.json");

const targets = JSON.parse(fs.readFileSync(targetsPath, "utf-8"));
const cast = JSON.parse(fs.readFileSync(castPath, "utf-8"));
const places = JSON.parse(fs.readFileSync(placesPath, "utf-8"));

const castNames: string[] = cast.map((c: { name: string }) => c.name.toLowerCase());
const cities: string[] = places.namedPlaces.map((city: string) => city.toLowerCase());
const yearRegex = /\b\d{4}\b/;

if (!Array.isArray(targets) || targets.length !== 10) {
  console.error(`FAIL: Expected 10 targets, found ${targets.length}`);
  process.exit(1);
}

let passed = 0;
for (const target of targets) {
  const hint = target.hint;
  if (!hint || typeof hint !== "string" || hint.trim().length === 0) {
    console.error(`FAIL [X] Target ${target.id}: missing or empty hint`);
    continue;
  }

  const hintLower = hint.toLowerCase();

  // Check 1: No cast names
  const matchedCast = castNames.filter((name) => {
    const rx = new RegExp(`\\b${name}\\b`, "i");
    return rx.test(hintLower);
  });
  if (matchedCast.length > 0) {
    console.error(`FAIL [X] Target ${target.id}: hint contains cast name(s): ${matchedCast.join(", ")}`);
    continue;
  }

  // Check 2: No cities
  const matchedCity = cities.filter((city) => {
    const rx = new RegExp(`\\b${city}\\b`, "i");
    return rx.test(hintLower);
  });
  if (matchedCity.length > 0) {
    console.error(`FAIL [X] Target ${target.id}: hint contains city name(s): ${matchedCity.join(", ")}`);
    continue;
  }

  // Check 3: No 4-digit year
  if (yearRegex.test(hint)) {
    console.error(`FAIL [X] Target ${target.id}: hint contains 4-digit year: "${hint}"`);
    continue;
  }

  passed++;
  console.log(`PASS [OK] Target ${target.id} hint: "${hint}"`);
}

console.log(`\nSummary: ${passed}/10 Target Hints Validated.`);
if (passed === 10) {
  console.log("ALL TARGET HINT TESTS PASSED! [EXCELLENT]");
} else {
  console.error("SOME TARGET HINT TESTS FAILED!");
  process.exit(1);
}
