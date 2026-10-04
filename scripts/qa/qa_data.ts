// scripts/qa/qa_data.ts
import fs from "fs";
import path from "path";

console.log("=== STAGE 2: DATA INTEGRITY AUDIT ===\n");

interface TagData {
  one_line?: string;
  setting?: string;
  indoor_outdoor?: string;
  activity?: string;
  occasion_guess?: string;
  occasion_basis?: string;
  people_count?: number;
  people_bucket?: string;
  group_type?: string;
  people_ages?: string[];
  clothing?: Array<{ colour?: string; item?: string }>;
  objects?: string[];
  time_of_day?: string;
  weather_or_season?: string;
  mood?: string;
  text_in_image?: string;
}

interface PhotoMeta {
  synthetic?: boolean;
  event_id?: string;
  event_title?: string;
  taken_at?: string;
  year?: number;
  month?: number;
  month_name?: string;
  season?: string;
  place?: {
    city?: string;
    venue?: string;
    country?: string;
    lat?: number;
    lng?: number;
  };
  people?: string[];
  device?: string;
}

const findings: string[] = [];

// 1. Library files check
console.log("--- 1. Library Files Audit ---");
const libraryDir = path.join(process.cwd(), "public", "library");
const libraryFiles = fs.readdirSync(libraryDir).filter(f => f.endsWith(".jpg") || f.endsWith(".jpeg") || f.endsWith(".png"));
console.log(`Found ${libraryFiles.length} photo files in public/library`);
if (libraryFiles.length !== 200) {
  findings.push(`Library photo count is ${libraryFiles.length}, expected 200.`);
}

let over400kCount = 0;
const largeFiles: { file: string; sizeKB: number }[] = [];
for (const f of libraryFiles) {
  const stat = fs.statSync(path.join(libraryDir, f));
  const sizeKB = Math.round(stat.size / 1024);
  if (sizeKB > 400) {
    over400kCount++;
    largeFiles.push({ file: f, sizeKB });
  }
}
largeFiles.sort((a, b) => b.sizeKB - a.sizeKB);
console.log(`Photos > 400 KB: ${over400kCount}`);
if (largeFiles.length > 0) {
  console.log(`Top 5 largest: ${largeFiles.slice(0, 5).map(x => `${x.file} (${x.sizeKB} KB)`).join(", ")}`);
} else {
  console.log("All 200 photos are under 400 KB: PASS [OK]");
}

// 2. tags.json validation
console.log("\n--- 2. tags.json Schema & Coverage Audit ---");
const tagsPath = path.join(process.cwd(), "data", "tags.json");
const tags: Record<string, TagData> = JSON.parse(fs.readFileSync(tagsPath, "utf-8"));
const tagKeys = Object.keys(tags);
console.log(`tags.json covers ${tagKeys.length} entries`);
if (tagKeys.length !== 200) {
  findings.push(`tags.json covers ${tagKeys.length} photos, expected 200`);
}

// Check coverage against library files
const missingInTags = libraryFiles.filter(f => !tags[f]);
if (missingInTags.length > 0) {
  findings.push(`Library files missing from tags.json: ${missingInTags.join(", ")}`);
}

const controlledSettings = new Set([
  "beach", "pool", "restaurant", "cafe", "park", "garden", "home", "indoor",
  "mountains", "forest", "trail", "city street", "patio", "backyard", "car interior",
  "concert", "stadium", "building exterior", "living room", "kitchen", "waterfall",
  "lake", "desert", "road", "playground", "office", "classroom", "hotel", "balcony"
]);
const controlledGroupTypes = new Set(["solo", "couple", "family", "friends", "mixed", "unknown"]);
const controlledPeopleBuckets = new Set(["0", "1", "2", "3-5", "6+"]);

const unknownSettings = new Set<string>();
const invalidGroupTypes = new Set<string>();
const invalidPeopleBuckets = new Set<string>();
let emptyOneLine = 0;
const themeCounts: Record<string, number> = {};

for (const [fn, t] of Object.entries(tags)) {
  const theme = fn.split("_")[0];
  themeCounts[theme] = (themeCounts[theme] || 0) + 1;

  if (!t.one_line || !t.one_line.trim()) emptyOneLine++;

  if (t.setting && !controlledSettings.has(t.setting.toLowerCase())) {
    unknownSettings.add(t.setting);
  }
  if (t.group_type && !controlledGroupTypes.has(t.group_type)) {
    invalidGroupTypes.add(t.group_type);
  }
  if (t.people_bucket && !controlledPeopleBuckets.has(t.people_bucket)) {
    invalidPeopleBuckets.add(t.people_bucket);
  }
}

console.log("Photo counts per theme in tags.json:", themeCounts);
console.log(`Empty one_line count: ${emptyOneLine}`);
console.log(`Unknown / free-text setting values (${unknownSettings.size}):`, Array.from(unknownSettings));
console.log(`Group_type values outside controlled set (${invalidGroupTypes.size}):`, Array.from(invalidGroupTypes));
console.log(`People_bucket values outside controlled set (${invalidPeopleBuckets.size}):`, Array.from(invalidPeopleBuckets));

// 3. photo_meta.json audit
console.log("\n--- 3. photo_meta.json Audit ---");
const metaPath = path.join(process.cwd(), "data", "photo_meta.json");
const castPath = path.join(process.cwd(), "data", "cast.json");
const placesPath = path.join(process.cwd(), "data", "places.json");
const storyEventsPath = path.join(process.cwd(), "data", "story_events.json");

const photoMeta: Record<string, PhotoMeta> = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, "utf-8")) : {};
const castData = fs.existsSync(castPath) ? JSON.parse(fs.readFileSync(castPath, "utf-8")) : [];
const castNames = new Set(castData.map((c: any) => c.name));
const placesObj = fs.existsSync(placesPath) ? JSON.parse(fs.readFileSync(placesPath, "utf-8")) : { namedPlaces: [], venues: [] };
const namedPlacesList: string[] = placesObj.namedPlaces || [];
const storyEvents = fs.existsSync(storyEventsPath) ? JSON.parse(fs.readFileSync(storyEventsPath, "utf-8")) : {};

console.log(`photo_meta.json entries: ${Object.keys(photoMeta).length}`);
let metaMissingFields = 0;
let metaCountMismatch = 0;
let metaCastUnknown = 0;
let metaNotSynthetic = 0;
let takenAtOutOfRange = 0;

for (const [id, meta] of Object.entries(photoMeta)) {
  const filename = id.endsWith(".jpg") ? id : `${id}.jpg`;
  const tag = tags[filename] || tags[id];

  if (!meta.event_id || !meta.taken_at || !meta.place || meta.place.lat === undefined || meta.place.lng === undefined) {
    metaMissingFields++;
  }
  if (!meta.synthetic) {
    metaNotSynthetic++;
  }
  if (meta.people) {
    for (const p of meta.people) {
      if (!castNames.has(p)) {
        metaCastUnknown++;
      }
    }
    if (tag && tag.people_count !== undefined) {
      // If meta has people names but tag is 0 people, that's a data mismatch
      if (meta.people.length > 0 && tag.people_count === 0) {
        metaCountMismatch++;
      }
    }
  }

  // Check event range
  const ev = storyEvents[meta.event_id || ""];
  if (ev && ev.start_date && ev.end_date) {
    const taken = new Date(meta.taken_at || "").getTime();
    const start = new Date(ev.start_date).getTime();
    const end = new Date(ev.end_date).getTime() + 86400000;
    if (taken < start || taken > end) {
      takenAtOutOfRange++;
    }
  }
}

console.log(`Missing required meta fields: ${metaMissingFields} (PASS: ${metaMissingFields === 0})`);
console.log(`Metadata missing synthetic flag: ${metaNotSynthetic} (PASS: ${metaNotSynthetic === 0})`);
console.log(`Cast names not in cast.json: ${metaCastUnknown} (PASS: ${metaCastUnknown === 0})`);
console.log(`People count vs tags mismatch: ${metaCountMismatch}`);
console.log(`taken_at out of story event date range: ${takenAtOutOfRange} (PASS: ${takenAtOutOfRange === 0})`);

// 4. credits.csv audit
console.log("\n--- 4. credits.csv Audit ---");
const creditsPath = path.join(process.cwd(), "data", "credits.csv");
const creditsContent = fs.readFileSync(creditsPath, "utf-8");
const creditLines = creditsContent.split("\n").map(l => l.trim()).filter(Boolean);
console.log(`credits.csv header: ${creditLines[0]}, total rows: ${creditLines.length - 1}`);

let missingPhotographerOrUrl = 0;
let pexelsCredits = 0;
const creditPhotos = new Set<string>();

for (const line of creditLines.slice(1)) {
  const parts = line.split(",");
  const file = parts[0]?.trim();
  const theme = parts[1]?.trim();
  const pexelsId = parts[2]?.trim();
  const photographer = parts[3]?.trim();
  const url = parts[4]?.trim();

  if (file) creditPhotos.add(file);
  if (!photographer || !url || !url.startsWith("http")) {
    missingPhotographerOrUrl++;
  }
  if (url && (url.toLowerCase().includes("pexels") || photographer.toLowerCase().includes("pexels"))) {
    pexelsCredits++;
  }
}

console.log(`Credit rows with missing photographer or URL: ${missingPhotographerOrUrl} (PASS: ${missingPhotographerOrUrl === 0})`);
console.log(`Photos credited to Pexels: ${pexelsCredits}`);
const missingCredit = libraryFiles.filter(f => !creditPhotos.has(f));
console.log(`Library files missing credit: ${missingCredit.length} (PASS: ${missingCredit.length === 0})`);

// 5. targets.json audit
console.log("\n--- 5. targets.json Audit ---");
const targetsPath = path.join(process.cwd(), "data", "targets.json");
if (fs.existsSync(targetsPath)) {
  const targets = JSON.parse(fs.readFileSync(targetsPath, "utf-8"));
  console.log(`targets.json count: ${targets.length}`);

  let hintErrors = 0;

  targets.forEach((tgt: any) => {
    const fileExists = fs.existsSync(path.join(libraryDir, tgt.photoId || tgt.file || ""));
    const hint: string = tgt.hint || tgt.vagueHint || "";
    
    // check 4-digit year
    const hasYear = /\b(19\d\d|20\d\d)\b/.test(hint);
    
    // check city from places.json
    let matchedCity = "";
    for (const c of namedPlacesList) {
      if (c && c.length > 2 && hint.toLowerCase().includes(c.toLowerCase())) {
        matchedCity = c;
        break;
      }
    }

    // check cast name from cast.json
    let matchedCast = "";
    for (const name of castNames) {
      if (name && hint.toLowerCase().includes((name as string).toLowerCase())) {
        matchedCast = name as string;
        break;
      }
    }

    console.log(`Target ${tgt.id}: photo=${tgt.photoId} (exists: ${fileExists}), theme=${tgt.theme}, hint="${hint}"`);
    if (hasYear || matchedCity || matchedCast) {
      console.log(`  FAIL: Hint contains forbidden info! year=${hasYear}, city="${matchedCity}", cast="${matchedCast}"`);
      hintErrors++;
    }
  });
  console.log(`Targets with hint errors: ${hintErrors} (PASS: ${hintErrors === 0})`);
} else {
  console.log("targets.json: ARCHIVED / REMOVED (stateless MVP: PASS [OK])");
}

// 6. events.json and study_export_final.csv check
console.log("\n--- 6. Cleanliness Audit: events.json & study_export_final.csv ---");
const eventsPath = path.join(process.cwd(), "data", "events.json");
if (fs.existsSync(eventsPath)) {
  const eventsRaw = fs.readFileSync(eventsPath, "utf-8").trim();
  try {
    const evArr = JSON.parse(eventsRaw);
    const eventsEmpty = Array.isArray(evArr) && evArr.length === 0;
    console.log(`data/events.json: contains ${evArr.length} events (expected empty []: ${eventsEmpty ? "PASS" : "DEVIATION/FAIL"})`);
  } catch (e) {
    console.log(`data/events.json parse error: ${e}`);
  }
} else {
  console.log("data/events.json: ARCHIVED / REMOVED (stateless MVP: PASS [OK])");
}

const studyExportFinalExists = fs.existsSync(path.join(process.cwd(), "data", "study_export_final.csv"));
console.log(`data/study_export_final.csv exists: ${studyExportFinalExists ? "DEVIATION/FAIL (File exists)" : "PASS [None]"}`);

const simScriptExists = fs.existsSync(path.join(process.cwd(), "scripts", "run_phase6_study_simulation.py"));
console.log(`scripts/run_phase6_study_simulation.py in main folder: ${simScriptExists ? "DEVIATION/FAIL (Unarchived)" : "PASS [Archived or deleted]"}`);
const archivedSimExists = fs.existsSync(path.join(process.cwd(), "scripts", "archive", "run_phase6_study_simulation.py"));
console.log(`scripts/archive/run_phase6_study_simulation.py: ${archivedSimExists ? "PASS [Archived]" : "None"}`);

// 7. Attribution line checks in pages S1, S6, S12
console.log("\n--- 7. Attribution Line Audit ---");
const checkAttribution = (filePath: string, pageName: string) => {
  const content = fs.readFileSync(filePath, "utf-8");
  const hasPixabay = content.toLowerCase().includes("photos from pixabay");
  console.log(`${pageName} (${filePath}): "Photos from Pixabay" present -> ${hasPixabay ? "PASS [OK]" : "FAIL [MISSING]"}`);
};

checkAttribution("src/app/page.tsx", "S1 Home Grid");
checkAttribution("src/app/results/page.tsx", "S6 Results Grid");
checkAttribution("src/app/about/page.tsx", "S12 About");
