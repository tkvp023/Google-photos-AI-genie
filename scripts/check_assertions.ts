import fs from "fs";

const scripts = [
  "scripts/test_search_metadata.ts",
  "scripts/test_vague_evals.ts",
  "scripts/test_coach_evals.ts",
  "scripts/test_coach_relevance.ts",
  "scripts/test_cue_classifier.ts",
  "scripts/test_time_parser.ts",
  "scripts/test_trigger.ts",
  "scripts/test_prompt_composer_evals.ts",
  "scripts/test_coach_interaction.ts",
  "scripts/test_search_evals.ts",
  "scripts/test_composer_evals.ts",
  "scripts/compare_beach.ts",
  "scripts/inspect_pool.ts",
  "scripts/print_sample_practice_row.ts",
  "scripts/report_metadata_changes.ts",
  "scripts/diagnose_matches.ts",
  "scripts/generate_final_report.ts",
  "scripts/test_mode_parity.ts",
  "scripts/test_target_hints.ts",
  "scripts/test_mood_cue.ts",
];

for (const s of scripts) {
  if (!fs.existsSync(s)) {
    console.log(`${s}: MISSING`);
    continue;
  }
  const code = fs.readFileSync(s, "utf8");
  const hasAssert =
    code.includes("assert(") ||
    code.includes("assert.") ||
    code.includes("process.exit(1)") ||
    code.includes("throw new Error") ||
    code.includes("throw new");
  
  // count number of assertions or exit conditions
  const exitCount = (code.match(/process\.exit\(1\)/g) || []).length;
  const throwCount = (code.match(/throw new/g) || []).length;
  const assertCount = (code.match(/assert\(/g) || []).length + (code.match(/assert\./g) || []).length;

  console.log(`${s} -> ${hasAssert ? "REAL ASSERTIONS" : "REPORT ONLY"} (asserts: ${assertCount}, exits: ${exitCount}, throws: ${throwCount})`);
}
