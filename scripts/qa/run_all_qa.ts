// scripts/qa/run_all_qa.ts — Master QA Runner
import { execSync } from "child_process";

console.log("=================================================");
console.log("    FULL QA SWEEP — GOOGLE PHOTOS AI GENIE       ");
console.log("=================================================\n");

const qaSuites = [
  { name: "Stage 1: Secrets & Security Scan", script: "scripts/qa/qa_secrets_scan.ts" },
  { name: "Stage 2: Data Integrity Audit", script: "scripts/qa/qa_data.ts" },
  { name: "Stage 3: Search & Vague Check Audit", script: "scripts/qa/qa_search.ts" },
  { name: "Stage 4: Trigger & Questions Matrix Audit", script: "scripts/qa/qa_genie.ts" },
  { name: "Stage 4: Chip Interactions & Re-ranking", script: "scripts/qa/qa_chips_interaction.ts" },
  { name: "Stage 7: Resilience & Security Audit", script: "scripts/qa/qa_resilience_security.ts" },
  { name: "Stage 8: Performance & Deployment Audit", script: "scripts/qa/qa_perf_deployment.ts" },
];

let totalPassed = 0;
let totalFailed = 0;

for (const suite of qaSuites) {
  console.log(`\n>>> Running: ${suite.name} (${suite.script})`);
  try {
    execSync(`npx tsx "${suite.script}"`, { stdio: "inherit", encoding: "utf-8" });
    console.log(`[COMPLETED] ${suite.name}`);
    totalPassed++;
  } catch (err: any) {
    console.error(`[FAILED/DEVIATION] ${suite.name}`);
    totalFailed++;
  }
}

console.log("\n=================================================");
console.log(`QA Sweep Summary: ${totalPassed} suites succeeded, ${totalFailed} suites reported failures/deviations.`);
console.log("=================================================");
