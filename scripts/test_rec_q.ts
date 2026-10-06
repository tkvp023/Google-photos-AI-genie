import { search } from "../src/lib/search";
import { categorizeTokens } from "../src/lib/unmatchedTerms";

const q = "a couple of summers ago, with friends";
console.log("search(q) tier 1:", search(q).results.filter(p => p.tier === 1).length);

const cat = categorizeTokens(q);
console.log("cat:", cat);
const recQ = cat.recognisedTokens.length > 0 ? cat.recognisedTokens.join(" ") : q;
console.log("recQ:", recQ);
console.log("search(recQ) tier 1:", search(recQ).results.filter(p => p.tier === 1).length);
