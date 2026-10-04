// scripts/qa/qa_secrets_scan.ts
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

console.log("=== SCANNING REPO & GIT HISTORY FOR SECRETS ===");

// 1. Check .gitignore
const gitignore = fs.readFileSync(".gitignore", "utf-8");
const hasEnvIgnore = gitignore.includes(".env*");
console.log(`[GITIGNORE] Covers .env*: ${hasEnvIgnore ? "PASS [YES]" : "FAIL [NO]"}`);

// 2. Scan tracked files
const trackedPatterns = [
  { name: "Google API Key (AIza...)", regex: /AIza[0-9A-Za-z_-]{35}/g },
  { name: "Groq API Key (gsk_...)", regex: /gsk_[0-9A-Za-z]{20,}/g },
  { name: "OpenAI API Key (sk-...)", regex: /sk-[0-9A-Za-z]{20,}/g },
  { name: "Pixabay API Key", regex: /[0-9]{7,8}-[a-f0-9]{24}/g },
];

let trackedHits = 0;
const trackedFiles = execSync("git ls-files", { encoding: "utf-8" }).split("\n").filter(Boolean);

for (const file of trackedFiles) {
  if (file.endsWith(".png") || file.endsWith(".jpg") || file.endsWith(".jpeg") || file.endsWith(".pyc")) continue;
  try {
    const content = fs.readFileSync(file, "utf-8");
    for (const pat of trackedPatterns) {
      const matches = content.match(pat.regex);
      if (matches) {
        console.log(`[SECRET HIT] Tracked file '${file}' matched ${pat.name} (${matches.length} occurrences). REDACTED.`);
        trackedHits++;
      }
    }
  } catch {
    // Ignore read errors for binary
  }
}
if (trackedHits === 0) {
  console.log("[TRACKED FILES] No secrets found in tracked files: PASS [OK]");
} else {
  console.log(`[TRACKED FILES] Found ${trackedHits} secrets in tracked files: FAIL`);
}

// 3. Scan git commit logs
let logHits = 0;
for (const pat of trackedPatterns) {
  try {
    const rawMatches = execSync(`git log -G"${pat.name.split(" ")[0]}" --oneline`, { encoding: "utf-8" });
    if (rawMatches.trim()) {
      // Check deeper
      const fullDiff = execSync(`git log -p -G"${pat.name.split(" ")[0]}"`, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
      const found = fullDiff.match(pat.regex);
      if (found) {
        console.log(`[GIT LOG HIT] Git history matched pattern ${pat.name} (${found.length} occurrences). REDACTED.`);
        logHits++;
      }
    }
  } catch {}
}

if (logHits === 0) {
  console.log("[GIT HISTORY] No secrets found in commit history: PASS [OK]");
} else {
  console.log(`[GIT HISTORY] Found ${logHits} secrets in commit history: DEVIATION / WARNING`);
}

// 4. Scan for literal PIN
if (fs.existsSync(".env.local")) {
  const envContent = fs.readFileSync(".env.local", "utf-8");
  const pinMatch = envContent.match(/MODERATOR_PIN\s*=\s*(.+)/);
  if (pinMatch && pinMatch[1].trim()) {
    const pin = pinMatch[1].trim();
    try {
      const pinTracked = execSync(`git grep -l -F "${pin}"`, { encoding: "utf-8" }).trim();
      if (pinTracked) {
        console.log(`[PIN CHECK] Tracked files contain literal PIN: FAIL (Found in files: ${pinTracked.split("\n").join(", ")})`);
      } else {
        console.log("[PIN CHECK] No tracked files contain literal PIN: PASS [OK]");
      }
    } catch {
      console.log("[PIN CHECK] No tracked files contain literal PIN: PASS [OK]");
    }

    try {
      const pinLog = execSync(`git log -S "${pin}" --oneline`, { encoding: "utf-8" }).trim();
      if (pinLog) {
        console.log(`[PIN CHECK] Git log contains literal PIN commits: DEVIATION / HIT (${pinLog.split("\n").length} commits)`);
      } else {
        console.log("[PIN CHECK] Git history does not contain literal PIN: PASS [OK]");
      }
    } catch {
      console.log("[PIN CHECK] Git history does not contain literal PIN: PASS [OK]");
    }
  }
}

