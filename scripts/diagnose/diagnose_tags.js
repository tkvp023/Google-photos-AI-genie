/**
 * scripts/diagnose/diagnose_tags.js
 *
 * DIAGNOSE ONLY - reads only data/ and public/library; never modifies any source.
 *
 * Task B: Analyse tag-field distribution across themes to identify vocabulary problems.
 * Shows for each theme how many photos have "unknown"/"none" in key fields,
 * what values appear in activity/group_type/indoor_outdoor/occasion_guess,
 * and whether the coach candidate fields have enough diversity to form useful questions.
 *
 * Run: node scripts/diagnose/diagnose_tags.js
 */
"use strict";

const fs   = require("fs");
const path = require("path");

const ROOT     = path.resolve(__dirname, "../..");
const DATA_DIR = path.join(ROOT, "data");
const LIB_DIR  = path.join(ROOT, "public", "library");

const tags      = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "tags.json"),       "utf-8"));
const photoMeta = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "photo_meta.json"), "utf-8"));

const libFiles = fs.readdirSync(LIB_DIR)
  .filter(f => /\.(jpe?g|png|webp)$/i.test(f))
  .sort((a, b) => a.localeCompare(b));

const photos = libFiles.map(file => ({
  file,
  theme: file.split("_")[0] || "general",
  tag:   tags[file],
  meta:  photoMeta[file],
}));

const THEMES = [...new Set(photos.map(p => p.theme))].sort();

// ── Fields to audit ───────────────────────────────────────────────────────────

const TAG_FIELDS = [
  "setting", "indoor_outdoor", "activity", "group_type",
  "occasion_guess", "mood", "time_of_day", "weather_or_season",
];

const NULL_VALUES = new Set(["unknown", "none", "", null, undefined]);

function isNull(v) {
  return NULL_VALUES.has(v) || (typeof v === "string" && v.trim() === "");
}

function fieldValues(photo, field) {
  const tag = photo.tag;
  if (!tag) return [];
  const raw = tag[field];
  if (Array.isArray(raw)) return raw.map(String).filter(v => !isNull(v));
  if (raw === undefined || raw === null || isNull(raw)) return [];
  return [String(raw)];
}

// ── Per-theme distribution ────────────────────────────────────────────────────

console.log("=".repeat(80));
console.log("TASK B  TAG VOCABULARY ANALYSIS");
console.log("=".repeat(80));
console.log(`Total photos: ${photos.length}  |  Themes: ${THEMES.join(", ")}`);
console.log("");

for (const theme of THEMES) {
  const group = photos.filter(p => p.theme === theme);
  console.log(`\nTHEME: ${theme.toUpperCase()}  (${group.length} photos)`);
  console.log("─".repeat(60));

  for (const field of TAG_FIELDS) {
    const counts = {};
    let nullCount = 0;
    for (const photo of group) {
      const vals = fieldValues(photo, field);
      if (vals.length === 0) {
        nullCount++;
      } else {
        for (const v of vals) {
          counts[v] = (counts[v] || 0) + 1;
        }
      }
    }

    const totalNonNull = group.length - nullCount;
    const coverage = (totalNonNull / group.length * 100).toFixed(0);
    const distinctValues = Object.keys(counts).length;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const topList = sorted.slice(0, 5).map(([v, c]) => `${v}(${c})`).join(", ");
    const coachable = distinctValues >= 2 && totalNonNull / group.length >= 0.6;

    console.log(
      `  ${field.padEnd(20)} coverage=${coverage.padStart(3)}%  distinct=${distinctValues}  ` +
      `null/unknown=${nullCount}  coachable=${coachable ? "YES" : " no"}  top: ${topList || "(none)"}`
    );
  }

  // Show metadata field coverage too
  const metaFields = ["place.city", "people", "year", "season"];
  console.log("  --- metadata ---");
  for (const mf of metaFields) {
    let nullCount = 0;
    const counts = {};
    for (const photo of group) {
      const m = photo.meta;
      if (!m) { nullCount++; continue; }
      let vals = [];
      if (mf === "place.city") {
        const c = m.place && m.place.city;
        vals = c ? [c] : [];
      } else if (mf === "people") {
        vals = Array.isArray(m.people) && m.people.length > 0 ? m.people : [];
      } else if (mf === "year") {
        vals = m.year ? [String(m.year)] : [];
      } else if (mf === "season") {
        vals = m.season ? [m.season] : [];
      }
      if (vals.length === 0) {
        nullCount++;
      } else {
        for (const v of vals) { counts[v] = (counts[v] || 0) + 1; }
      }
    }
    const totalNonNull = group.length - nullCount;
    const coverage = (totalNonNull / group.length * 100).toFixed(0);
    const distinct = Object.keys(counts).length;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 4).map(([v, c]) => `${v}(${c})`).join(", ");
    console.log(`  ${mf.padEnd(20)} coverage=${coverage.padStart(3)}%  distinct=${distinct}  top: ${top || "(none)"}`);
  }
}

// ── Cross-theme problem summary ───────────────────────────────────────────────

console.log("\n" + "=".repeat(80));
console.log("CROSS-THEME FIELD PROBLEMS (coverage < 60%)");
console.log("=".repeat(80));

for (const field of TAG_FIELDS) {
  for (const theme of THEMES) {
    const group = photos.filter(p => p.theme === theme);
    let nullCount = 0;
    for (const photo of group) {
      const vals = fieldValues(photo, field);
      if (vals.length === 0) nullCount++;
    }
    const cov = (group.length - nullCount) / group.length;
    if (cov < 0.6) {
      console.log(`  [LOW] theme=${theme}  field=${field}  coverage=${(cov*100).toFixed(0)}%  (${group.length - nullCount}/${group.length})`);
    }
  }
}

// ── Specific audit: "me in a pool" candidate fields ──────────────────────────

console.log("\n" + "=".repeat(80));
console.log("CANDIDATE FIELD AUDIT: pool photos (as seen by coach for 'me in a pool')");
console.log("=".repeat(80));
console.log("These are the fields the coach's selectQuestions() computes distributions for.");
console.log("Field cast_people = metadata.people; place_city = metadata.place.city; time_period from metadata.year\n");

const poolPhotos = photos.filter(p => p.theme === "pool");

// Mirrored computeFieldDistribution logic
const CANDIDATE_FIELDS = [
  { field: "cast_people", label: "WHO shown (cast_people = metadata.people)" },
  { field: "group_type",  label: "WHO group type" },
  { field: "place_city",  label: "WHERE city (metadata.place.city)" },
  { field: "setting",     label: "WHERE setting" },
  { field: "indoor_outdoor", label: "WHERE indoor/outdoor" },
  { field: "time_period", label: "WHEN time_period (derived from metadata.year)" },
  { field: "activity",    label: "WHAT activity" },
  { field: "occasion_guess", label: "OCCASION" },
  { field: "clothing_color", label: "LOOK clothing colour" },
];

for (const { field, label } of CANDIDATE_FIELDS) {
  const counts = {};
  let totalValid = 0;

  for (const photo of poolPhotos) {
    const tag  = photo.tag  || {};
    const meta = photo.meta || {};
    let values = [];

    if (field === "cast_people") {
      if (Array.isArray(meta.people) && meta.people.length > 0) {
        values = [...meta.people];
      } else if (tag.group_type && tag.group_type !== "unknown") {
        values = [tag.group_type];
      }
    } else if (field === "group_type") {
      if (tag.group_type && tag.group_type !== "unknown") values = [tag.group_type];
    } else if (field === "place_city") {
      if (meta.place && meta.place.city) values = [meta.place.city];
      else if (tag.setting && tag.setting !== "unknown") values = [tag.setting];
    } else if (field === "setting") {
      if (tag.setting && tag.setting !== "unknown") values = [tag.setting];
    } else if (field === "indoor_outdoor") {
      if (tag.indoor_outdoor && tag.indoor_outdoor !== "unknown") values = [tag.indoor_outdoor];
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
    }

    if (values.length > 0) {
      totalValid++;
      for (const v of values) {
        const k = v.toLowerCase().trim();
        counts[k] = (counts[k] || 0) + 1;
      }
    }
  }

  const coverage = totalValid / poolPhotos.length;
  const distinct  = Object.keys(counts).length;
  const coachable = coverage >= 0.6 && distinct >= 2;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const topList = sorted.slice(0, 6).map(([v, c]) => `${v}(${c})`).join(", ");

  console.log(`  [${field.padEnd(15)}]  coverage=${(coverage*100).toFixed(0).padStart(3)}%  distinct=${distinct}  coachable=${coachable ? "YES" : " no"}`);
  console.log(`    values: ${topList || "(none)"}`);
  if (field === "cast_people" && coachable) {
    console.log(`    *** PROBLEM: these are RAW NAMES (Meera, Rohan, Aarav...)`);
    console.log(`        not useful cues — user can't remember WHO by name;`);
    console.log(`        should show GROUP TYPE or RELATIONSHIP instead.`);
  }
  if (field === "place_city" && coachable) {
    console.log(`    *** PROBLEM: options show CITY names (Goa, Bengaluru...)`);
    console.log(`        not helpful for pool — user already said "pool";`);
    console.log(`        resort vs home vs club would be more useful.`);
  }
  if (field === "time_period" && coachable) {
    console.log(`    *** NOTE: options show RELATIVE YEARS (2 years ago, Earlier...)`);
    console.log(`        marginally useful but low discriminating power for a pool query.`);
  }
}

console.log("\n" + "=".repeat(80));
console.log("ROOT CAUSE SUMMARY — TASK B");
console.log("=".repeat(80));
console.log(`
RC-B1: cast_people field uses raw personal names from metadata.people
       (Meera, Rohan, Aarav). These score high on balance/entropy
       because each name appears ~1-3 times, making it look like a
       great discriminating field. But names are NOT useful memory
       cues — users search by WHO they were with (friends/family) not
       by knowing the name already.

RC-B2: place_city uses metadata.place.city (Goa, Bengaluru...).
       For theme-homogeneous pools (all Goa), coverage is 100% but
       distinct=1 so it does not trigger. For mixed cases it shows
       city names, which are specific anchors — user already knows
       "pool"; adding "Goa" is a geography quiz, not a memory cue.

RC-B3: The MOST USEFUL fields for pool — activity (swimming/jumping),
       group_type (friends/solo/family), indoor_outdoor (outdoor 100%),
       clothing_color (red/yellow/blue swimsuits) — are either:
       (a) redundant (indoor_outdoor=outdoor for every pool photo -> distinct=1),
       (b) low-coverage due to "unknown" entries, or
       (c) correct but ranked lower than cast_people/place_city by
           the entropy score because raw names have higher spread.
`);
