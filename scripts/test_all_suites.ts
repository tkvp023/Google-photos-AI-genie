// scripts/test_all_suites.ts
import { execSync } from "child_process";

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

console.log("=== RUNNING ALL TS TEST SUITES ===\n");
let passed = 0;
let failed = 0;

import fs from "fs";

for (const s of scripts) {
  if (!fs.existsSync(s)) {
    console.log(`Running ${s}... FAIL [X] (File missing)`);
    failed++;
    continue;
  }
  try {
    process.stdout.write(`Running ${s}... `);
    execSync(`npx tsx "${s}"`, { stdio: "pipe", encoding: "utf-8", shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh" });
    console.log("PASS [OK]");
    passed++;
  } catch (err: any) {
    console.log("FAIL [X]");
    console.error(err.stdout || err.stderr || err.message);
    failed++;
  }
}

console.log(`\n=============================================`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${scripts.length}`);
if (failed > 0) process.exit(1);
