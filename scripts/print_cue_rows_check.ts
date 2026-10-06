import { search } from "../src/lib/search";
import { selectQuestions } from "../src/lib/coachEngine";

const queries = [
  "pool",
  "beach",
  "dog",
  "a couple of summers ago, with friends"
];

for (const q of queries) {
  const s = search(q);
  const tier1 = s.results.filter(p => p.tier === 1);
  const qs = selectQuestions(tier1, q, []);
  console.log(`\n==================================================`);
  console.log(`QUERY: "${q}" (${tier1.length} Tier 1 candidates)`);
  console.log(`Generated ${qs.length} question rows:`);
  qs.forEach((row, i) => {
    console.log(`  Row ${i + 1}: "${row.text}" [Field: ${row.field}, Cue: ${row.cueType}]`);
    row.options.forEach(opt => {
      console.log(`    - ${opt.label}: ${opt.count} photos`);
    });
  });
}
