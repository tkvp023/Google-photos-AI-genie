# PROMPTS_REFERENCE.md — All AI Prompts
## Pre-Search "Narrow It Down" Coach — Google Photos MVP

> **Purpose:** Single source of truth for every AI prompt used in the project.
> Updating a prompt anywhere in the codebase MUST be reflected here first.
> Version each prompt so changes are traceable.

---

## Prompt Inventory

| ID | Name | Used in | Model | Called when |
|---|---|---|---|---|
| P1 | Photo Tagging System Prompt | `scripts/tag_library.py` | Gemini Flash vision | Offline, once per photo |
| P2 | Prompt Composer System Prompt | `lib/promptComposer.ts` | Groq Llama 3.x instruct | Runtime, on "Build my search" |
| P3 | Prompt Composer User Message Template | `lib/promptComposer.ts` | Groq Llama 3.x instruct | Runtime, on "Build my search" |

---

## P1 — Photo Tagging System Prompt

**File:** `scripts/tag_prompt.txt`  
**Version:** 1.0 (Oct 1 2026)  
**Model:** Gemini Flash vision (model name set via `GEMINI_MODEL` env var)  
**Called:** Once per photo, offline only. Never at runtime.  
**Response format:** `response_mime_type = "application/json"`

### Full Prompt Text

```
You are tagging one photo for a photo-search test. Describe only what is
visible. Do not guess names or identities. For people, give counts and
rough age bands only (child, teen, adult, older adult). If unsure, use
"unknown". Return JSON only, matching this shape:

{
  "one_line": "plain sentence describing the scene",
  "setting": "e.g. pool, beach, restaurant, park, home, street",
  "indoor_outdoor": "indoor | outdoor | unknown",
  "activity": "what people are doing, e.g. swimming, eating, hiking",
  "occasion_guess": "e.g. birthday, graduation, festival, none, unknown",
  "occasion_basis": "visible clue behind the guess, or none",
  "people_count": 0,
  "people_ages": ["child", "adult"],
  "group_type": "solo | couple | family | friends | mixed | unknown",
  "clothing": ["colour + item, e.g. red swimsuit"],
  "objects": ["notable objects"],
  "time_of_day": "morning | afternoon | evening | night | unknown",
  "weather_or_season": "e.g. sunny, snow, unknown",
  "mood": "e.g. cheerful, calm, unknown",
  "text_in_image": "visible text, or none"
}
```

### Call Structure (Python)

```python
import google.generativeai as genai
import json, base64, pathlib

genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel(os.environ["GEMINI_MODEL"])

prompt_text = pathlib.Path("scripts/tag_prompt.txt").read_text()
image_bytes  = pathlib.Path(f"public/library/{filename}").read_bytes()
image_part   = {"mime_type": "image/jpeg", "data": base64.b64encode(image_bytes).decode()}

response = model.generate_content(
    [prompt_text, image_part],
    generation_config=genai.GenerationConfig(
        response_mime_type="application/json",
        temperature=0.1,
        max_output_tokens=512,
    )
)
tag = json.loads(response.text)
```

### Quality Criteria

| Check | Pass | Action if fail |
|---|---|---|
| `occasion_guess` is correct for birthday photos | `"birthday"` with a real `occasion_basis` | Tighten prompt: "Look for candles, cake, or birthday banners" |
| `clothing` has colours, not just item type | `"red swimsuit"` not `"swimwear"` | Add to prompt: "For each clothing item, always name the colour first" |
| `unknown` used when genuinely unsure | Not inventing location names | Add: "If you cannot see it clearly, use 'unknown'" |
| `clothing` is array of strings (not objects) | Raw Gemini output is strings | Normalisation converts to `{colour, item}` objects |

### Normalisation Applied After Tagging

Performed in `tag_library.py` before writing `tags.json`:

```python
BASE_COLOURS = {"red","blue","green","yellow","orange","pink","purple",
                "white","black","grey","brown","beige"}

def normalise_colour(c):
    c = c.lower().strip()
    # map near-colours
    MAP = {"gray":"grey","silver":"grey","gold":"yellow","navy":"blue",
           "turquoise":"blue","teal":"blue","maroon":"red","coral":"orange",
           "cream":"beige","tan":"beige","khaki":"beige"}
    return MAP.get(c, c if c in BASE_COLOURS else "unknown")

def parse_clothing(raw_list):
    # raw_list = ["red swimsuit", "blue shorts"]
    result = []
    for item in raw_list:
        parts = item.strip().split(" ", 1)
        if len(parts) == 2:
            colour = normalise_colour(parts[0])
            result.append({"colour": colour, "item": parts[1].strip()})
        else:
            result.append({"colour": "unknown", "item": item.strip()})
    return result

def people_bucket(count):
    if count <= 1: return "1"
    if count == 2: return "2"
    if count <= 5: return "3-5"
    return "6+"
```

### Known Limitations

- Gemini may occasionally confuse `"friends"` with `"family"` for group type
- Occasion guess may miss subtle occasions without visible props (e.g. a graduation dinner without caps)
- `clothing` may be empty for photos where clothing is not visible (e.g. underwater shots)
- `text_in_image` may miss small or stylised text

---

## P2 — Prompt Composer System Prompt

**File:** `src/lib/promptComposer.ts` (string constant `COMPOSER_SYSTEM_PROMPT`)  
**Version:** 1.0 (Oct 1 2026)  
**Model:** Groq Llama 3.x instruct (model name set via `GROQ_MODEL` env var)  
**Called:** At runtime when user taps "Build my search"  
**Temperature:** `0.2`  
**Max tokens:** `120`  
**Timeout:** `3000 ms`

### Full System Prompt Text

```
You turn a short photo-search query plus a few user-chosen details into ONE
short natural-language search prompt. Rules:
- Start from the user's own words. Keep them.
- Add ONLY the details provided in "answers". Never invent anything.
- Use the same words as the answers where possible (e.g. "red swimsuit").
- One sentence, under 25 words, no quotes, no explanations.
Return JSON only: {"prompt": "...", "cues": [{"type": "who|occasion|look|what|when|where", "value": "..."}]}
```

### Usage in Code

```typescript
const COMPOSER_SYSTEM_PROMPT = `You turn a short photo-search query plus a few user-chosen details into ONE
short natural-language search prompt. Rules:
- Start from the user's own words. Keep them.
- Add ONLY the details provided in "answers". Never invent anything.
- Use the same words as the answers where possible (e.g. "red swimsuit").
- One sentence, under 25 words, no quotes, no explanations.
Return JSON only: {"prompt": "...", "cues": [{"type": "who|occasion|look|what|when|where", "value": "..."}]}`;
```

---

## P3 — Prompt Composer User Message Template

**File:** `src/lib/promptComposer.ts` (function `buildUserMessage`)  
**Version:** 1.0 (Oct 1 2026)

### Template

```
typed: "<typed_query>"
answers: [
  {"cueType": "<cueType>", "value": "<value>"},
  ...
]
```

### Builder Function

```typescript
function buildUserMessage(typedQuery: string, answers: Answer[]): string {
  const answersJson = answers
    .filter(a => a.source !== "dontRemember")          // exclude skipped
    .map(a => ({ cueType: a.cueType, value: a.value }));

  return `typed: "${typedQuery}"\nanswers: ${JSON.stringify(answersJson, null, 2)}`;
}
```

### Example Input → Output

**User message:**
```
typed: "pool"
answers: [
  {"cueType": "who", "value": "friends"},
  {"cueType": "look", "value": "red swimsuit"},
  {"cueType": "where", "value": "outdoors"}
]
```

**Expected Groq output:**
```json
{
  "prompt": "Me with friends at the pool in red swimsuits, outdoors",
  "cues": [
    {"type": "who", "value": "friends"},
    {"type": "look", "value": "red swimsuit"},
    {"type": "where", "value": "outdoors"}
  ]
}
```

### Validation Rules for Groq Response

```typescript
function validateGroqResponse(raw: string): { prompt: string; cues: Cue[] } {
  const parsed = JSON.parse(raw);                            // may throw → fallback
  if (typeof parsed.prompt !== "string") throw new Error("No prompt");
  if (!Array.isArray(parsed.cues))       throw new Error("No cues");
  if (parsed.prompt.length > 200)        throw new Error("Prompt too long");
  // Check no invented content (soft check — log if suspicious)
  return { prompt: parsed.prompt.trim(), cues: parsed.cues };
}
```

---

## Deterministic Fallback (no AI)

When P2/P3 fails for any reason (timeout, invalid JSON, network error, key missing):

```typescript
function deterministicFallback(typedQuery: string, answers: Answer[]): ComposedPrompt {
  const parts = [
    typedQuery,
    ...answers
      .filter(a => a.source !== "dontRemember")
      .map(a => a.value),
  ];
  // de-duplicate
  const unique = [...new Set(parts.filter(Boolean))];
  const prompt = unique.join(", ");
  const cues = answers
    .filter(a => a.source !== "dontRemember")
    .map(a => ({ type: a.cueType, value: a.value }));
  return { prompt, cues, composer: "fallback" };
}
```

**Example:**
- `typed: "pool"`, `answers: [{who, friends}, {look, red swimsuit}]`
- Output: `"pool, friends, red swimsuit"`

---

## Caching Strategy

```typescript
// In-memory cache (lives for the duration of the server process)
const cache = new Map<string, ComposedPrompt>();

function cacheKey(typedQuery: string, answers: Answer[]): string {
  const sorted = [...answers]
    .filter(a => a.source !== "dontRemember")
    .sort((a, b) => a.cueType.localeCompare(b.cueType) || a.value.localeCompare(b.value));
  return sha256(`${typedQuery}::${JSON.stringify(sorted)}`);
}
```

- Cache is in-memory only (resets on cold start / redeploy)
- No persistent caching needed (study runs within a single deployment)
- Cache hit → `cached: true` in response

---

## Prompt Change Policy

If a prompt needs to be updated:
1. Update this document with the new version and date
2. Bump the version number (`1.0` → `1.1`)
3. Update the prompt string in the corresponding script/lib file
4. Re-tag photos if P1 changes (or spot-check 10 photos)
5. Add a note in `decisions_log.md` with reason for change

---

*End of PROMPTS_REFERENCE.md*
