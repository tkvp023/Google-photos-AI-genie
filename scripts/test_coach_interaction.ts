// scripts/test_coach_interaction.ts — Unit & Behavior tests for redesigned coach interaction
import {
  getChipPhrase,
  isPhraseSelected,
  cleanSeparators,
  appendChipPhrase,
  removeChipPhrase,
  replaceOrAppendChipPhrase,
} from "../src/lib/phraseTemplates";
import { shouldTrigger } from "../src/lib/coachEngine";
import { config } from "../src/lib/config";

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(id: string, name: string, condition: boolean, details: string) {
  results.push({ id, name, passed: condition, details });
  const icon = condition ? "PASS [OK]" : "FAIL [X]";
  console.log(`${icon} ${id}: ${name} — ${details}`);
}

console.log("=== Running Coach Interaction Redesign Tests ===\n");

// 1. Template Phrase Generation
const who1 = getChipPhrase("who", "friends");
const who2 = getChipPhrase("who", "family");
const who3 = getChipPhrase("who", "solo");
const who4 = getChipPhrase("who", "just me");
assert("TMP-01", "who phrases map correctly", who1 === "with friends" && who2 === "with family" && who3 === "alone" && who4 === "alone", `who1=${who1}, who2=${who2}, who3=${who3}`);

const occ1 = getChipPhrase("occasion", "birthday?");
const occ2 = getChipPhrase("occasion", "Vacation?");
assert("TMP-02", "occasion strips question marks", occ1 === "birthday" && occ2 === "vacation", `occ1=${occ1}, occ2=${occ2}`);

const look1 = getChipPhrase("look", "red swimsuit");
const look2 = getChipPhrase("look", "outdoor");
assert("TMP-03", "look formats correctly", look1 === "red swimsuit" && look2 === "outdoors", `look1=${look1}, look2=${look2}`);

const where1 = getChipPhrase("where", "pool");
const where2 = getChipPhrase("where", "outdoor");
const where3 = getChipPhrase("where", "indoor");
assert("TMP-04", "where formats correctly", where1 === "pool" && where2 === "outdoors" && where3 === "indoors", `where1=${where1}, where2=${where2}, where3=${where3}`);

// 2. Whole-Phrase Selection Detection
const sampleText = "pool, with friends, red swimsuit, outdoors";
assert("SEL-01", "exact phrase match detected", isPhraseSelected(sampleText, "with friends"), "with friends found");
assert("SEL-02", "case-insensitive phrase match detected", isPhraseSelected(sampleText, "Red Swimsuit"), "Red Swimsuit found");
assert("SEL-03", "boundary check avoids substring false-positive", !isPhraseSelected("pooling with friends", "pool"), "pool not detected in pooling");
assert("SEL-04", "unselected chip phrase returns false", !isPhraseSelected(sampleText, "with family"), "with family not in text");

// 3. Tapping unselected chip appends to end
let current = "pool";
current = appendChipPhrase(current, "with friends");
assert("APP-01", "append chip phrase separated by comma", current === "pool, with friends", `current=${current}`);

current = appendChipPhrase(current, "red swimsuit");
assert("APP-02", "append second chip phrase", current === "pool, with friends, red swimsuit", `current=${current}`);

current = appendChipPhrase(current, "outdoors");
assert("APP-03", "append third chip phrase matches spec example", current === "pool, with friends, red swimsuit, outdoors", `current=${current}`);

// Appending already present chip does not duplicate
const beforeDup = current;
current = appendChipPhrase(current, "with friends");
assert("APP-04", "no duplicate phrases appended", current === beforeDup, `current=${current}`);

// 4. Tapping selected chip removes exactly that phrase and cleans separators
let removed = removeChipPhrase(current, "with friends");
assert("REM-01", "remove middle chip cleans commas", removed === "pool, red swimsuit, outdoors", `removed=${removed}`);

removed = removeChipPhrase(removed, "outdoors");
assert("REM-02", "remove end chip cleans trailing comma", removed === "pool, red swimsuit", `removed=${removed}`);

removed = removeChipPhrase(removed, "pool");
assert("REM-03", "remove first chip cleans leading comma", removed === "red swimsuit", `removed=${removed}`);

removed = removeChipPhrase(removed, "red swimsuit");
assert("REM-04", "remove last remaining phrase yields empty", removed === "", `removed='${removed}'`);

// 5. Replacing a chip within the same question
const textWithFriends = "pool, with friends, red swimsuit, outdoors";
const whoPhrases = ["with friends", "with family", "alone", "with couple"];
const replacedWithFamily = replaceOrAppendChipPhrase(textWithFriends, "with family", whoPhrases);
assert("REP-01", "replacing chip in same question replaces previous phrase", replacedWithFamily === "pool, with family, red swimsuit, outdoors", `replaced=${replacedWithFamily}`);

const replacedWithAlone = replaceOrAppendChipPhrase(replacedWithFamily, "alone", whoPhrases);
assert("REP-02", "replacing with alone preserves other chips", replacedWithAlone === "pool, alone, red swimsuit, outdoors", `replaced=${replacedWithAlone}`);

// 6. Manual edit re-syncs chip state
const manuallyEdited = "pool, alone, red swimsuit";
assert("RESYNC-01", "outdoors no longer selected after manual backspace", !isPhraseSelected(manuallyEdited, "outdoors"), "outdoors unselected");
assert("RESYNC-02", "alone still selected", isPhraseSelected(manuallyEdited, "alone"), "alone selected");
assert("RESYNC-03", "red swimsuit still selected", isPhraseSelected(manuallyEdited, "red swimsuit"), "red swimsuit selected");

// 7. Cleaning separators
assert("CLN-01", "clean multiple commas", cleanSeparators("pool, , red swimsuit, , ") === "pool, red swimsuit", "multiple commas handled");
assert("CLN-02", "clean leading and trailing commas", cleanSeparators(", pool, red swimsuit, ") === "pool, red swimsuit", "leading/trailing commas handled");

// 8. Coach Never mounts in Mode A
const triggerModeA = shouldTrigger("A", "pool", 15, true, false);
assert("BEH-01", "coach never triggers in Mode A", triggerModeA === false, `triggerModeA=${triggerModeA}`);

// 9. Trigger conditions unchanged (9 rules, Mode B only)
const triggerModeBValid = shouldTrigger("B", "pool", 15, true, false);
assert("BEH-02", "coach triggers in Mode B with vague query and >= 10 candidates", triggerModeBValid === true, `triggerModeBValid=${triggerModeBValid}`);

const triggerModeBShort = shouldTrigger("B", "po", 15, true, false);
assert("BEH-03", "coach does not trigger if query < 3 chars", triggerModeBShort === false, `triggerModeBShort=${triggerModeBShort}`);

const triggerModeBDismissed = shouldTrigger("B", "pool", 15, true, true);
assert("BEH-04", "coach does not trigger if dismissed", triggerModeBDismissed === false, `triggerModeBDismissed=${triggerModeBDismissed}`);

console.log("\n=============================================");
const total = results.length;
const passed = results.filter((r) => r.passed).length;
console.log(`Summary: ${passed}/${total} Tests Passed.`);

if (passed === total) {
  console.log("ALL TESTS PASSED! [EXCELLENT]");
} else {
  console.error("SOME TESTS FAILED!");
  process.exit(1);
}
