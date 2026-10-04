import { search } from "../src/lib/search";

const r1 = search("beach sunset");
console.log("beach sunset count_strong:", r1.count_strong, "results:", r1.results.map((p) => `${p.file} (T${p.tier})`));

const r2 = search("family beach sunset");
console.log("family beach sunset count_strong:", r2.count_strong, "results:", r2.results.map((p) => `${p.file} (T${p.tier})`));
