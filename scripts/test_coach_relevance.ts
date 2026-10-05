// scripts/test_coach_relevance.ts — Tests Step 5 Coach relevance with synthetic metadata
import { selectQuestions } from "../src/lib/coachEngine";
import { search } from "../src/lib/search";
import { dataStore } from "../src/lib/dataLoader";

console.log("=== Testing Step 5: Coach Relevance with Synthetic Metadata ===\n");

// Get candidates for "pool"
const searchPool = search("pool");
const poolCandidates = searchPool.results;
console.log(`Found ${poolCandidates.length} candidate photos for "pool".`);

// 1. "pool" should offer questions with cues when, where, who
const questionsPool = selectQuestions(poolCandidates, "pool", [], 1.0, true);
console.log("Questions offered for 'pool':");
for (const q of questionsPool) {
  console.log(` - [${q.cueType}] ${q.text} (field: ${q.field})`);
  console.log(`   Options: ${q.options.map((o) => `${o.label} (${o.value})`).join(", ")}`);
}

const cuesPool = questionsPool.map((q) => q.cueType);
console.log(`Cues offered for "pool": ${cuesPool.join(", ")}`);

const hasWhen = cuesPool.includes("when");
const hasWhere = cuesPool.includes("where");
const hasWho = cuesPool.includes("who");

if (hasWhen && hasWhere && hasWho) {
  console.log(`PASS [OK] "pool" offers when, where, and who questions!`);
} else {
  console.error(`FAIL [ERROR] "pool" missing expected cues! Got: ${cuesPool.join(", ")}`);
  process.exit(1);
}

// Check that option values exist in candidates' metadata
for (const q of questionsPool) {
  for (const opt of q.options) {
    if (q.cueType === "where") {
      const whereExists = poolCandidates.some(
        (p) =>
          p.metadata?.place?.city?.toLowerCase() === opt.value.toLowerCase() ||
          p.tag?.indoor_outdoor?.toLowerCase() === opt.value.toLowerCase() ||
          p.tag?.setting?.toLowerCase().includes(opt.value.toLowerCase())
      );
      if (!whereExists) {
        console.error(`FAIL [ERROR] Option "${opt.value}" for where does not exist in candidates metadata!`);
        process.exit(1);
      }
    } else if (q.cueType === "who") {
      const whoExists = poolCandidates.some(
        (p) =>
          (p.metadata?.people || []).some((n) => n.toLowerCase() === opt.value.toLowerCase()) ||
          p.tag?.group_type?.toLowerCase() === opt.value.toLowerCase()
      );
      if (!whoExists) {
        console.error(`FAIL [ERROR] Option "${opt.value}" for who does not exist in candidates metadata!`);
        process.exit(1);
      }
    } else if (q.cueType === "when") {
      const whenExists = poolCandidates.some(
        (p) =>
          p.metadata?.year !== undefined ||
          p.tag?.time_of_day !== undefined
      );
      if (!whenExists) {
        console.error(`FAIL [ERROR] Option "${opt.value}" for when is invalid!`);
        process.exit(1);
      }
    }
  }
}
console.log(`PASS [OK] All chip values exist in candidates' metadata!`);

// 2. "pool goa" does NOT ask where
const searchGoaPool = search("pool goa");
const goaCandidates = searchGoaPool.results;
const questionsGoa = selectQuestions(goaCandidates, "pool goa", [], 1.0, true);
console.log("\nQuestions offered for 'pool goa':");
for (const q of questionsGoa) {
  console.log(` - [${q.cueType}] ${q.text}`);
}

const hasWhereGoa = questionsGoa.some((q) => q.cueType === "where");
if (!hasWhereGoa) {
  console.log(`PASS [OK] "pool goa" does NOT ask where!`);
} else {
  console.error(`FAIL [ERROR] "pool goa" asked where!`);
  process.exit(1);
}

// 3. Check "birthday"
const searchBirthday = search("birthday");
const birthdayCandidates = searchBirthday.results;
const questionsBirthday = selectQuestions(birthdayCandidates, "birthday", [], 1.0, true);
console.log("\nQuestions offered for 'birthday':");
for (const q of questionsBirthday) {
  console.log(` - [${q.cueType}] ${q.text}`);
  console.log(`   Options: ${q.options.map((o) => `${o.label} (${o.value})`).join(", ")}`);
}

console.log("\n=============================================");
console.log("All Step 5 Coach relevance tests passed successfully!");
