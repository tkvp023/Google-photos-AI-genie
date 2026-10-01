# PROBLEM_STATEMENT.md — Pre-Search "Narrow It Down" Coach (Google Photos look-alike MVP)

> **Audience:** Antigravity (coding agent). Build exactly what is described here.
> **Owner:** Tharun (product owner, will supply wireframes and review).
> **Hard deadline:** Wednesday 7 October 2026, 3:59 PM IST (deployed link must work, no login).
> **Purpose of the MVP:** a working, deployed, testable copy of a Google Photos search experience that lets us compare **plain search** against **plain search plus our coach**, on the same photo library, with real test users.

---

## 0. How to use this document

1. Read sections 1 to 3 first. They explain **why** we build this, so you can make sensible choices where this document is silent.
2. Sections 4 to 9 are the **build specification**: data, search, vague check, coach, prompt composer, screens.
3. Section 10 covers **study mode and logging** (we must measure results from real users).
4. Section 12 is a **task list with done-definitions**. Work in that order.
5. **Wireframes** will be placed in `/wireframes/`. They are the source of truth for **layout**. This document is the source of truth for **behaviour**. If they conflict on layout, follow the wireframe. If they conflict on behaviour, follow this document and note it in `README.md`.
6. Where something is not specified, choose the simplest reasonable option, keep it configurable, and list the assumption in `README.md` under "Assumptions made".

---

## 1. The true problem we are solving

### 1.1 Problem statement (verbatim from the product brief)

> Users struggle to retrieve Google Photos memories they remember but can't precisely describe.
> **Goal:** increase successful retrieval of a photo the user remembers using vague prompts. This is not about improving search broadly. It is about understanding memory, where retrieval breaks, and where to intervene.

### 1.2 Who has this problem (target segment)

Google Photos users with Ask Photos (Gemini) turned on who search for **one specific old photo** from a **vague memory** (they remember the moment, not the exact date or place).

People who never search, or who remember exact dates, do not hit this failure. Fixing their experience would not move our metric.

### 1.3 What a "vague" search is (working definition, ours, not Google's)

> A search is **vague** when the user lacks a **precise anchor in at least 2 of 3 filters (Person, Time, Location)** and uses approximations instead ("a few years ago", "that café", "me"). It is judged on the **first query typed**, before any help.

### 1.4 The root cause (what is actually going wrong)

> People remember a photo as a **scene of several details**, but the words they tend to type for it ("pool", "me", "beach") **match many photos** in a large library. So the query often **fails to single out the one they mean**.
>
> **Why:** the details that would single the photo out (the occasion, the feeling, how it looked, the combination) are remembered as a scene and **do not come out as words**. Only the **combination** pinpoints the photo, and the combination is what gets lost.

Important distinction for the build: **stored photo details are not the problem.** The problem is on the **query side**. Search can only match what the user typed. "pool" matching 83 real pool photos cannot be fixed by better ranking, because nothing in "pool" says which one the user means. The user has to supply more, and the coach helps them do it.

### 1.5 Evidence behind the problem (for context, do not display in the app)

- **User survey (n=20 who answered search questions):** 16 recalled 2+ details about the photo, yet 12 typed a single word at some point. 14 scroll the timeline after a miss. 15 need a few tries.
- **5 user interviews:** "swimming pool" returned 83 results; "just me" returned "thousands of photos"; a distinctive query ("silver racket") worked.
- **AI Discovery Engine (1,616 verified search-failure reviews):** 59.0% of failures are at the **Expression** step (putting the memory into a query), 38.9% at Interpretation, 0.6% Evaluation, 1.6% Recovery.

### 1.6 Where this fits in the search journey

| Step | In scope? | Reason |
|---|---|---|
| Remember the photo (Intent) | Out | A product can't change human memory |
| **Type the search (Articulate / Expression)** | **In, this is the step we act on** | Biggest failing step we can influence |
| Search runs (Interpretation) | Out | Ranking is Google's core engine |
| See and scan results (Evaluation) | In (monitored) | Scrolling the results counts |
| Try again (Recovery) | In (monitored) | Refine, retry, or give up |

### 1.7 Success metrics (what the MVP must let us measure)

| Metric | Definition | Role |
|---|---|---|
| **Vague Search Success Rate** | % of vague-search tasks where the user finds the target photo within the task | North star (final decision metric) |
| **Query Formation Rate** | % of vague sessions whose **first submitted query** carries **2+ cue types** | Primary outcome, diagnostic |
| Results per first query | Number of photos returned by the first submitted query | Supporting |
| Time to find | Seconds from task start to "This is the photo" | Supporting |
| Found or not | Task ended with correct photo vs give-up/timeout | Supporting |

**Cue types** (counted on the first submitted query): `who`, `when`, `where`, `what`, `occasion`, `look` (how it looked: colours, clothes, setting).

**Guardrails:** coach trigger rate, coach dismiss/skip rate, "I don't remember" rate, prompt edit rate, time added before submit.

> Query Formation Rate alone can be gamed (every chip adds a cue by construction). Always report it **next to** results per first query and found rate.

---

## 2. The solution (what we are building)

### 2.1 One-line description

> While the user is still typing a **vague** query, a **coach** asks a few **tappable or typeable memory questions** (who was there, what the occasion was, how it looked, roughly when). The questions are **chosen from the photo library** so each one narrows the matches the most. The coach then writes a **fuller prompt** that the user can **review and edit** before searching.

### 2.2 Why this solution follows from the problem

| Problem says | Coach does |
|---|---|
| Typed words ("pool", "me") match many photos | Detects a vague, broad query and says so ("Too many photos match") |
| The details that single the photo out are not put into words | Asks for them as **choices to recognise** (tap) instead of words to **recall** (type) |
| Only the combination pinpoints the photo, and it gets lost | Joins typed words and tapped answers into **one multi-detail prompt** |
| Every existing workaround goes around the query | The coach **changes what the query carries**, before it runs |

### 2.3 The combined design (two layers)

- **Layer 1 — Query-only coach (always works):** reads only the typed query and asks **generic memory questions** (who / occasion / look / when) that are not already answered in the query. Needs no photo tags.
- **Layer 2 — Library-aware chips (default when tags are available):** picks the questions and answer options from the **tagged library**, choosing the question that **splits the current matches best**.
- **Fallback:** if tags are missing, coverage is low, or the candidate set is too small or empty, show Layer 1 generic questions. If the Groq call fails, use the deterministic prompt composer.

### 2.4 End-to-end user flow (coach mode)

1. User opens Search and starts typing a query (for example `pool`).
2. After a pause (debounce, default **500 ms**), the app runs the **vague check** (rule-based, free).
3. If vague **and** the preview match count is high (default **≥ 12** of the library) **and** tag coverage is high: the **coach panel** appears under the search bar with a soft message: *"Lots of photos match. Help us narrow it down."* (No raw number shown to the user; number visible only in debug mode.)
4. The panel shows up to **3 questions**, each with up to **4 answer chips** plus **"Something else"** (type) and **"I don't remember"**.
5. Each tap updates the **preview candidate set** (client/server in-memory filter, no AI call) and the remaining questions are **re-ranked**.
6. User presses **"Build my search"** (or **"Search anyway"** at any time).
7. The coach calls the **prompt composer** (Groq, with deterministic fallback) and shows an **editable prompt box**, for example `Me with friends at the pool in red swimsuits, outdoors, sunny`.
8. User edits (optional) and presses **Search**.
9. Results are shown. User opens photos and marks **"This is the photo"** or **"Not it"** (for study logging).

### 2.5 What the coach must NOT do

- Must **not** run a Gemini/LLM search on every keystroke.
- Must **not** show the coach for **precise** queries (exact date, tagged person, named place with exact anchor) — those pass straight through.
- Must **not** block search. The user can always press **Search anyway**.
- Must **not** invent details the user did not choose. The composed prompt only uses the typed text and tapped/typed answers.
- Must **not** show people's names, identities or face-recognition results (library photos are strangers; the People tab is a static placeholder).

### 2.6 Where AI is and is not used

| Part | Uses AI? | Notes |
|---|---|---|
| Tag each library photo | **Yes — Gemini vision, offline, once** | Output is `data/tags.json`. Not called at runtime. |
| Vague check | No | Rule-based text check |
| Preview match count | No | In-memory lookup on tags |
| Choose best question / options | No | Counting / balance score (section 7) |
| Question wording | No (templates) | Optional Groq polish behind a flag, default off |
| Compose the editable prompt | **Yes — Groq text call (fast)** | Deterministic fallback if it fails |
| Ranking / matching | No (stand-in search, section 5) | Same function in both modes |

---

## 3. Study design the app must support

We compare modes on the **same library, same search backend**:

| Mode | Name | Behaviour |
|---|---|---|
| **A** | Plain search | Typed query goes straight to search. **No coach.** |
| **B** | Coach search | Coach flow in section 2.4 |
| **C** (stretch, only if time) | Chips after submit | Same chips, but shown on the results page after the first search |

- Target: **at least 3 participants, 5 if possible** from the segment.
- Each participant does **2 tasks**: one in Mode A, one in Mode B. **Counterbalance** order across participants and use **different target photos** of comparable difficulty.
- Task: moderator shows a **target photo for 5 seconds**, hides it, then the participant finds it from memory. Time limit **3 minutes** per task.
- The app must log everything needed to compute the metrics in section 1.7 (see section 10).

**What the MVP can and cannot prove (state this in the deck):**
- It can show whether the coach changes **what users type** and **how many results come back**.
- It does **not** prove Google's real ranking would behave the same, because the search here is a stand-in.
- It uses stock photos, which are more polished than real libraries, and a small sample.

---

## 4. Data: the photo library (Pexels)

### 4.1 Why Pexels and why this shape

A real library has **many photos of the same kind of moment**, which is what makes "pool" return many results. So the library is **10 themes × about 10 photos**, with variety **inside each theme** (group size, clothing colours, indoor/outdoor, time of day). If all pool photos look the same, the coach has nothing to split on.

### 4.2 Source and licence

- **Source:** Pexels (https://www.pexels.com). API docs: https://www.pexels.com/api/documentation/
- **Licence:** Pexels photos are free to use under the Pexels licence. **Verify the current terms at https://www.pexels.com/license/** before final submission. Do not imply the people shown endorse anything. Do not resell the photos.
- **Credits:** keep `credits.csv` (photographer, Pexels URL per photo) and show a **Credits page** in the app (screen S12). Attribution is not required but we will give it.
- **Use for study only:** these are strangers' photos used in a prototype for a product-management case study.

### 4.3 API usage

- Endpoint: `GET https://api.pexels.com/v1/search`
- Auth: header `Authorization: <PEXELS_API_KEY>` (free key from the Pexels API page; **never commit the key**).
- Params used: `query`, `per_page` (max 80), `page`, optional `orientation`.
- Response fields used: `photos[].id`, `photos[].photographer`, `photos[].url`, `photos[].avg_color`, `photos[].src.large` (download this size), `photos[].width`, `photos[].height`.
- **Do NOT use Pexels' `alt` text as tags.** Our tags must come only from the Gemini tagging step so they are consistent and comparable.
- Default rate limits are low (roughly a couple of hundred requests per hour). Sleep 1 second between calls. Check the docs for current limits.

### 4.4 Themes and queries

| Theme key | Pexels query | Why it helps the test |
|---|---|---|
| `pool` | friends swimming pool | The "83 results" scenario |
| `beach` | family beach vacation | Close to pool, tests splitting by look and setting |
| `birthday` | birthday party cake | Occasion cue (cake, candles) |
| `restaurant` | friends dinner restaurant | Friends, indoor |
| `festival` | family festival celebration | Occasion without a cake-like object |
| `hiking` | friends hiking mountain trip | Outdoor, varied group size |
| `kids` | children playing park | Colourful clothing |
| `graduation` | graduation friends campus | Occasion and people |
| `pets` | dog with owner | Pet case from our research |
| `roadtrip` | road trip friends car | Vehicle and travel |

Download about **14 per theme**, then **cut to about 100 total**: remove blurry, near-identical, off-theme, or explicit/unsuitable photos. Keep variety inside each theme.

### 4.5 Folder structure

```
/public/library/            # final ~100 images, named <theme>_<nn>.jpg, "large" size
/data/credits.csv           # file, theme, pexels_id, photographer, url
/data/tags.json             # output of tagging step (section 4.7)
/data/targets.json          # the 10 study target photos (section 4.8)
/scripts/download_pexels.py # download script
/scripts/tag_library.py     # Gemini tagging script
/wireframes/                # screens supplied by the owner
```

### 4.6 Download script (reference)

```python
import csv, os, time, requests

KEY = os.environ["PEXELS_API_KEY"]
THEMES = {
  "pool": "friends swimming pool",
  "beach": "family beach vacation",
  "birthday": "birthday party cake",
  "restaurant": "friends dinner restaurant",
  "festival": "family festival celebration",
  "hiking": "friends hiking mountain trip",
  "kids": "children playing park",
  "graduation": "graduation friends campus",
  "pets": "dog with owner",
  "roadtrip": "road trip friends car",
}
PER = 14
os.makedirs("library", exist_ok=True)
rows, seen = [], set()
for theme, q in THEMES.items():
    r = requests.get("https://api.pexels.com/v1/search",
                     headers={"Authorization": KEY},
                     params={"query": q, "per_page": PER}, timeout=30)
    r.raise_for_status()
    for i, p in enumerate(r.json()["photos"]):
        if p["id"] in seen:
            continue
        seen.add(p["id"])
        fn = f"{theme}_{i+1:02d}.jpg"
        with open(f"library/{fn}", "wb") as f:
            f.write(requests.get(p["src"]["large"], timeout=60).content)
        rows.append([fn, theme, p["id"], p["photographer"], p["url"]])
    time.sleep(1)
with open("library/credits.csv", "w", newline="") as f:
    csv.writer(f).writerows([["file","theme","pexels_id","photographer","url"]] + rows)
```

### 4.7 Tagging step (offline, once, Gemini vision)

- Run `scripts/tag_library.py` once. Output `data/tags.json`: `{ "<filename>": { ...tag object... } }`.
- Use a current **Gemini Flash** vision model (model name configurable via `GEMINI_MODEL`; verify the current name in Google AI Studio). Request JSON output (`response_mime_type = application/json`).
- **Run on 10 photos first**, review quality with the owner, then tag all.
- **Not called at runtime.** The deployed app reads `tags.json` only.

**Tagging prompt (`scripts/tag_prompt.txt`):**

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

**Tag quality checks (owner reviews before full run):**

| Check | Pass | If it fails |
|---|---|---|
| Occasion | Birthday photos say birthday with a real `occasion_basis` | Tighten the prompt |
| Look | `clothing` has colours, not just "swimwear" | Require a colour in every clothing item |
| Hallucination | Few invented details; `unknown` used when unsure | Add "if you cannot see it, say unknown" |

Add a script step that **normalises** values: lowercase, trim, map colours to a base set (`red, blue, green, yellow, orange, pink, purple, white, black, grey, brown, beige`), split `clothing` into `{colour, item}` pairs, and compute `people_bucket` = `1 | 2 | 3-5 | 6+`.

**Coverage:** compute `tag_coverage` = share of photos with a valid tag object. The coach's library-aware layer is enabled only if coverage ≥ **90%** (config `MIN_TAG_COVERAGE`).

### 4.8 Study target photos

- Owner picks **10 target photos**, each with something distinctive (a red swimsuit, a group of five, a cake on a table).
- Store in `data/targets.json`: `[{ "id": "T01", "file": "pool_03.jpg", "theme": "pool", "difficulty": "high-match-count" }, ...]`.
- Pair targets of comparable difficulty (same theme size) for Mode A vs Mode B tasks.
- The moderator console (S9) selects a target; the target view (S10) shows it for 5 seconds.

---

## 5. Search backend (stand-in for Google's search)

**Rule:** both modes call the **same** function `search(queryText) -> ranked results`. Any difference between modes must come from the **query**, not the search. In coach mode the final search uses **only the composed prompt text**, not hidden structured filters.

### 5.1 Scoring (lexical, deterministic, no AI)

1. **Normalise** the query: lowercase, strip punctuation, split to tokens.
2. Remove **stopwords** (a, an, the, of, with, at, in, on, and, my, me, i, we, our, photo, photos, picture, pictures, pic).
3. **Self-words** (`me, my, i, we, our`) are ignored for scoring (they are approximate person references, see section 6).
4. Apply a basic **stem/lemma** map and a small **synonym map** (config file `data/synonyms.json`), for example `pool -> swimming pool`, `kid -> child`, `bday -> birthday`, `friends -> friend`.
5. For each photo and each query token, add field weights if the token appears in that field:

| Field | Weight |
|---|---|
| `setting` | 3 |
| `one_line`, `activity`, `occasion_guess`, `objects`, `clothing` (colour and item) | 2 |
| `group_type`, `people_ages` | 1.5 |
| `mood`, `weather_or_season`, `text_in_image`, `time_of_day` | 1 |

6. Add a **multi-cue bonus**: +1 for each **distinct field** matched by the query (rewards photos that match several details).
7. A photo is a **match** if `score >= MIN_SCORE` (config, default `2`). Results sorted by score descending, ties by file name.
8. Return `{ results: [{id, score, matchedFields}], count }`.

### 5.2 Match-count buckets

- `few` ≤ 5, `some` 6 to 20, `many` > 20 (configurable). The coach uses `count >= COACH_MIN_MATCHES` (default **12**) as "too broad".

### 5.3 Optional upgrade (flag, default off)

`SEARCH_MODE=embeddings`: embed `one_line + fields` per photo once and compare to the query embedding. Not required for the MVP. Only add if lexical search clearly fails on natural-language prompts during testing.

---

## 6. Vague check (rule-based, free)

Runs on the **first typed text** (after debounce), before any chip is tapped. Output: `{ isVague, anchors: {person, time, location}, preciseCount }`.

A filter has a **precise anchor** when:

| Filter | Precise anchor if the text contains… | Approximation (not precise) |
|---|---|---|
| **Person** | A name from the app's People list (static list, may be empty in MVP) | "me", "my friend", "family", "someone", "kids" |
| **Time** | An exact date, or month + year, or a year (regex: `\b(19|20)\d{2}\b`, `\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b`, month names with year) | "last summer", "a few years ago", "when I was young", "around graduation" |
| **Location** | A specific named place from a place list (config `data/places.json`, e.g. cities, named venues) | "that café", "the beach", "a pool", "somewhere hot" |

- `isVague = preciseCount < 2`.
- In this MVP library there are no real dates or named people, so most queries will be vague. That is expected.
- Keep rules and lists in config. Do not hard-code inside UI components.
- **Classify on the first typed text only**, so chips cannot change who is measured.

---

## 7. Coach engine (the heart of the solution)

### 7.1 Trigger rules (all must be true)

1. Mode = B (coach).
2. Typed text has at least one real word of 3+ characters.
3. Pause of `COACH_DEBOUNCE_MS` (default **500**) since last keystroke.
4. `isVague === true` (section 6).
5. Preview `count >= COACH_MIN_MATCHES` (default **12**).
6. Candidate set size ≥ 4 (otherwise nothing to split; skip).
7. Show **once per query**. Do not re-open if the user dismissed it, unless the query changes by more than one word.
8. If the user submits before the preview returns, run plain search and do not show the coach.

If rule 5 fails or tag coverage is below `MIN_TAG_COVERAGE`, fall back to **generic questions** (7.4) only when the vague check passes and the user has typed ≥ 2 words; otherwise stay out of the way.

### 7.2 Question types (map to cue types)

| Cue type | Tag fields it can use | Question template |
|---|---|---|
| `who` | `group_type`, `people_bucket`, `people_ages` | "Who was with you?" |
| `occasion` | `occasion_guess` | "What was the occasion?" (soft guesses, e.g. "Birthday?") |
| `look` | `clothing` colours, `indoor_outdoor`, `weather_or_season` | "What did it look like?" / "Anyone wearing a bright colour?" |
| `what` | `activity`, `objects` | "What were people doing?" |
| `when` | `time_of_day`, `weather_or_season` (season) | "Roughly when?" (morning/afternoon/evening/season; library photos have no real dates) |
| `where` | `setting`, `indoor_outdoor` | "Indoors or outdoors?" |

### 7.3 Library-aware question selection (Layer 2)

Given the current **candidate set** (photos matching the query so far, plus answers tapped so far applied as filters for **preview only**):

1. For each candidate **field** (grouped by cue type), compute the distribution of values among candidates, ignoring `unknown`/`none`.
2. **Skip** a field if the query already contains a value from it (so we never ask what the user already said).
3. **Coverage** = share of candidates with a known value for the field. Skip if below **0.6**.
4. **Balance score** = coverage × normalised entropy of the top-4 value shares (a field that splits candidates evenly scores higher; a field where 95% share one value scores low).
5. Apply **cue-type weights** so memory-relevant fields win: `occasion 1.0, who 1.0, look 1.0, what 0.9, where 0.7, when 0.6` (config).
6. Pick the **top 3 questions with distinct cue types**. For each, offer up to **4 option chips** (top values by count) + **Something else** (free text) + **I don't remember**.
7. **Re-rank after every answer** (recompute candidates, drop answered cue types, pick the next best). All of this is in-memory, no AI call.
8. **Stop** showing new questions when candidates ≤ `COACH_STOP_AT` (default **8**) or the user presses Build/Search.

**Occasion options** are soft: label as a guess ("Birthday?") and include only values whose `occasion_basis` is not `none`.

### 7.4 Generic fallback questions (Layer 1)

If tags are missing/low-coverage or candidates are too few, show up to 3 of these (skip any already answered by the query), with free text and chips:

- **Who:** Just me / Family / Friends / Someone else
- **Occasion:** Birthday / Trip / Celebration / Nothing special / Not sure
- **Look:** Bright colours / Indoors / Outdoors / Not sure
- **When:** Morning / Daytime / Evening / Not sure

### 7.5 Controls inside the coach panel

- **Skip** on each question (counts as "I don't remember").
- **Not these:** clears all coach answers and returns to the user's original typed query (one tap).
- **Search anyway:** runs plain search with the original typed query immediately.
- **Build my search:** goes to the prompt composer (section 8).
- The user can type a **free-text answer** for any question.

### 7.6 Soft message (no raw number for users)

Show: *"Lots of photos match. Help us narrow it down."* Never show a numeric count to the participant. In **debug mode** (`?debug=1`) show the candidate count and the chosen split scores.

---

## 8. Prompt composer (editable prompt)

### 8.1 Behaviour

- Input: the user's **typed text** and the list of **answers** (`[{cueType, value, source: "chip"|"typed"}]`, skipped answers excluded).
- Output: a single natural-language prompt, plus a list of cues for logging: `{ prompt, cues: [{type, value}] }`.
- The user sees the prompt in an **editable text box** (S5) with the cue chips shown above it as removable tokens. Removing a chip removes its words from the prompt. Editing the box is allowed freely.
- **Rule:** keep the user's own words first; add only the chosen details; **never add a detail the user did not choose**.

### 8.2 Groq call

- Provider: Groq (OpenAI-compatible chat completions). Model name in `GROQ_MODEL` (default a current Llama 3.x instruct model; verify availability).
- Temperature low (`0.2`). Max tokens small (`120`). Timeout `3000 ms`.
- **Cache** responses by `hash(typed + sorted answers)`.

**System prompt:**

```
You turn a short photo-search query plus a few user-chosen details into ONE
short natural-language search prompt. Rules:
- Start from the user's own words. Keep them.
- Add ONLY the details provided in "answers". Never invent anything.
- Use the same words as the answers where possible (e.g. "red swimsuit").
- One sentence, under 25 words, no quotes, no explanations.
Return JSON only: {"prompt": "...", "cues": [{"type": "who|occasion|look|what|when|where", "value": "..."}]}
```

**User message (example):**

```
typed: "pool"
answers: [
  {"cueType":"who","value":"friends"},
  {"cueType":"look","value":"red swimsuit"},
  {"cueType":"look","value":"outdoors"}
]
```

**Expected output:** `{"prompt":"Me with friends at the pool in red swimsuits, outdoors","cues":[...]}`

### 8.3 Deterministic fallback (must exist)

If Groq fails, times out, or returns invalid JSON: build the prompt as `"<typed>, <answer1>, <answer2>, ..."` (join with commas, drop duplicates) and set cues from the answers. The user never sees an error. Log `composer = "fallback"`.

### 8.4 After composing

On **Search**, call `search(finalPromptText)`. Record the **typed text**, the **composed prompt**, the **final edited prompt**, and the **result counts** (see section 10).

---

## 9. Screens and UI

### 9.1 General UI rules

- **Mobile-first**, design width **390 px** (also usable on desktop in a centred 390-px-wide frame).
- Look and layout **similar to Google Photos**: light theme, white background, rounded search pill, 3-column photo grid with small gaps, a bottom navigation. Use a clean sans-serif font (Roboto or Inter). **Do not copy Google logos or trademarked assets.** Use a generic "Photos" wordmark.
- Footer note on the About screen: *"Prototype for a product-management case study. Not affiliated with Google. Photos from Pexels."*
- Minimum text size **14 px**. Good contrast. Tap targets ≥ 44 px.
- Every async action has a **loading state** and an **error state** that never dead-ends the user.

### 9.2 Screen list (owner will draw wireframes for each; file names in `/wireframes/`)

| ID | Screen | Wireframe file |
|---|---|---|
| S1 | Photos home (library grid) | `S01_home.png` |
| S2 | Search home (empty search) | `S02_search_empty.png` |
| S3 | Typing state (before coach appears) | `S03_typing.png` |
| S4 | Coach panel (questions + chips) | `S04_coach.png` |
| S5 | Prompt review (editable prompt) | `S05_prompt_review.png` |
| S6 | Results grid | `S06_results.png` |
| S7 | Photo viewer ("This is the photo" / "Not it") | `S07_viewer.png` |
| S8 | Zero-results state | `S08_zero_results.png` |
| S9 | Moderator console (study controls) | `S09_moderator.png` |
| S10 | Target reveal (5-second view) + "Now find it" | `S10_target.png` |
| S11 | Task end + 2 quick questions | `S11_task_end.png` |
| S12 | About and Credits | `S12_credits.png` |

If a wireframe is missing, build the screen from the descriptions below.

### 9.3 Screen descriptions

**S1 — Photos home.** Top app bar with generic wordmark and a search icon. Library grid (all ~100 photos, 3 columns, square thumbnails, sorted by file order). Bottom nav: **Photos** (active), **Search**, plus two inert placeholders (e.g. Collections, Library) that show "Not part of this prototype". Tapping a photo opens S7.

**S2 — Search home.** Search bar focused. Below it, static suggestion rows labelled **People**, **Places**, **Things** (placeholders, no real data; tapping shows a small "Not part of this test" toast). No coach yet.

**S3 — Typing.** Search bar with the typed query, a clear (×) button, live-updating (optional) suggestions area empty. In Mode A this is all the user ever sees before results.

**S4 — Coach panel (Mode B).** Appears as a card **under the search bar** (or bottom sheet, per wireframe) when the trigger rules in 7.1 pass.
- Header: *"Lots of photos match. Help us narrow it down."*
- Up to 3 question blocks: question text, 2 to 4 option chips (multi- or single-select per question: default single-select), **Something else** (opens an inline text input), **I don't remember** (greys the question).
- Chips show soft guesses for occasion ("Birthday?").
- Buttons: **Build my search** (primary), **Search anyway** (secondary text button), **Not these** (reset, small).
- Animation: panel slides in, subtle. Questions re-rank with a short fade after each answer.
- Accessibility: chips are real buttons with focus states and `aria-pressed`.

**S5 — Prompt review.** Title *"Here's your search. Change anything you like."* Shows cue chips (removable), the **editable text area** with the composed prompt, a **Search** button and a **Back** link to S4. A small label shows when the fallback composer was used (debug only).

**S6 — Results grid.** Search bar at the top shows the final query text. Grid of matching photos (3 columns), ranked by score. A pill under the bar: *"Edited search"* in coach mode. Debug mode shows result count and per-photo score. Tapping a photo opens S7. If zero results, show S8.

**S7 — Photo viewer.** Full-screen photo, back arrow, bottom bar with two buttons: **This is the photo** (logs success and ends the task) and **Not it** (logs a wrong open and returns to results). In normal browsing (outside a study task) show only the back arrow.

**S8 — Zero results.** Message *"No photos found."* In Mode A this is a plain dead end with a **Try again** button (reflects real behaviour). In Mode B also show **Back to my questions**.

**S9 — Moderator console** (`/moderator`, simple PIN `MODERATOR_PIN` from env). Fields: participant ID (anonymous like `P01`), mode (A/B/C), target photo (from `targets.json`), buttons **Start task**, **Show target**, **End task**. Shows task timer and live event log. Link to **Export CSV**.

**S10 — Target reveal.** Full-screen target photo with a **5-second** countdown, then the screen turns to *"Now find this photo from memory."* and opens S2 in the assigned mode. The target is **not visible again**. The 3-minute timer starts.

**S11 — Task end.** Shown after **This is the photo**, **Give up**, or timeout. Ask 2 quick questions (1 to 5 scale): *"How easy was it to find the photo?"* and *"How confident are you that you could describe it next time?"* plus an optional free-text comment. Then return to moderator console.

**S12 — About and Credits.** Purpose line, disclaimer, a list of photographers with links from `credits.csv`, and the Pexels licence note.

---

## 10. Study mode, events and logging

### 10.1 Session model

- `sessionId` per task; fields: `participantId`, `mode`, `targetId`, `taskStart`, `taskEnd`, `outcome` (`found | gave_up | timeout`).
- All study screens are reachable by URL (`/study?pid=P01&mode=B&target=T03`) in addition to the moderator console.
- **No login. No personal data.** Participant IDs are anonymous. Show a one-line consent notice on the moderator console (logs are stored for the case-study analysis only).

### 10.2 Event log (append-only)

Each event: `{ ts, sessionId, participantId, mode, type, payload }`.

| Event type | Payload |
|---|---|
| `task_start` | targetId |
| `target_shown` / `target_hidden` | duration ms |
| `query_typed` | text (debounced snapshots, final one before pause) |
| `vague_check` | `{isVague, anchors, preciseCount}` |
| `coach_triggered` | `{previewBucket, candidateCount, layer: "library"|"generic"}` |
| `coach_shown` | questions (ids, fields, options) |
| `chip_tapped` | `{questionId, cueType, value}` |
| `chip_skipped` | `{questionId}` ("I don't remember") |
| `coach_reset` | "Not these" |
| `prompt_composed` | `{typed, answers, prompt, composer: "groq"|"fallback", latencyMs}` |
| `prompt_edited` | `{before, after}` |
| `search_submitted` | `{queryText, isFirstQuery, resultCount, topIds}` |
| `photo_opened` | `{photoId, rank}` |
| `found` / `wrong_open` / `gave_up` / `timeout` | `{photoId?}` |
| `task_end` | `{outcome, seconds}` |
| `survey_answered` | `{easy, confidence, comment}` |

### 10.3 Derived metrics (build an admin page `/admin` with a table and `GET /api/admin/export.csv`)

Per session and per mode:

- **First query text** and **cue types in first query** (rule-based classifier using lexicons in `data/cue_lexicon.json`; same classifier for both modes; optionally double-check with Groq offline).
- **Query Formation Rate** = sessions with 2+ cue types in first submitted query ÷ vague sessions.
- **Results per first query.**
- **Time to find** (seconds).
- **Found or not.**
- Coach: trigger rate, skip rate, "I don't remember" rate, prompt edit rate, "Not these" rate, extra seconds before first submit, fallback composer rate.
- **Preview count after chips vs final search count** (log both, they can differ because the final search uses text only).

### 10.4 Persistence

- Events must **persist after deployment** and be **exportable as CSV**.
- Suggested: Next.js on Vercel + Supabase free tier (Postgres) for events, **or** a Node server on Render with SQLite on a persistent disk. Antigravity may choose, but must meet the persistence and export requirement.
- If the database is unreachable, queue events in `localStorage` and retry; never block the participant.

---

## 11. Technical specification

### 11.1 Suggested stack (Antigravity may change if it keeps the requirements)

- **Frontend + API:** Next.js (App Router) + TypeScript + Tailwind CSS.
- **Data:** `tags.json`, `targets.json`, `synonyms.json`, `places.json`, `cue_lexicon.json` loaded in memory on server start.
- **LLM:** Groq at runtime (composer only). Gemini only in the offline tagging script.
- **Hosting:** public URL, **no login**, HTTPS.

### 11.2 API contract

| Endpoint | Method | Body | Returns |
|---|---|---|---|
| `/api/photos` | GET | none | list of `{id, file, theme}` |
| `/api/search` | POST | `{query, sessionId, mode}` | `{results:[{id,score,matchedFields}], count, bucket}` |
| `/api/coach/analyze` | POST | `{query, sessionId}` | `{isVague, anchors, preciseCount, triggered, layer, bucket, questions:[Question]}` |
| `/api/coach/answer` | POST | `{query, answers, sessionId}` | `{bucket, questions:[Question]}` (re-ranked) |
| `/api/coach/compose` | POST | `{query, answers, sessionId}` | `{prompt, cues, composer}` |
| `/api/log` | POST | event object | `{ok:true}` |
| `/api/admin/export.csv` | GET (PIN) | none | CSV of events and derived metrics |

`Question` shape:

```json
{
  "id": "q_who",
  "cueType": "who",
  "field": "group_type",
  "text": "Who was with you?",
  "layer": "library",
  "options": [{"label":"Friends","value":"friends"},{"label":"Family","value":"family"}],
  "allowText": true,
  "allowDontRemember": true
}
```

### 11.3 Configuration (`config.ts`, no magic numbers elsewhere)

```
COACH_DEBOUNCE_MS=500
COACH_MIN_MATCHES=12
COACH_STOP_AT=8
MIN_TAG_COVERAGE=0.9
MIN_SCORE=2
MAX_QUESTIONS=3
MAX_OPTIONS=4
TASK_TIME_LIMIT_SEC=180
TARGET_SHOW_SEC=5
CUE_WEIGHTS={occasion:1.0, who:1.0, look:1.0, what:0.9, where:0.7, when:0.6}
```

### 11.4 Environment variables

```
PEXELS_API_KEY=      # download script only
GEMINI_API_KEY=      # tagging script only, never used at runtime
GEMINI_MODEL=        # current Flash vision model name (verify in AI Studio)
GROQ_API_KEY=        # runtime, server-side only
GROQ_MODEL=          # current Llama instruct model on Groq (verify)
MODERATOR_PIN=
DATABASE_URL=        # if using Postgres/Supabase
```

**All keys server-side only.** Never ship keys to the browser, never commit them. Provide `.env.example`.

### 11.5 Non-functional requirements

- Coach appears **within ~1 second** after the pause (preview is in-memory; no AI call).
- Prompt composer returns **within 3 seconds** or falls back.
- App usable on a mid-range phone browser over a normal connection (images ≤ ~300 KB each).
- No uncaught errors visible to participants; every failure has a graceful path.
- Cache Groq responses; add simple rate limiting on `/api/coach/compose`.

---

## 12. Task list for Antigravity (work in this order)

Today is **Thursday 1 October 2026**. Target dates are guides; **never cut testing time, cut polish.**

| # | Task | Done when | Target |
|---|---|---|---|
| 1 | Project scaffold, config, `.env.example`, README skeleton | App runs locally, shows blank S1 | Oct 1 |
| 2 | Library import: read `/public/library`, `credits.csv`, build S1 grid and S7 viewer | All photos display and open | Oct 1 |
| 3 | Tagging script + normalisation; run on 10 photos; **pause for owner review** | `tags.json` for 10 photos reviewed and approved | Oct 1–2 |
| 4 | Tag all ~100 photos; compute coverage | `tags.json` complete, coverage ≥ 90% | Oct 2 |
| 5 | Search backend (section 5), S2/S3/S6/S8, **Mode A fully working** | Typing `pool` returns ranked results | Oct 2 |
| 6 | Vague check (section 6) with unit tests | All acceptance cases in 13.1 pass | Oct 3 |
| 7 | Coach engine (section 7): trigger, question selection, re-rank, generic fallback, S4 | Coach appears for `pool`; chips narrow candidates | Oct 3 |
| 8 | Prompt composer (section 8) with Groq + fallback, S5 | Composed prompt editable and searchable | Oct 4 |
| 9 | Study mode (section 10): moderator console, target reveal, task end, event logging, CSV export, S9–S11 | One full test session logs end to end | Oct 4–5 |
| 10 | Deploy, test on a phone, credits page S12, README | Public link works without login | Oct 5 |
| 11 | **User testing window** (owner runs it) | ≥ 3 sessions logged | Oct 5–6 |
| 12 | Fix blockers only; freeze | Final deployed link | Oct 6 |

### Rules for the agent

- Do **not** call Gemini at runtime. Do **not** expose any API key to the client.
- Do **not** invent photos or tags. Tags come only from the Gemini tagging step.
- Do **not** use Pexels `alt` text as tags.
- Do **not** use hidden structured filters in the coach's final search. The final search uses the **prompt text only**.
- Keep all thresholds in `config.ts`.
- Write `README.md` with: how to run, env vars, how to re-tag, how to export data, deployed URL, **Assumptions made**, **Known limitations**.
- After task 3, **stop and wait for owner review** of the 10 tags before tagging everything.
- Prefer small commits and keep the app deployable at every checkpoint.

---

## 13. Acceptance criteria

### 13.1 Vague check and trigger

| Input (Mode B) | Expected |
|---|---|
| `pool` | Vague. Coach appears (library layer) if matches ≥ 12 |
| `me at the pool` | Vague. Coach appears |
| `silver racket` | Few matches. Coach does **not** appear |
| `12 March 2021 pool` (exact date + approximate place) | Not triggered unless the vague rule says so; verify `preciseCount` logic and document |
| `beach` typed and Enter pressed before 500 ms | Search runs, coach does not appear |
| Any query in Mode A | Coach never appears |

### 13.2 Coach behaviour

- After typing `pool`, up to **3 questions** with distinct cue types appear, each with ≤ 4 chips + Something else + I don't remember.
- A question is **not shown** if the typed query already contains a value from that field.
- Tapping a chip **re-ranks** remaining questions and updates the preview candidates without any network AI call.
- **Not these** restores the original typed query with no answers.
- **Search anyway** runs plain search with the original typed text.

### 13.3 Composer

- With answers `friends` + `red swimsuit` + `outdoors` and typed `pool`, the prompt **contains** all of them and **adds nothing else**.
- With the Groq key removed, the **fallback composer** still returns a prompt and the flow completes.
- Editing the prompt changes the text that is searched.

### 13.4 Study and logging

- A full session (moderator start → 5-second target → search → found) produces a complete event trail and an exportable CSV row with first query, cue-type count, results per first query, time to find, outcome.
- Mode A and Mode B produce **comparable rows**.
- The deployed link works without login and events persist after redeploy.

---

## 14. Out of scope for this MVP

- Real Google Photos data, accounts, uploads, backup, sync.
- Face recognition, People tab behaviour, pet recognition.
- Real date or GPS metadata (library photos have none; "when" uses time of day and season only).
- Improving ranking or building a production-grade search.
- A post-submit chips mode (Mode C) unless everything else is done.
- Privacy/consent flows beyond the study notice (these are covered in the deck's risks slide).

---

## 15. Known limitations and assumptions (must appear in the deck and README)

1. The search is a **stand-in**, not Google's. The test shows how the coach changes **what users type and how many results return**, not Google's real ranking.
2. The library is **~100 stock photos**, cleaner than real libraries, and tags are **cleaner than they would be in real life**.
3. The preview count is cheap here because the library is tiny. At Google scale this **assumes Photos has a cheap tag lookup** and that **scene details for old photos exist** (via a one-time background backfill). Both are assumptions to verify.
4. Scene details beyond basic labels (occasion, clothing, activity) are **inferred by AI** and can be wrong. Occasion is shown only as a soft guess.
5. Small sample (**3 to 5 participants**): results are directional, not proof.
6. If Ask Photos drops cues from multi-detail queries (reported in 85.6% of query-formulation reviews in our engine), a composed prompt could underperform. The study compares composed vs typed prompts to check this.
7. Privacy: the coach is meant only for users who already opted in to Gemini features in Photos, reuses scene details Photos already generates, adds no new data collection, and can be switched off. In this prototype only consented, stock photos are used.

---

## 16. Glossary

- **Cue types:** who, when, where, what, occasion, look.
- **Vague search:** lacks a precise anchor in at least 2 of Person, Time, Location, judged on the first typed text.
- **Candidate set:** photos currently matching the typed query plus tapped answers (preview only).
- **Library-aware chips:** questions and options chosen from the tags of the candidate set.
- **Query Formation Rate:** share of vague sessions whose first submitted query has 2+ cue types.
- **Vague Search Success Rate:** share of vague-search tasks that end with the target photo found.
