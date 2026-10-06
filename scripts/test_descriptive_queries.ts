import { search } from "../src/lib/search";

const testQueries = [
  "kid playing in sand",
  "kids at a pool",
  "black and white dog sitting happily inside car",
  "kids park"
];

for (const q of testQueries) {
  const res = search(q);
  const tier1 = res.results.filter(p => p.tier === 1);
  const tier2 = res.results.filter(p => p.tier === 2);
  console.log(`\nQuery: "${q}"`);
  console.log(`  Tier 1 count: ${tier1.length}, Tier 2 count: ${tier2.length}`);
  console.log(`  Top 3 results:`);
  res.results.slice(0, 3).forEach((p, i) => {
    console.log(`    ${i+1}. [${p.id}] (tier ${p.tier}, score ${p.score}) ${p.tag?.one_line}`);
  });
}
