# DATA_SCHEMAS.md — All Data File Schemas
## Pre-Search "Narrow It Down" Coach — Google Photos MVP

> **Purpose:** Exact JSON shape for every data file. Validate against these before deploying.
> All files live in `/data/`. All are loaded into server memory at startup via `dataLoader.ts`.

---

## 1. `tags.json`

Output of `scripts/tag_library.py`. One entry per photo file.

### Shape

```typescript
type Tags = Record<string, PhotoTag>;

interface PhotoTag {
  // Descriptive
  one_line: string;                        // plain sentence, e.g. "a group of friends splashing in a sunny outdoor pool"
  setting: string;                         // e.g. "pool", "beach", "restaurant", "park", "home"
  indoor_outdoor: "indoor" | "outdoor" | "unknown";
  activity: string;                        // e.g. "swimming", "eating", "hiking"
  
  // Occasion
  occasion_guess: string;                  // e.g. "birthday", "graduation", "festival", "none", "unknown"
  occasion_basis: string;                  // visible clue, e.g. "candles on cake", or "none"
  
  // People
  people_count: number;                    // 0 or positive integer
  people_ages: Array<"child" | "teen" | "adult" | "older adult">;
  people_bucket: "1" | "2" | "3-5" | "6+"; // computed during normalisation
  group_type: "solo" | "couple" | "family" | "friends" | "mixed" | "unknown";
  
  // Look
  clothing: Array<ClothingItem>;           // may be empty []
  objects: string[];                       // notable objects, may be empty []
  
  // Time/Mood
  time_of_day: "morning" | "afternoon" | "evening" | "night" | "unknown";
  weather_or_season: string;               // e.g. "sunny", "snow", "autumn", "unknown"
  mood: string;                            // e.g. "cheerful", "calm", "unknown"
  text_in_image: string;                   // visible text, or "none"
}

interface ClothingItem {
  colour: string;  // from base palette: red|blue|green|yellow|orange|pink|purple|white|black|grey|brown|beige
  item: string;    // e.g. "swimsuit", "jacket", "shorts"
}
```

### Example

```json
{
  "pool_01.jpg": {
    "one_line": "a group of friends splashing in a sunny outdoor pool",
    "setting": "pool",
    "indoor_outdoor": "outdoor",
    "activity": "swimming",
    "occasion_guess": "none",
    "occasion_basis": "none",
    "people_count": 4,
    "people_ages": ["adult", "adult", "adult", "adult"],
    "people_bucket": "3-5",
    "group_type": "friends",
    "clothing": [
      { "colour": "red", "item": "swimsuit" },
      { "colour": "blue", "item": "shorts" }
    ],
    "objects": ["pool float", "sunglasses"],
    "time_of_day": "afternoon",
    "weather_or_season": "sunny",
    "mood": "cheerful",
    "text_in_image": "none"
  }
}
```

### Validation Rules

| Rule | Check |
|---|---|
| Every file in `/public/library/` has an entry | `Object.keys(tags).length >= totalFiles * MIN_TAG_COVERAGE` |
| `people_bucket` computed | Not null; derived from `people_count` |
| `clothing` is array | Always array (even if empty) |
| `occasion_basis` is not `"none"` when `occasion_guess` is not `"none"` | Soft rule; log warning if violated |
| Colours in `clothing` are from base palette | Normalisation step enforces this |
| All string fields are lowercase and trimmed | Normalisation step enforces |

### `people_bucket` Computation

```python
def people_bucket(count):
    if count <= 1: return "1"
    if count == 2: return "2"
    if count <= 5: return "3-5"
    return "6+"
```

### Colour Base Palette

```
red, blue, green, yellow, orange, pink, purple, white, black, grey, brown, beige
```

Any colour not in this set must be mapped to the closest base colour during normalisation.

---

## 2. `targets.json`

Owner-selected study target photos. Populated by Tharun after photos are downloaded and reviewed.

### Shape

```typescript
type Targets = StudyTarget[];

interface StudyTarget {
  id: string;                  // e.g. "T01", "T02" — used in moderator console
  file: string;                // filename, e.g. "pool_03.jpg" — must exist in /public/library/
  theme: string;               // e.g. "pool"
  difficulty: "high-match-count" | "low-match-count" | "medium";
  distinctiveFeature: string;  // what makes this photo uniquely findable, e.g. "red swimsuit, group of 5"
  pairsWith?: string;          // target ID of the comparable difficulty partner (for A/B pairing)
}
```

### Example

```json
[
  {
    "id": "T01",
    "file": "pool_03.jpg",
    "theme": "pool",
    "difficulty": "high-match-count",
    "distinctiveFeature": "red swimsuit, group of 5",
    "pairsWith": "T02"
  },
  {
    "id": "T02",
    "file": "beach_07.jpg",
    "theme": "beach",
    "difficulty": "high-match-count",
    "distinctiveFeature": "yellow hat, two adults",
    "pairsWith": "T01"
  }
]
```

### Validation Rules

| Rule | Check |
|---|---|
| Each `file` exists in `/public/library/` | Startup validation; warn if missing |
| Each `id` is unique | No duplicate IDs |
| At least 2 targets | Study requires ≥ 1 per mode |
| Paired targets have comparable difficulty | Owner responsibility |

---

## 3. `credits.csv`

Attribution for all Pexels photos. Generated by `download_pexels.py`.

### Format

```csv
file,theme,pexels_id,photographer,url
pool_01.jpg,pool,12345678,John Smith,https://www.pexels.com/photo/12345678/
beach_01.jpg,beach,87654321,Jane Doe,https://www.pexels.com/photo/87654321/
```

### Columns

| Column | Type | Description |
|---|---|---|
| `file` | string | Filename in `/public/library/` |
| `theme` | string | Theme key (pool, beach, etc.) |
| `pexels_id` | integer | Pexels photo ID |
| `photographer` | string | Photographer display name |
| `url` | string | Canonical Pexels photo URL |

### Usage

- Read by `scripts/tag_library.py` for reference
- Read by S12 (About & Credits) to render the credits list
- Never used at search time

---

## 4. `synonyms.json`

Token synonym expansion for the lexical search scorer.

### Shape

```typescript
type Synonyms = Record<string, string>;
// key: original token, value: replacement (may be multi-word, split into tokens)
```

### Default Content

```json
{
  "pool": "swimming pool",
  "kid": "child",
  "kids": "child",
  "bday": "birthday",
  "b-day": "birthday",
  "friends": "friend",
  "beach": "seaside",
  "hike": "hiking",
  "trip": "travel",
  "roadtrip": "road trip",
  "grad": "graduation",
  "pet": "dog",
  "pup": "dog",
  "puppy": "dog",
  "outdoor": "outdoors",
  "outside": "outdoors",
  "inside": "indoor",
  "colour": "color",
  "colourful": "colorful",
  "bright": "colourful"
}
```

### Rules

- Keys and values are **lowercase**
- Values may be multi-word (split into tokens during search)
- Adding a new synonym here is the only change needed to expand search vocabulary
- Synonym expansion is applied **before** scoring, not after

---

## 5. `places.json`

Named places and people used by the vague check to detect precise anchors.

### Shape

```typescript
interface Places {
  namedPlaces: string[];   // specific named locations; e.g. ["Eiffel Tower", "Central Park"]
  people: string[];        // known people names in the app; empty in MVP
}
```

### MVP Content

```json
{
  "namedPlaces": [],
  "people": []
}
```

### Notes

- Both lists are empty in the MVP (Pexels library has no real named places or people)
- This means most queries will have `preciseCount < 2` → `isVague: true` — this is expected
- If you want to add test precision anchors, add entries here
- All entries should be lowercase for comparison

---

## 6. `cue_lexicon.json`

Word lists per cue type. Used by `lib/metrics.ts` to classify how many cue types are in a query.

### Shape

```typescript
type CueLexicon = Record<CueType, string[]>;
// CueType = "who" | "when" | "where" | "what" | "occasion" | "look"
```

### Default Content

```json
{
  "who": [
    "friend", "friends", "family", "me", "us", "kids", "child", "children",
    "couple", "group", "alone", "solo", "partner", "sister", "brother",
    "mom", "dad", "parents", "baby", "toddler", "colleagues", "classmates"
  ],
  "when": [
    "morning", "afternoon", "evening", "night", "midnight", "dawn", "dusk",
    "summer", "winter", "spring", "autumn", "fall", "sunset", "sunrise",
    "yesterday", "last", "ago", "year", "month", "week", "holiday",
    "weekend", "daytime", "nighttime"
  ],
  "where": [
    "pool", "beach", "restaurant", "park", "mountain", "home", "house",
    "office", "stadium", "café", "cafe", "outdoor", "indoor", "indoors",
    "outdoors", "garden", "forest", "lake", "river", "sea", "ocean",
    "hotel", "school", "campus", "street", "mall", "airport", "train"
  ],
  "what": [
    "swimming", "eating", "hiking", "dancing", "running", "playing",
    "drinking", "celebrating", "cooking", "laughing", "jumping", "singing",
    "climbing", "cycling", "walking", "sitting", "standing", "hugging"
  ],
  "occasion": [
    "birthday", "graduation", "wedding", "festival", "party", "celebration",
    "trip", "holiday", "vacation", "reunion", "anniversary", "ceremony",
    "concert", "game", "match", "picnic", "barbecue", "bbq"
  ],
  "look": [
    "red", "blue", "green", "yellow", "orange", "pink", "purple",
    "white", "black", "grey", "gray", "brown", "beige", "bright",
    "dark", "colourful", "colorful", "sunny", "rainy", "snowy",
    "swimsuit", "dress", "jacket", "hat", "uniform", "swimwear"
  ]
}
```

### Usage

- `lib/metrics.ts`: for each query, checks which cue type lists the tokens appear in → counts distinct cue types
- Used for **Query Formation Rate** computation only
- NOT used for search scoring (that uses tag field values directly)

---

## 7. Database Schema (`src/db/schema.sql`)

```sql
-- Events table (append-only, never update or delete)
CREATE TABLE IF NOT EXISTS events (
  id             SERIAL PRIMARY KEY,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- DB server time
  ts             TIMESTAMPTZ NOT NULL,                 -- client-reported time
  session_id     TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  mode           CHAR(1) NOT NULL CHECK (mode IN ('A', 'B', 'C')),
  type           TEXT NOT NULL,
  payload        JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Indexes for export query performance
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_participant ON events(participant_id);
```

### Notes

- Schema is additive only — never drop or rename columns after first deploy
- `ts` = client timestamp (for sequence ordering)
- `created_at` = DB timestamp (for actual timing analysis)
- `payload` is flexible JSONB — schema varies per event type (see `api_contracts.md` section 6)

---

## 8. Config Files Quick Reference

| File | Owner | Changes when |
|---|---|---|
| `data/tags.json` | Script output | Photos re-tagged |
| `data/targets.json` | Tharun (product owner) | Study targets updated |
| `data/credits.csv` | Script output | Photos re-downloaded |
| `data/synonyms.json` | Developer | Search vocabulary updated |
| `data/places.json` | Developer | Named places/people added |
| `data/cue_lexicon.json` | Developer | Cue classifier vocabulary updated |
| `src/lib/config.ts` | Developer | Thresholds need tuning |
| `.env.local` | Developer | API keys change |

---

*End of DATA_SCHEMAS.md*
