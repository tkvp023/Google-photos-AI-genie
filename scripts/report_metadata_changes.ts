import { search } from "../src/lib/search";
import { selectQuestions } from "../src/lib/coachEngine";
import { getChipPhrase } from "../src/lib/phraseTemplates";

const queries = [
  "pool",
  "pool goa",
  "pool 2023",
  "pool two summers ago",
  "birthday"
];

console.log("=== MATCH COUNTS (STRONG / TOTAL) ===");
for (const q of queries) {
  const res = search(q);
  console.log(`Query: "${q}" -> count_strong: ${res.count_strong}, total_matches: ${res.count}`);
}

console.log("\n=== COACH QUESTIONS ===");
for (const q of ["pool", "birthday"]) {
  const res = search(q);
  const candidates = res.results;
  const questions = selectQuestions(candidates, q, [], 1.0, true);
  console.log(`\nCoach Questions for "${q}":`);
  for (const qItem of questions) {
    const opts = qItem.options.map(o => `${o.label} (phrase: "${getChipPhrase(qItem.cueType, o.value)}")`).join(", ");
    console.log(`  - [${qItem.cueType}] ${qItem.text}`);
    console.log(`    Options: ${opts}`);
  }
}
