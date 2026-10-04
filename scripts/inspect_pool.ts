import { search } from "../src/lib/search";

const r = search("pool");
const p8 = r.results.find((p) => p.file === "pool_08.jpg");
console.log("pool_08 matches:", JSON.stringify(p8?.matches, null, 2));

const p1 = r.results.find((p) => p.file === "pool_01.jpg");
console.log("pool_01 matches:", JSON.stringify(p1?.matches, null, 2));

const p10 = r.results.find((p) => p.file === "pool_10.jpg");
console.log("pool_10 matches:", JSON.stringify(p10?.matches, null, 2));
