import { dataStore } from "../src/lib/dataLoader";
import { search } from "../src/lib/search";

dataStore.init();

const vocab = [
  "pool", "beach", "restaurant", "birthday", "festival", "hiking", "kids",
  "graduation", "dog", "road trip", "friends", "family", "red", "blue",
  "swimsuit", "party", "cake", "sunset", "mountain", "outdoor", "indoor",
  "summer", "winter", "goa", "chennai", "meera", "rohan", "backpack",
  "water", "dancing", "eating", "picnic", "table", "trees", "yellow"
];

let violations = 0;
for (let i = 0; i < 1000; i++) {
  const len = Math.floor(Math.random() * 3) + 1;
  const words: string[] = [];
  for (let j = 0; j < len; j++) {
    words.push(vocab[Math.floor(Math.random() * vocab.length)]);
  }
  const q1 = words.join(" ");
  const extraWord = vocab[Math.floor(Math.random() * vocab.length)];
  const q2 = `${q1} ${extraWord}`;
  const s1 = search(q1).count_strong ?? 0;
  const s2 = search(q2).count_strong ?? 0;
  if (s2 > s1) {
    violations++;
    console.log(`Monotonicity Violation: "${q1}" (${s1}) -> "${q2}" (${s2})`);
  }
}

console.log(`1,000-query test finished. Total violations: ${violations} / 1000`);
