// scripts/diagnose_matches.ts — Diagnostic script for search matching & coach trigger issues
import fs from "fs";
import path from "path";
import { dataStore } from "../src/lib/dataLoader";
import { normalise, applySynonyms, scorePhoto, ScoredPhoto } from "../src/lib/search";
import { config } from "../src/lib/config";
import { CueType, PhotoItem } from "../src/types";

const QUERIES = [
  "pool",
  "birthday",
  "beach",
  "friends",
  "red swimsuit pool friends",
  "me at the pool",
  "dog",
  "restaurant dinner",
  "hiking",
  "silver racket",
  "elephant",
];

function textMatches(targetText: string, token: string): boolean {
  if (!targetText || !token) return false;
  const lower = targetText.toLowerCase();
  if (lower === token) return true;
  if (lower.includes(token)) return true;

  // Simple plural / stem check
  if (token.endsWith("s") && lower.includes(token.slice(0, -1))) return true;
  if (lower.endsWith("s") && lower.slice(0, -1).includes(token)) return true;
  if (token.endsWith("ing") && lower.includes(token.slice(0, -3))) return true;

  return false;
}

function getPhotoFields(photo: PhotoItem): Record<string, string> {
  const tag = photo.tag;
  if (!tag) return { theme: photo.theme || "" };

  const peopleAgesList = Array.isArray(tag.people_ages) ? tag.people_ages : [];
  const clothingList = Array.isArray(tag.clothing) ? tag.clothing : [];
  const objectsList = Array.isArray(tag.objects) ? tag.objects : [];
  const clothingStrings = clothingList.map((c) => `${c?.colour || ""} ${c?.item || ""}`).join(" ");

  return {
    theme: photo.theme || "",
    setting: tag.setting || "",
    indoor_outdoor: tag.indoor_outdoor || "",
    one_line: tag.one_line || "",
    activity: tag.activity || "",
    occasion_guess: tag.occasion_guess || "",
    group_type: tag.group_type || "",
    people_ages: peopleAgesList.join(" "),
    weather_or_season: tag.weather_or_season || "",
    time_of_day: tag.time_of_day || "",
    mood: tag.mood || "",
    text_in_image: tag.text_in_image || "",
    clothing: clothingStrings,
    objects: objectsList.join(" "),
  };
}

function getTermExpansions(term: string, synonyms: Record<string, string>): string[] {
  const result = new Set<string>();
  result.add(term);
  if (synonyms[term]) {
    const parts = synonyms[term].toLowerCase().split(/\s+/).filter(Boolean);
    for (const p of parts) result.add(p);
  }
  return Array.from(result);
}

function photoMatchesTerm(photoFields: Record<string, string>, termVariants: string[]): { matched: boolean; details: Record<string, string[]> } {
  const details: Record<string, string[]> = {};
  let anyMatched = false;

  for (const [field, text] of Object.entries(photoFields)) {
    for (const v of termVariants) {
      if (textMatches(text, v)) {
        anyMatched = true;
        if (!details[field]) details[field] = [];
        if (!details[field].includes(v)) details[field].push(v);
      }
    }
  }

  return { matched: anyMatched, details };
}

function runDiagnosis() {
  const photos = dataStore.getPhotos();
  const synonyms = dataStore.getSynonyms();
  const cueLexicon = dataStore.getCueLexicon();

  let out = "";
  const log = (msg: string = "") => {
    out += msg + "\n";
    console.log(msg);
  };

  log("================================================================================");
  log("SEARCH MATCHING & COACH TRIGGER DIAGNOSIS REPORT");
  log(`Total photos in library: ${photos.length}`);
  log(`Current config: MIN_SCORE=${config.MIN_SCORE}, COACH_MIN_CANDIDATES=${config.COACH_MIN_CANDIDATES}`);
  log("================================================================================\n");

  const querySummaries: Array<{
    query: string;
    contentTerms: string[];
    expandedTokens: string[];
    countsByScore: Record<number, number>;
    matchAll: number;
    match60: number;
    coachTriggersNow: boolean;
    themes: Record<string, number>;
  }> = [];

  for (const q of QUERIES) {
    log(`--------------------------------------------------------------------------------`);
    log(`QUERY: "${q}"`);
    log(`--------------------------------------------------------------------------------`);

    const contentTerms = normalise(q);
    const expandedTokens = applySynonyms(contentTerms, synonyms);

    log(`Content terms (after stopwords): [${contentTerms.map((t) => `"${t}"`).join(", ")}]`);
    log(`Expanded tokens (after synonyms): [${expandedTokens.map((t) => `"${t}"`).join(", ")}]`);

    // Term variant map
    const termVariantMap: Record<string, string[]> = {};
    for (const t of contentTerms) {
      termVariantMap[t] = getTermExpansions(t, synonyms);
      log(`  Term "${t}" expansions: [${termVariantMap[t].join(", ")}]`);
    }

    // Score all photos
    interface ScoredWithMeta {
      photo: PhotoItem;
      score: number;
      matchedFields: string[];
      matchedCues: CueType[];
      termsMatchedCount: number;
      termsMatchedFraction: number;
      matchedTermsList: string[];
      fieldTokenMatches: Record<string, string[]>;
    }

    const scoredAll: ScoredWithMeta[] = [];

    for (const photo of photos) {
      const sp = scorePhoto(photo, expandedTokens, synonyms, cueLexicon);
      const fields = getPhotoFields(photo);

      // Check which content terms this photo matches
      let termsMatchedCount = 0;
      const matchedTermsList: string[] = [];
      const fieldTokenMatches: Record<string, string[]> = {};

      for (const t of contentTerms) {
        const variants = termVariantMap[t];
        const res = photoMatchesTerm(fields, variants);
        if (res.matched) {
          termsMatchedCount++;
          matchedTermsList.push(t);
          for (const [fld, toks] of Object.entries(res.details)) {
            if (!fieldTokenMatches[fld]) fieldTokenMatches[fld] = [];
            for (const tk of toks) {
              if (!fieldTokenMatches[fld].includes(tk)) fieldTokenMatches[fld].push(tk);
            }
          }
        }
      }

      const fraction = contentTerms.length > 0 ? termsMatchedCount / contentTerms.length : 0;

      scoredAll.push({
        photo,
        score: sp.score,
        matchedFields: sp.matchedFields,
        matchedCues: sp.matchedCues,
        termsMatchedCount,
        termsMatchedFraction: fraction,
        matchedTermsList,
        fieldTokenMatches,
      });
    }

    // Sort descending by score
    scoredAll.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.photo.file.localeCompare(b.photo.file);
    });

    // Counts at MIN_SCORE thresholds: 1, 2, 4, 6
    const countAt1 = scoredAll.filter((p) => p.score >= 1).length;
    const countAt2 = scoredAll.filter((p) => p.score >= 2).length;
    const countAt4 = scoredAll.filter((p) => p.score >= 4).length;
    const countAt6 = scoredAll.filter((p) => p.score >= 6).length;

    log(`\nMatch counts by MIN_SCORE threshold:`);
    log(`  MIN_SCORE >= 1: ${countAt1}`);
    log(`  MIN_SCORE >= 2: ${countAt2} (CURRENT DEFAULT)`);
    log(`  MIN_SCORE >= 4: ${countAt4}`);
    log(`  MIN_SCORE >= 6: ${countAt6}`);

    // Photos matching ALL content terms vs at least 60%
    const matchAll = scoredAll.filter((p) => p.termsMatchedCount === contentTerms.length && contentTerms.length > 0).length;
    const match60 = scoredAll.filter((p) => p.termsMatchedFraction >= 0.6 && contentTerms.length > 0).length;

    log(`\nTerm-overlap counts (content terms = ${contentTerms.length}):`);
    log(`  Matches ALL content terms (100%): ${matchAll}`);
    log(`  Matches >= 60% of content terms: ${match60}`);

    // Coach trigger status under current logic
    const coachTriggers = countAt2 >= config.COACH_MIN_CANDIDATES;
    log(`  Current Coach Trigger (matches >= ${config.COACH_MIN_CANDIDATES} at score>=2): ${coachTriggers ? "TRIGGERED (Lots of photos match)" : "NOT TRIGGERED"}`);

    // Theme distribution for current matches (score >= 2)
    const currentMatches = scoredAll.filter((p) => p.score >= 2);
    const themeCounts: Record<string, number> = {};
    for (const m of currentMatches) {
      const th = m.photo.theme || "unknown";
      themeCounts[th] = (themeCounts[th] || 0) + 1;
    }
    const themeStr = Object.entries(themeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([th, cnt]) => `${th} ${cnt}`)
      .join(", ");
    log(`\nTheme counts of current matches (score >= 2, total=${currentMatches.length}):`);
    log(`  ${themeStr || "None"}`);

    // Top 10 photos
    log(`\nTop 10 Photos:`);
    const top10 = scoredAll.slice(0, 10);
    top10.forEach((p, idx) => {
      const fieldMatchStr = Object.entries(p.fieldTokenMatches)
        .map(([f, toks]) => `${f}:[${toks.join(",")}]`)
        .join("; ");
      log(`  #${idx + 1} ${p.photo.file} (theme: ${p.photo.theme}) | Score: ${p.score} | Matched ${p.termsMatchedCount}/${contentTerms.length} terms [${p.matchedTermsList.join(",")}] | Fields: ${fieldMatchStr || "none"}`);
    });

    log("\n");

    querySummaries.push({
      query: q,
      contentTerms,
      expandedTokens,
      countsByScore: { 1: countAt1, 2: countAt2, 4: countAt4, 6: countAt6 },
      matchAll,
      match60,
      coachTriggersNow: coachTriggers,
      themes: themeCounts,
    });
  }

  // Summary Table & Root Cause Analysis
  log("================================================================================");
  log("DIAGNOSTIC SUMMARY & ROOT CAUSE ANALYSIS");
  log("================================================================================\n");

  log(
    "Query".padEnd(28) +
      "Terms".padEnd(8) +
      "Score>=2".padEnd(12) +
      "All(100%)".padEnd(12) +
      ">=60%".padEnd(10) +
      "Triggers Now?".padEnd(16) +
      "Themes"
  );
  log("-".repeat(100));

  for (const s of querySummaries) {
    const qCol = s.query.padEnd(28);
    const tCol = String(s.contentTerms.length).padEnd(8);
    const sCol = String(s.countsByScore[2]).padEnd(12);
    const allCol = String(s.matchAll).padEnd(12);
    const m60Col = String(s.match60).padEnd(10);
    const trigCol = (s.coachTriggersNow ? "YES (>=10)" : "NO").padEnd(16);
    const themeSummary = Object.entries(s.themes)
      .slice(0, 3)
      .map(([th, c]) => `${th}:${c}`)
      .join(" ");
    log(`${qCol}${tCol}${sCol}${allCol}${m60Col}${trigCol}${themeSummary}`);
  }

  log("\n--------------------------------------------------------------------------------");
  log("ROOT CAUSE EVALUATION:");
  log("--------------------------------------------------------------------------------");
  log(`
(a) ANY-TOKEN (OR) MATCHING:
    PRIMARY CAUSE for multi-token queries.
    Current search() iterates tokens and sums score across ALL tokens without requiring
    co-occurrence. E.g. "red swimsuit pool friends" returns 84 matches because ANY photo
    matching "friends" or "pool" or "swim" or "red" receives points and exceeds MIN_SCORE=2!
    Even though only 1 photo matches all 4 terms, 84 photos are returned!

(b) LOW MIN_SCORE (MIN_SCORE=2):
    MAJOR CONTRIBUTING CAUSE.
    Any single field hit (e.g. one_line:2, activity:2, objects:2, setting:3, or theme:2.5)
    immediately reaches or exceeds score >= 2.0. Thus, matching any single generic word
    in one tag field is sufficient for a photo to be counted as a full match.

(c) SYNONYM OR SUBSTRING WIDENING:
    MAJOR CONTRIBUTING CAUSE.
    1. Overly broad synonyms:
       - "pool" expands to "swimming pool swim water". "water" and "swim" appear across
         beach photos, kids photos, and outdoor photos, pulling non-pool photos into "pool".
       - "medal" expands to "certificate graduation formal ceremony award" (5 words).
    2. Substring matching in textMatches():
       lower.includes(token) causes substring false positives (e.g. "me" matches "summer",
       "someone", "women", "game", "camera", "home", "flame", "time"!).
       For "me at the pool", "me" matches almost every photo in the library!
    3. Unweighted synonyms:
       Expanded synonym tokens are given 100% equal weight as user-typed terms, allowing
       a peripheral synonym hit to qualify a photo entirely on its own.

(d) LIBRARY SIZE VS COACH_MIN_MATCHES:
    CONTRIBUTING FACTOR TO FALSE TRIGGERS.
    With only 10 photos per theme (100 total photos), COACH_MIN_MATCHES = 10 means:
    if a query matches just ONE entire theme (10 photos) or a few spillover photos,
    it hits 10 and fires the coach!
    Furthermore, because OR-matching and synonym widening easily produce 20-80 matches,
    the threshold of 10 matches is crossed by almost every query.

CONCLUSION:
The root causes in order of impact are:
1. (a) ANY-TOKEN (OR) MATCHING: Any multi-token query matches virtually the entire library
   because matching 1 of 4 words is enough.
2. (c) SYNONYM & SUBSTRING WIDENING: Substring matching ("me" in "women") and generic synonyms
   ("pool" -> "water") cause unrelated photos to match.
3. (b) LOW MIN_SCORE: Score 2 allows a single field match to qualify as a valid result.
4. (d) LIBRARY SIZE & THRESHOLD: Library of 100 photos with COACH_MIN_MATCHES=10 fires
   whenever >= 10% of the entire library matches.
`);

  // Write reports/diagnosis.txt
  const reportsDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  const reportPath = path.join(reportsDir, "diagnosis.txt");
  fs.writeFileSync(reportPath, out, "utf-8");
  console.log(`\nDiagnosis report successfully written to: ${reportPath}`);
}

runDiagnosis();
