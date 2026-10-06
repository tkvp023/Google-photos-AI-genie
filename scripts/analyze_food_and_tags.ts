import fs from "fs";

const tags = JSON.parse(fs.readFileSync("data/tags.json", "utf8"));

// Check food photos using word boundary matching across all tag values
const foodWords = [
  "food", "meal", "pasta", "dinner", "cake", "cupcake", "dining", "eating",
  "wine", "pastries", "bread", "pizza", "salad", "breakfast", "lunch", "beer", "steak", "fondue"
];

const actualFood: { file: string; one_line: string; matchedWord: string }[] = [];

for (const [k, v] of Object.entries<any>(tags)) {
  const fullText = JSON.stringify(v).toLowerCase();
  for (const w of foodWords) {
    const regex = new RegExp(`\\b${w}\\b`, "i");
    if (regex.test(fullText)) {
      actualFood.push({ file: k, one_line: v.one_line, matchedWord: w });
      break;
    }
  }
}

console.log(`Food photos found (${actualFood.length}):`);
actualFood.forEach((p) => {
  console.log(`- ${p.file} (matched: "${p.matchedWord}"): "${p.one_line}"`);
});

// Top 40 most common tags
const counts: Record<string, number> = {};
function addVal(val: any) {
  if (!val) return;
  if (Array.isArray(val)) {
    val.forEach((item) => {
      if (typeof item === "string") addVal(item);
      else if (typeof item === "object") {
        if (item.colour) addVal(item.colour);
        if (item.item) addVal(item.item);
      }
    });
    return;
  }
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    if (s && s !== "none" && s !== "unknown") {
      counts[s] = (counts[s] || 0) + 1;
    }
  }
}

for (const v of Object.values<any>(tags)) {
  for (const [field, val] of Object.entries(v)) {
    if (field === "one_line" || field === "model_version") continue;
    addVal(val);
  }
}

const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
console.log("\nTop 40 most common tags:");
sorted.slice(0, 40).forEach(([t, c], i) => {
  console.log(`${i + 1}. ${t} (${c})`);
});
