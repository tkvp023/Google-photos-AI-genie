// scripts/print_sample_practice_row.ts — Prints sample practice row from library
import fs from "fs";
import path from "path";

console.log("=== Sample Practice Row Printer ===");
const tagsPath = path.resolve(process.cwd(), "data/tags.json");
const metaPath = path.resolve(process.cwd(), "data/photo_meta.json");

if (fs.existsSync(tagsPath) && fs.existsSync(metaPath)) {
  const tags = JSON.parse(fs.readFileSync(tagsPath, "utf-8"));
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));

  const sampleId = Object.keys(tags)[0];
  console.log(`Sample Photo: ${sampleId}`);
  console.log("Tags:", JSON.stringify(tags[sampleId], null, 2));
  console.log("Metadata:", JSON.stringify(meta[sampleId], null, 2));
  console.log("PASS [OK] Sample practice row loaded and printed successfully.");
} else {
  console.error("FAIL: Missing data files");
  process.exit(1);
}
