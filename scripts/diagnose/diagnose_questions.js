/**
 * scripts/diagnose/diagnose_questions.js
 *
 * DIAGNOSE ONLY - reads only data/ and public/library; never modifies any source.
 *
 * Task C: Trace the full selectQuestions() path for "me in a pool".
 * Shows every candidate field's computeBalanceScore result, why fields are
 * skipped or promoted, and what the final 3 questions look like.
 *
 * Run: node scripts/diagnose/diagnose_questions.js
 */
"use strict";

const fs   = require("fs");
const path = require("path");

const ROOT     = path.resolve(__dirname, "../..");
const DATA_DIR = path.join(ROOT, "data");
const LIB_DIR  = path.join(ROOT, "public", "library");

const tags      = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "tags.json"),       "utf-8"));
const photoMeta = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "photo_meta.json"), "utf-8"));
const places    = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "places.json"),     "utf-8"));
const synonyms  = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "synonyms.json"),   "utf-8"));

const libFiles = fs.readdirSync(LIB_DIR)
  .filter(f => /\.(jpe?g|png|webp)$/i.test(f))
  .sort((a, b) => a.localeCompare(b));

const photos = libFiles.map(file => ({
  id: file.replace(/\.[^.]+$/, ""),
  file, theme: file.split("_")[0] || "general",
  tag: tags[file], metadata: photoMeta[file],
}));

// ── Config (mirrored from config.ts) ─────────────────────────────────────────

const config = {
  MIN_FIELD_COVERAGE: 0.6,
  MAX_OPTIONS:        4,
  MAX_QUESTIONS:      3,
  COACH_STOP_AT:      8,
  MIN_TAG_COVERAGE:   0.9,
  AMBIGUITY_BAND:     0.65,
  MATCH_MIN_SHARE:    0.6,
  MIN_SCORE:          1.5,
  SYNONYM_MAX_EXPANSION: 2,
  SYNONYM_WEIGHT:     0.5,
  VAGUE_MIN_PRECISE_FILTERS: 2,
  COACH_MIN_STRONG:   15,
  COACH_MIN_AMBIGUOUS:12,
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

// ── computeFieldDistribution (mirrored from coachEngine.ts) ──────────────────

function computeFieldDistribution(candidates, field) {
  const counts = {};
  let totalValid = 0;

  for (const photo of candidates) {
    const tag  = photo.tag  || {};
    const meta = photo.metadata || {};
    let values = [];

    if (field === "group_type") {
      if (tag.group_type && tag.group_type !== "unknown") values = [tag.group_type];
    } else if (field === "cast_people" || field === "people") {
      if (Array.isArray(meta.people) && meta.people.length > 0) {
        values = [...meta.people];
      } else if (tag.group_type && tag.group_type !== "unknown") {
        values = [tag.group_type];
      }
    } else if (field === "place_city" || field === "city") {
      if (meta.place && meta.place.city) {
        values = [meta.place.city];
      } else if (tag.setting && tag.setting !== "unknown") {
        values = [tag.setting];
      }
    } else if (field === "time_period") {
      if (meta.year) {
        const diff = 2026 - meta.year;
        if (diff === 0)      values = ["this year"];
        else if (diff === 1) values = ["last year"];
        else if (diff === 2) values = ["two years ago"];
        else if (diff === 3) values = ["3 years ago"];
        else                 values = ["earlier"];
      } else if (tag.time_of_day && tag.time_of_day !== "unknown") {
        values = [tag.time_of_day];
      }
    } else if (field === "season_year") {
      if (meta.season && meta.year) values = [`${meta.season} ${meta.year}`];
    } else if (field === "indoor_outdoor") {
      if (tag.indoor_outdoor && tag.indoor_outdoor !== "unknown") values = [tag.indoor_outdoor];
    } else if (field === "setting") {
      if (tag.setting && tag.setting !== "unknown") values = [tag.setting];
    } else if (field === "activity") {
      if (tag.activity && tag.activity !== "unknown" && tag.activity !== "none") {
        values = tag.activity.split(/,\s*/);
      }
    } else if (field === "occasion_guess") {
      if (tag.occasion_guess && tag.occasion_guess !== "none" && tag.occasion_guess !== "unknown") {
        values = [tag.occasion_guess];
      }
    } else if (field === "clothing_color") {
      values = Array.isArray(tag.clothing)
        ? tag.clothing.map(c => c && c.colour).filter(c => c && c !== "unknown")
        : [];
    } else if (field === "time_of_day") {
      if (tag.time_of_day && tag.time_of_day !== "unknown") values = [tag.time_of_day];
    } else if (field === "mood") {
      if (tag.mood && tag.mood !== "unknown" && tag.mood !== "none" && tag.mood !== "neutral") {
        values = [tag.mood];
      }
    }

    if (values.length > 0) {
      totalValid++;
      for (const v of values) {
        const k = v.toLowerCase().trim();
        counts[k] = (counts[k] || 0) + 1;
      }
    }
  }

  const coverage = candidates.length > 0 ? totalValid / candidates.length : 0;
  return { counts, totalValid, coverage };
}

// ── computeBalanceScore (mirrored from coachEngine.ts) ───────────────────────

function computeBalanceScore(dist, cueWeight) {
  if (dist.coverage < config.MIN_FIELD_COVERAGE) return 0;
  const entries = Object.entries(dist.counts);
  const k = entries.length;
  if (k < 2) return 0;

  const total = entries.reduce((acc, [, c]) => acc + c, 0);
  if (total === 0) return 0;

  let entropy = 0;
  for (const [, c] of entries) {
    const p = c / total;
    if (p > 0) entropy -= p * Math.log(p);
  }

  const maxEntropy = Math.log(k);
  const normalised = maxEntropy > 0 ? entropy / maxEntropy : 0;
  return dist.coverage * normalised * cueWeight;
}

// ── Simple search to get pool candidates (mirrored logic) ─────────────────────

const STOPWORDS = new Set([
  "a","an","the","in","on","at","by","for","with","about","against","between","into",
  "through","during","before","after","above","below","to","from","up","down","of",
  "and","or","is","are","was","were","be","been","being","have","has","had","do",
  "does","did","my","your","his","her","its","our","their","this","that","these",
  "those","photo","photos","picture","pictures","image","images","some","show","find",
  "me","i","we","us","you","he","him","she","they","them","it",
  "myself","yourself","yours","ours","theirs","mine",
]);

function stemWord(w) {
  let s = (w || "").toLowerCase().trim();
  if (s.length <= 3) return s;
  if (s.endsWith("ing") && s.length > 4) {
    s = s.slice(0, -3);
    if (s.length > 2 && s[s.length-1] === s[s.length-2]) s = s.slice(0,-1);
    return s;
  }
  if (s.endsWith("ies") && s.length > 4) return s.slice(0,-3)+"y";
  if (s.endsWith("es")  && s.length > 4) return s.slice(0,-2);
  if (s.endsWith("s")   && !s.endsWith("ss") && s.length > 3) return s.slice(0,-1);
  if (s.endsWith("ed")  && s.length > 4) {
    s = s.slice(0,-2);
    if (s.length > 2 && s[s.length-1] === s[s.length-2]) s = s.slice(0,-1);
    return s;
  }
  return s;
}

function normalise(query) {
  const clean = (query || "").toLowerCase().replace(/[^a-z0-9\s]/gi, " ");
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
    const tt = lower.replace(/[^a-z0-9]/g," ").split(/\s+/).filter(Boolean);
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
  const words = lower.replace(/[^a-z0-9]/g," ").split(/\s+/).filter(Boolean);
  for (const w of words) {
    if (w === token) return true;
    const ws = stemWord(w);
    if (ws === tokenStem || ws === token || w === tokenStem) return true;
  }
  return false;
}

function inferCueType(field) {
  if (["group_type","people_ages","people_count","people"].includes(field)) return "who";
  if (["setting","indoor_outdoor","place_city","place_venue"].includes(field)) return "where";
  if (field === "activity") return "what";
  if (["occasion_guess","occasion_basis","event_title"].includes(field)) return "occasion";
  if (["clothing","objects"].includes(field)) return "look";
  if (["time_of_day","weather_or_season","time","year","month_name","season"].includes(field)) return "when";
  return "what";
}

function scorePhoto(photo, termVariantsList) {
  const tag = photo.tag || {};
  const fw = config.FIELD_WEIGHTS;
  const cw = config.CUE_WEIGHTS;

  const clothingStr = (Array.isArray(tag.clothing) ? tag.clothing : [])
    .map(c => `${c && c.colour ? c.colour : ""} ${c && c.item ? c.item : ""}`).join(" ");
  const objectsStr  = (Array.isArray(tag.objects) ? tag.objects : []).join(" ");

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
        const cue = inferCueType(field);
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

function getCandidates(query) {
  const terms = normalise(query);
  const tvl   = terms.map(getTermVariants);
  const scored = [];
  for (const photo of photos) {
    const s = scorePhoto(photo, tvl);
    if (s.termsMatchedCount > 0 && s.score >= config.MIN_SCORE) scored.push({ ...s, photo });
  }
  scored.sort((a, b) => a.tier !== b.tier ? a.tier - b.tier : b.score - a.score);

  const tier1 = scored.filter(p => p.tier === 1);
  const tier2 = scored.filter(p => p.tier === 2);
  const top_score = (tier1[0] || tier2[0] || {}).score || 0;
  const bestTier  = tier1.length > 0 ? tier1 : tier2;
  const ambiguous = bestTier.filter(p => p.score >= config.AMBIGUITY_BAND * top_score);

  return {
    all: scored.map(s => s.photo),
    tier1: tier1.map(s => s.photo),
    tier2: tier2.map(s => s.photo),
    ambiguous: ambiguous.map(s => s.photo),
    count_strong: tier1.length,
    ambiguous_count: ambiguous.length,
    top_score,
  };
}

// ── Run selectQuestions trace for "me in a pool" ──────────────────────────────

const QUERY = "me in a pool";

console.log("=".repeat(80));
console.log(`TASK C  QUESTION SELECTION TRACE  ("${QUERY}")`);
console.log("=".repeat(80));
console.log("");

const { all: allCandidates, tier1, ambiguous, count_strong, ambiguous_count } = getCandidates(QUERY);

console.log(`Candidates: total=${allCandidates.length}  tier1=${tier1.length}  ambiguous=${ambiguous_count}`);
console.log(`Using tier1 photos as coach candidates (${tier1.length} photos)\n`);

// Use tier1 as coach candidates (matches what the live coach does)
const candidates = tier1.length > 0 ? tier1 : allCandidates;

// Fields config from coachEngine.ts selectQuestions()
const FIELDS_CONFIG = [
  { field: "place_city",     cueType: "where",   text: "Where was this taken?",     queryKeywords: [...places.namedPlaces.map(p => p.toLowerCase())] },
  { field: "cast_people",    cueType: "who",     text: "Who was with you?",          queryKeywords: ["friends","family","couple","solo","kids","alone",...places.people.map(p => p.toLowerCase())] },
  { field: "time_period",    cueType: "when",    text: "When was this taken?",       queryKeywords: ["morning","afternoon","evening","night","summer","monsoon","winter","year","ago"] },
  { field: "season_year",    cueType: "when",    text: "When was this taken?",       queryKeywords: ["morning","afternoon","evening","night","summer","monsoon","winter","year","ago"] },
  { field: "activity",       cueType: "what",    text: "What was everyone doing?",   queryKeywords: ["swimming","eating","dancing","hiking","playing"] },
  { field: "occasion_guess", cueType: "occasion",text: "What was the occasion?",     queryKeywords: ["birthday","party","festival","graduation","reunion"] },
  { field: "clothing_color", cueType: "look",    text: "What color was worn?",       queryKeywords: ["red","blue","yellow","black","white","orange","swimsuit"] },
  { field: "time_of_day",    cueType: "when",    text: "What time of day was it?",   queryKeywords: ["morning","afternoon","evening","night"] },
  { field: "mood",           cueType: "mood",    text: "What was the vibe?",         queryKeywords: ["happy","cheerful","playful","calm","energetic","lively","relaxed","vibe","mood"] },
];

const qLower = QUERY.toLowerCase();
const priorAnswers = [];

console.log("FIELD-BY-FIELD SCORING (selectQuestions candidate loop):\n");
console.log(
  "field".padEnd(18) + "  " +
  "cueType".padEnd(10) + "  " +
  "coverage".padEnd(10) + "  " +
  "distinct".padEnd(10) + "  " +
  "score".padEnd(8) + "  " +
  "skipped?  top values"
);
console.log("-".repeat(110));

const candidateQuestions = [];

for (const item of FIELDS_CONFIG) {
  // Check queryHasAnchor
  const queryHasAnchor = item.queryKeywords.some(kw => qLower.includes(kw));

  const dist      = computeFieldDistribution(candidates, item.field);
  const cueWeight = config.CUE_WEIGHTS[item.cueType] || 1.0;
  const score     = queryHasAnchor ? 0 : computeBalanceScore(dist, cueWeight);

  const entries   = Object.entries(dist.counts).sort((a, b) => b[1] - a[1]);
  const topVals   = entries.slice(0, 4).map(([v, c]) => `${v}(${c})`).join(", ");

  let skipReason = "";
  if (queryHasAnchor)              skipReason = "SKIP:query_anchor";
  else if (score <= 0) {
    if (dist.coverage < config.MIN_FIELD_COVERAGE) skipReason = `SKIP:low_coverage(${(dist.coverage*100).toFixed(0)}%)`;
    else if (Object.keys(dist.counts).length < 2)  skipReason = "SKIP:distinct<2";
    else                                            skipReason = "SKIP:score=0";
  }

  console.log(
    item.field.padEnd(18) + "  " +
    item.cueType.padEnd(10) + "  " +
    `${(dist.coverage*100).toFixed(0)}%`.padEnd(10) + "  " +
    String(Object.keys(dist.counts).length).padEnd(10) + "  " +
    String(score.toFixed(3)).padEnd(8) + "  " +
    (skipReason || "  KEPT  ").padEnd(10) + "  " +
    topVals
  );

  if (!skipReason && score > 0 && Object.keys(dist.counts).length >= 2) {
    candidateQuestions.push({ field: item.field, cueType: item.cueType, text: item.text, score, dist });
  }
}

// Sort by score descending, pick distinct cueTypes
candidateQuestions.sort((a, b) => b.score - a.score);

const selected = [];
const selectedCues = new Set();
for (const cq of candidateQuestions) {
  if (!selectedCues.has(cq.cueType)) {
    selected.push(cq);
    selectedCues.add(cq.cueType);
    if (selected.length >= config.MAX_QUESTIONS) break;
  }
}

console.log("\n" + "=".repeat(80));
console.log("SELECTED QUESTIONS (sorted by balanceScore, distinct cueType):");
console.log("=".repeat(80));
for (let i = 0; i < selected.length; i++) {
  const q = selected[i];
  const topOpts = Object.entries(q.dist.counts).sort((a, b) => b[1] - a[1])
    .slice(0, config.MAX_OPTIONS).map(([v]) => `"${v}"`).join(", ");
  console.log(`  Q${i+1}: [${q.cueType}] "${q.text}" (score=${q.score.toFixed(3)}, field=${q.field})`);
  console.log(`       Options shown: ${topOpts}`);

  if (q.field === "cast_people") {
    console.log(`       *** PROBLEM: options are raw personal names from metadata.people.`);
    console.log(`           Expected memory cue type: WHO (group type / relationship).`);
    console.log(`           Actual options: individual cast names (Meera, Rohan, Aarav...).`);
  }
  if (q.field === "place_city") {
    console.log(`       *** PROBLEM: options are city names (Goa, Bengaluru...).`);
    console.log(`           For a pool query, venue type or resort vs. home is more useful.`);
  }
  if (q.field === "time_period") {
    console.log(`       *** NOTE: options are relative years (2 years ago, Earlier...).`);
    console.log(`           Marginally useful but generic and not memory-cue rich.`);
  }
}

console.log("\n" + "=".repeat(80));
console.log("ALL SCORED CANDIDATES (before cue dedup):");
console.log("=".repeat(80));
for (const cq of candidateQuestions) {
  console.log(`  score=${cq.score.toFixed(3)}  cueType=${cq.cueType.padEnd(8)}  field=${cq.field}`);
}

console.log("\n" + "=".repeat(80));
console.log("ROOT CAUSE FINDINGS — TASK C");
console.log("=".repeat(80));
console.log(`
RC-C1: cast_people (WHO) wins the who-cue slot with the highest balance score.
       This is because metadata.people lists individual cast names (Meera, Rohan,
       Aarav...) which are highly distributed (each photo has 1-3 different names).
       The entropy is high → balance score is high → it ranks #1 for WHO.
       But these are cast labels, not user-facing memory cues.
       group_type (friends/family/solo) is the proper WHO cue but scores lower
       because it has fewer distinct values (less entropy).

RC-C2: place_city (WHERE) wins the where-cue slot because cities (Goa, Bengaluru)
       are distributed across pool events. But a user who typed "pool" does not
       remember the city — they remember the TYPE of pool (resort, home, club).
       setting is "pool" for ALL candidates (distinct=1) → score=0 → skipped.
       indoor_outdoor is "outdoor" for ~all pool photos (distinct=1) → score=0.
       So the WHERE question has no good options and falls back to city names.

RC-C3: time_period (WHEN) uses metadata.year to generate relative labels
       (2 years ago, Earlier, this year). These are genuine temporal cues but are
       generic across all query types. A pool-specific temporal cue (season, occasion)
       would be richer but occasion_guess is "none" for every pool photo → score=0.

RC-C4: activity (WHAT) is correctly selected (swimming, jumping) and is the most
       useful cue, but for "me in a pool" it is often SKIPPED because the query
       keyword list for WHAT includes "swimming" and "me in a pool" triggers the
       queryHasAnchor check via the synonym expansion ("pool" → "swimming").
       Specifically: item.queryKeywords for activity = ["swimming","eating",...].
       qLower.includes("swimming") = false, but "pool" synonym expands to "swimming",
       so if the synonym check were applied here it would skip it.
       ACTUAL state: queryKeywords check is on the RAW query text, not tokens.
       So "swimming" is NOT in "me in a pool" -> activity is NOT skipped by keyword.
       Verify the actual score from the table above.
`);
