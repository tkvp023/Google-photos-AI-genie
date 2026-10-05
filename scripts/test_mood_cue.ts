// scripts/test_mood_cue.ts — Unit tests for mood cue in Coach and Classifier
import { selectQuestions, filterCandidates } from "../src/lib/coachEngine";
import { search } from "../src/lib/search";
import { classifyCues } from "../src/lib/cueClassifier";
import { getChipPhrase } from "../src/lib/phraseTemplates";

console.log("=== Running Unit Tests for Mood Cue ===");

// Test 1: classifyCues identifies mood
const ccRes1 = classifyCues("cheerful gathering");
if (!ccRes1.cueTypes.includes("mood")) {
  console.error("FAIL: classifyCues('cheerful gathering') did not include 'mood'");
  process.exit(1);
}
console.log("PASS [OK] classifyCues recognizes mood keywords.");

// Test 2: getChipPhrase for mood returns the mood word
const phrase = getChipPhrase("mood", "cheerful");
if (phrase !== "cheerful") {
  console.error(`FAIL: getChipPhrase('mood', 'cheerful') returned '${phrase}', expected 'cheerful'`);
  process.exit(1);
}
console.log("PASS [OK] getChipPhrase('mood', 'cheerful') -> 'cheerful'");

// Test 3: selectQuestions offers mood question when appropriate
const res = search("birthday");
const questions = selectQuestions(res.results, "birthday", [], 1.0, true);
const moodQ = questions.find((q) => q.cueType === "mood");
if (!moodQ) {
  console.error("FAIL: selectQuestions for 'birthday' did not offer a mood question");
  process.exit(1);
}
if (!moodQ.text.includes("What was the vibe")) {
  console.error(`FAIL: Expected question text to contain 'What was the vibe', got '${moodQ.text}'`);
  process.exit(1);
}
if (moodQ.options.length === 0 || moodQ.options.length > 4) {
  console.error(`FAIL: Expected 1-4 options, got ${moodQ.options.length}`);
  process.exit(1);
}
console.log(`PASS [OK] Mood question found: "${moodQ.text}" with options: ${moodQ.options.map((o) => o.label).join(", ")}`);

// Test 4: filterCandidates filters by mood
const filtered = filterCandidates(res.results, [
  { questionId: moodQ.id, cueType: "mood", value: moodQ.options[0].value, source: "chip" },
]);
if (filtered.length === 0 || filtered.length > res.results.length) {
  console.error(`FAIL: filterCandidates returned ${filtered.length} items`);
  process.exit(1);
}
console.log(`PASS [OK] filterCandidates narrowed candidate count from ${res.results.length} to ${filtered.length}.`);

console.log("\nALL MOOD CUE TESTS PASSED! [EXCELLENT]");
