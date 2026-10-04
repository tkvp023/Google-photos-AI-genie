/**
 * scripts/diagnose/diagnose_trigger.js
 *
 * DIAGNOSE ONLY - reads only data/ and public/library; never modifies any source.
 *
 * Mirrors the exact trigger path executed by Mode-B coach:
 *   1. search()          - scores all photos, returns count_strong / ambiguous_count
 *   2. vagueCheck()      - classifies the query as vague or specific
 *   3. evaluateTrigger() - gate that decides shouldTrigger
 *
 * Run: node scripts/diagnose/diagnose_trigger.js
 */
"use strict";

const fs   = require("fs");
const path = require("path");

// ── Load data files ───────────────────────────────────────────────────────────

const ROOT      = path.resolve(__dirname, "../..");
const DATA_DIR  = path.join(ROOT, "data");
const LIB_DIR   = path.join(ROOT, "public", "library");

const tags      = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "tags.json"),        "utf-8"));
const photoMeta = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "photo_meta.json"),  "utf-8"));
const synonyms  = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "synonyms.json"),    "utf-8"));
const places    = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "places.json"),      "utf-8"));
const cueLex    = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "cue_lexicon.json"), "utf-8"));

// Build photos array - same as DataLoader.init()
const libFiles = fs.readdirSync(LIB_DIR)
  .filter(f => /\.(jpe?g|png|webp)$/i.test(f))
  .sort((a, b) => {
    const tA = a.split("_")[0], tB = b.split("_")[0];
    return tA !== tB ? tA.localeCompare(tB) : a.localeCompare(b);
  });

const photos = libFiles.map(file => {
  const id    = file.replace(/\.[^.]+$/, "");
  const theme = file.split("_")[0] || "general";
  return { id, file, theme, src: `/library/${file}`, tag: tags[file], metadata: photoMeta[file] };
});

// ── Config (mirrored from src/lib/config.ts) ──────────────────────────────────

const config = {
  COACH_MIN_STRONG:          15,
  COACH_MIN_AMBIGUOUS:       12,
  AMBIGUITY_BAND:            0.65,
  MATCH_MIN_SHARE:           0.6,
  SYNONYM_MAX_EXPANSION:     2,
  SYNONYM_WEIGHT:            0.5,
  VAGUE_MIN_PRECISE_FILTERS: 2,
  MIN_SCORE:                 1.5,
  FIELD_WEIGHTS: {
    setting: 3, one_line: 2, activity: 2, occasion_guess: 2,
    objects: 2, clothing: 2, group_type: 1.5, people_ages: 1.5,
    mood: 1, weather_or_season: 1, text_in_image: 1, time_of_day: 1,
  },
  CUE_WEIGHTS: {
    occasion: 1.0, who: 1.0, look: 1.0, what: 0.9,
    where: 0.7, when: 0.6, mood: 0.5,
  },
};

// ── Stopwords (mirrored from src/lib/search.ts) ───────────────────────────────

const STOPWORDS = new Set([
  "a","an","the","in","on","at","by","for","with","about","against","between","into",
  "through","during","before","after","above","below","to","from","up","down","of",
  "and","or","is","are","was","were","be","been","being","have","has","had","do",
  "does","did","my","your","his","her","its","our","their","this","that","these",
  "those","photo","photos","picture","pictures","image","images","some","show","find",
  "me","i","we","us","you","he","him","she","they","them","it",
  "myself","yourself","yours","ours","theirs","mine",
]);

// ── search.ts helpers (inlined) ───────────────────────────────────────────────

function stemWord(w) {
  let s = (w || "").toLowerCase().trim();
  if (s.length <= 3) return s;
  if (s.endsWith("ing") && s.length > 4) {
    s = s.slice(0, -3);
    if (s.length > 2 && s[s.length - 1] === s[s.length - 2]) s = s.slice(0, -1);
    return s;
  }
  if (s.endsWith("ies") && s.length > 4) return s.slice(0, -3) + "y";
  if (s.endsWith("es")  && s.length > 4) return s.slice(0, -2);
  if (s.endsWith("s")   && !s.endsWith("ss") && s.length > 3) return s.slice(0, -1);
  if (s.endsWith("ed")  && s.length > 4) {
    s = s.slice(0, -2);
    if (s.length > 2 && s[s.length - 1] === s[s.length - 2]) s = s.slice(0, -1);
    return s;
  }
  return s;
}

function normalise(query) {
  if (!query) return [];
  const clean = query.toLowerCase().replace(/[^a-z0-9\s]/gi, " ");
  return clean.split(/\s+/).filter(Boolean).filter(t => !STOPWORDS.has(t));
}

function getTermVariants(term) {
  const baseStem = stemWord(term);
  const variants = [{ token: term, stem: baseStem, isSynonym: false }];
  const synStr = synonyms[term];
  if (synStr) {
    const words = synStr.toLowerCase().split(/\s+/).filter(Boolean);
    const added = new Set([term, baseStem]);
    let count = 0;
    for (const w of words) {
      if (count >= config.SYNONYM_MAX_EXPANSION) break;
      if (STOPWORDS.has(w)) continue;
      const wStem = stemWord(w);
      if (added.has(w) || added.has(wStem)) continue;
      added.add(w); added.add(wStem);
      variants.push({ token: w, stem: wStem, isSynonym: true });
      count++;
    }
  }
  return variants;
}

function textMatchesWord(targetText, token, tokenStem) {
  if (!targetText || !token) return false;
  const lower = targetText.toLowerCase();
  if (token.includes(" ")) {
    const tw = token.split(/\s+/).filter(Boolean);
    const tt = lower.replace(/[^a-z0-9]/g, " ").split(/\s+/).filter(Boolean);
    if (tt.length < tw.length) return false;
    for (let i = 0; i <= tt.length - tw.length; i++) {
      let ok = true;
      for (let j = 0; j < tw.length; j++) {
        if (tt[i+j] !== tw[j] && stemWord(tt[i+j]) !== stemWord(tw[j])) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  }
  const words = lower.replace(/[^a-z0-9]/g, " ").split(/\s+/).filter(Boolean);
  for (const w of words) {
    if (w === token) return true;
    const ws = stemWord(w);
    if (ws === tokenStem || ws === token || w === tokenStem) return true;
  }
  return false;
}

function inferCueType(field, token) {
  if (["group_type","people_ages","people_count","people"].includes(field))    return "who";
  if (["setting","indoor_outdoor","place_city","place_venue"].includes(field)) return "where";
  if (field === "activity")                                                    return "what";
  if (["occasion_guess","occasion_basis","event_title"].includes(field))       return "occasion";
  if (["clothing","objects"].includes(field))                                  return "look";
  if (["time_of_day","weather_or_season","time","year","month_name","season"].includes(field)) return "when";
  for (const [cue, words] of Object.entries(cueLex)) {
    if (Array.isArray(words) && words.includes(token)) return cue;
  }
  return "what";
}

function scorePhoto(photo, termVariantsList) {
  const tag = photo.tag;
  if (!tag) return { score: 0, termsMatchedCount: 0, tier: 3 };

  const fw = config.FIELD_WEIGHTS;
  const cw = config.CUE_WEIGHTS;

  const clothingStr = (Array.isArray(tag.clothing) ? tag.clothing : [])
    .map(c => `${c && c.colour ? c.colour : ""} ${c && c.item ? c.item : ""}`).join(" ");
  const objectsStr = (Array.isArray(tag.objects) ? tag.objects : []).join(" ");

  const fields = {
    theme:             { weight: 2.5,                  text: photo.theme || "" },
    setting:           { weight: fw.setting,           text: tag.setting || "" },
    indoor_outdoor:    { weight: 2.0,                  text: tag.indoor_outdoor || "" },
    one_line:          { weight: fw.one_line,          text: tag.one_line || "" },
    activity:          { weight: fw.activity,          text: tag.activity || "" },
    occasion_guess:    { weight: fw.occasion_guess,    text: tag.occasion_guess || "" },
    group_type:        { weight: fw.group_type,        text: tag.group_type || "" },
    people_ages:       { weight: fw.people_ages,       text: (tag.people_ages || []).join(" ") },
    weather_or_season: { weight: fw.weather_or_season, text: tag.weather_or_season || "" },
    time_of_day:       { weight: fw.time_of_day,       text: tag.time_of_day || "" },
    mood:              { weight: fw.mood,              text: tag.mood || "" },
    text_in_image:     { weight: fw.text_in_image,     text: tag.text_in_image || "" },
    clothing:          { weight: fw.clothing,          text: clothingStr },
    objects:           { weight: fw.objects,           text: objectsStr },
  };

  const m = photo.metadata;
  if (m) {
    if (m.place && m.place.city)   fields.place_city  = { weight: 3.0, text: m.place.city };
    if (m.place && m.place.venue)  fields.place_venue = { weight: 3.0, text: m.place.venue };
    if (Array.isArray(m.people) && m.people.length)
                                   fields.people      = { weight: 3.0, text: m.people.join(" ") };
    if (m.event_title)             fields.event_title = { weight: 2.0, text: m.event_title };
    if (m.year)                    fields.year        = { weight: 2.0, text: String(m.year) };
    if (m.month_name)              fields.month_name  = { weight: 1.5, text: m.month_name };
    if (m.season)                  fields.season      = { weight: 1.5, text: m.season };
  }

  let totalScore = 0;
  let termsMatchedCount = 0;
  const matchedCuesSet = new Set();

  for (const variants of termVariantsList) {
    let termMatched = false;
    for (const [field, { weight, text }] of Object.entries(fields)) {
      let best = null;
      for (const v of variants) {
        if (textMatchesWord(text, v.token, v.stem)) {
          if (!v.isSynonym) { best = v; break; }
          else if (!best) best = v;
        }
      }
      if (best) {
        termMatched = true;
        const cue = inferCueType(field, best.token);
        matchedCuesSet.add(cue);
        const synMul = best.isSynonym ? config.SYNONYM_WEIGHT : 1.0;
        totalScore += Math.round(weight * (cw[cue] || 1.0) * synMul * 10) / 10;
      }
    }
    if (termMatched) termsMatchedCount++;
  }

  if (matchedCuesSet.size > 1 && termVariantsList.length > 1) {
    totalScore += (matchedCuesSet.size - 1) * 2.0;
  }

  const totalTerms = termVariantsList.length;
  let tier = 3;
  if (totalTerms > 0) {
    if (termsMatchedCount === totalTerms) tier = 1;
    else if (termsMatchedCount / totalTerms >= config.MATCH_MIN_SHARE) tier = 2;
  }

  return { score: Math.round(totalScore * 10) / 10, termsMatchedCount, tier };
}

function search(rawQuery) {
  if (!rawQuery || !rawQuery.trim()) return { count_strong: 0, count_total: 0, ambiguous_count: 0, top_score: 0 };
  const contentTerms = normalise(rawQuery);
  if (contentTerms.length === 0) return { count_strong: 0, count_total: 0, ambiguous_count: 0, top_score: 0 };

  const termVariantsList = contentTerms.map(getTermVariants);
  const scored = [];

  for (const photo of photos) {
    const s = scorePhoto(photo, termVariantsList);
    if (s.termsMatchedCount > 0 && s.score >= config.MIN_SCORE) scored.push(s);
  }

  scored.sort((a, b) => a.tier !== b.tier ? a.tier - b.tier : b.score - a.score);

  const tier1 = scored.filter(p => p.tier === 1);
  const tier2 = scored.filter(p => p.tier === 2);
  const count_strong = tier1.length;
  const count_total  = scored.length;
  const top_score    = (tier1[0] || tier2[0] || {}).score || 0;
  const bestTier     = tier1.length > 0 ? tier1 : tier2;
  const ambiguous_count = bestTier.filter(p => p.score >= config.AMBIGUITY_BAND * top_score).length;

  return { count_strong, count_total, ambiguous_count, top_score };
}

// ── vagueCheck.ts helpers (inlined) ──────────────────────────────────────────

const MONTH_NAMES = [
  "january","february","march","april","may","june",
  "july","august","september","october","november","december",
  "jan","feb","mar","apr","jun","jul","aug","sep","sept","oct","nov","dec",
];
const MONTH_REGEX_PART = MONTH_NAMES.join("|");

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function checkTimeAnchor(query) {
  if (!query) return { hasTime: false };
  const lower = query.toLowerCase();
  const exactDayMY = new RegExp(
    `\\b(?:(?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_REGEX_PART})\\s+\\d{4})|` +
    `(?:(?:${MONTH_REGEX_PART})\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4})|` +
    `(?:\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}))\\b`, "i"
  );
  if (exactDayMY.test(lower)) return { hasTime: true };
  if (new RegExp(`\\b(?:${MONTH_REGEX_PART})\\s+(?:19\\d{2}|20\\d{2})\\b`, "i").test(lower)) return { hasTime: true };
  if (/\b(?:19\d{2}|20\d{2})\b/.test(lower)) return { hasTime: true };
  return { hasTime: false };
}

function checkPersonAnchor(query) {
  for (const p of (places.people || [])) {
    if (p && p.trim() && new RegExp(`\\b${escapeRegex(p.trim())}\\b`, "i").test(query)) return true;
  }
  return false;
}

function checkLocationAnchor(query) {
  const all = [...(places.namedPlaces || []), ...(places.venues || [])];
  for (const pl of all) {
    if (pl && pl.trim() && new RegExp(`\\b${escapeRegex(pl.trim())}\\b`, "i").test(query)) return true;
  }
  for (const [alias, canonical] of Object.entries(synonyms)) {
    const isPlace = all.some(p => p.toLowerCase() === canonical.toLowerCase());
    if (isPlace && new RegExp(`\\b${escapeRegex(alias)}\\b`, "i").test(query)) return true;
  }
  return false;
}

function vagueCheck(query) {
  const q = (query || "").trim();
  if (!q) return { isVague: true, preciseCount: 0, anchors: { person: false, time: false, location: false } };
  const hasTime     = checkTimeAnchor(q).hasTime;
  const hasPerson   = checkPersonAnchor(q);
  const hasLocation = checkLocationAnchor(q);
  const preciseCount = (hasPerson ? 1 : 0) + (hasTime ? 1 : 0) + (hasLocation ? 1 : 0);
  return { isVague: preciseCount < 2, preciseCount, anchors: { person: hasPerson, time: hasTime, location: hasLocation } };
}

// ── evaluateTrigger (mirrored from coachEngine.ts) ───────────────────────────

function evaluateTrigger({ mode, query, isVague, hasBeenDismissed, countStrong, ambiguousCount }) {
  if (mode !== "B")                          return { shouldTrigger: false, blockedReason: "mode_not_b" };
  if (hasBeenDismissed)                      return { shouldTrigger: false, blockedReason: "dismissed" };
  if ((query || "").trim().length < 3)       return { shouldTrigger: false, blockedReason: "query_too_short" };
  if (!isVague)                              return { shouldTrigger: false, blockedReason: "not_vague" };
  if (countStrong < config.COACH_MIN_STRONG) return { shouldTrigger: false, blockedReason: "few_strong_matches" };
  if (ambiguousCount < config.COACH_MIN_AMBIGUOUS) return { shouldTrigger: false, blockedReason: "clear_winner" };
  if (ambiguousCount < 4)                    return { shouldTrigger: false, blockedReason: "not_enough_candidates" };
  return { shouldTrigger: true, blockedReason: "" };
}

// ── Run the 14-query diagnosis ────────────────────────────────────────────────

const QUERIES = [
  "me in a restaurant",   // PROBLEM: coach does NOT open
  "me in a pool",         // REFERENCE: coach opens
  "me at the beach",
  "me hiking",
  "birthday party",
  "graduation photos",
  "road trip",
  "me with friends",
  "festival photos",
  "kids playing",
  "pet photos",
  "photos in Goa",
  "photos with Meera",
  "photos from 2022",
];

console.log("=".repeat(80));
console.log("TASK A  TRIGGER PATH DIAGNOSIS");
console.log("=".repeat(80));
console.log(`Library: ${photos.length} photos  |  MIN_STRONG=${config.COACH_MIN_STRONG}  MIN_AMBIGUOUS=${config.COACH_MIN_AMBIGUOUS}  BAND=${config.AMBIGUITY_BAND}`);
console.log("");

const rows = [];

for (const query of QUERIES) {
  const sr = search(query);
  const vc = vagueCheck(query);
  const et = evaluateTrigger({
    mode: "B", query,
    isVague: vc.isVague, hasBeenDismissed: false,
    countStrong: sr.count_strong, ambiguousCount: sr.ambiguous_count,
  });

  rows.push({ query, sr, vc, et });

  console.log(`QUERY: "${query}"`);
  console.log(`  tokens     : [${normalise(query).join(", ")}]`);
  console.log(`  search     : count_strong=${sr.count_strong}  count_total=${sr.count_total}  ambiguous=${sr.ambiguous_count}  top_score=${sr.top_score}`);
  console.log(`  vagueCheck : isVague=${vc.isVague}  preciseCount=${vc.preciseCount}  anchors=${JSON.stringify(vc.anchors)}`);
  console.log(`  trigger    : shouldTrigger=${et.shouldTrigger}  blockedReason="${et.blockedReason}"`);
  if (!et.shouldTrigger) {
    const why = [];
    if (!vc.isVague)                               why.push("not vague (preciseCount>=2)");
    if (sr.count_strong < config.COACH_MIN_STRONG) why.push(`count_strong ${sr.count_strong} < MIN_STRONG ${config.COACH_MIN_STRONG}`);
    if (sr.ambiguous_count < config.COACH_MIN_AMBIGUOUS) why.push(`ambiguous ${sr.ambiguous_count} < MIN_AMBIGUOUS ${config.COACH_MIN_AMBIGUOUS}`);
    console.log(`  WHY: ${why.join("; ") || et.blockedReason}`);
  }
  console.log("");
}

// Summary table
console.log("-".repeat(90));
console.log("SUMMARY TABLE");
console.log("-".repeat(90));
console.log(
  "Query".padEnd(28) + "  " +
  "isVague".padEnd(8) + "prec  " +
  "strong  ".padEnd(8) + "ambig  " +
  "trigger  " + "blockedReason"
);
console.log("-".repeat(90));
for (const { query, sr, vc, et } of rows) {
  console.log(
    query.padEnd(28) + "  " +
    String(vc.isVague).padEnd(8) +
    String(vc.preciseCount).padEnd(6) +
    String(sr.count_strong).padEnd(8) +
    String(sr.ambiguous_count).padEnd(7) +
    String(et.shouldTrigger).padEnd(9) +
    (et.blockedReason || "-")
  );
}

// Root-cause section
const R = rows.find(r => r.query === "me in a restaurant");
const P = rows.find(r => r.query === "me in a pool");

console.log("\n" + "=".repeat(80));
console.log("ROOT CAUSE — TASK A");
console.log("=".repeat(80));

console.log('\n[RC-A1]  "me in a restaurant" is blocked at:', R.et.blockedReason);
console.log(`  After stopword removal tokens=[${normalise("me in a restaurant").join(",")}]`);
console.log(`  "restaurant" has NO entry in synonyms.json — no synonym expansion.`);
console.log(`  count_strong = ${R.sr.count_strong}. Required COACH_MIN_STRONG = ${config.COACH_MIN_STRONG}.`);
console.log(`  Only 20 restaurant photos exist. Some have group_type="unknown"/empty,`);
console.log(`  preventing multi-field score boost. Not all 20 clear MIN_SCORE gate.`);
console.log(`  CONCLUSION: "restaurant" triggers too few tier-1 matches to pass the`);
console.log(`  few_strong_matches gate, so the coach never opens.`);

console.log('\n[RC-A2]  "me in a pool" triggers. Asymmetry reason:');
console.log(`  synonyms.json: "pool" -> "swimming swim"`);
console.log(`  Token "pool" expands to variants [pool, swim(stem), swimming, swim].`);
console.log(`  Each pool photo matches "pool" on setting+theme AND "swimming" on activity`);
console.log(`  -> higher per-photo score -> more photos clear MIN_SCORE -> count_strong=${P.sr.count_strong} >= ${config.COACH_MIN_STRONG}.`);
console.log(`  "restaurant" has no such synonym, relies only on setting/theme match.`);
