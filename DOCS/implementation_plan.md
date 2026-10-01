# IMPLEMENTATION_PLAN.md — Phase-wise Build Plan
## Pre-Search "Narrow It Down" Coach — Google Photos MVP

> **Deadline:** Wednesday, 7 October 2026, 3:59 PM IST  
> **Today:** Thursday, 1 October 2026  
> **Available days:** 6 days (Oct 1 → Oct 6, freeze on Oct 6 EOD)  
> **Rule:** Never cut testing time. Cut polish instead.

---

## Timeline at a Glance

```
Oct 1 (Thu) ── Phase 1: Scaffold + Data pipeline
Oct 2 (Fri) ── Phase 2: Search + Mode A (fully working)
Oct 3 (Sat) ── Phase 3: Vague check + Coach engine + Mode B core
Oct 4 (Sun) ── Phase 4: Prompt composer + Study mode + Logging
Oct 5 (Mon) ── Phase 5: Deploy + Credits + Full end-to-end test
Oct 5–6     ── Phase 6: User testing window (owner runs sessions)
Oct 6 (Tue) ── Phase 7: Freeze — fix blockers only, no new features
Oct 7 (Wed) ── DEADLINE: deployed link submitted by 3:59 PM IST
```

---

## Phase 1 — Scaffold, Config & Data Pipeline
**Date:** Oct 1 (Thursday)  
**Goal:** App runs locally. Photos display. Tags ready for owner review.

### 1.1 Project Scaffold

- [ ] `npx create-next-app@latest ./ --typescript --tailwind --app --src-dir --no-git`
- [ ] Install dependencies: `groq-sdk`, `@supabase/supabase-js` (or `better-sqlite3`)
- [ ] Create `.env.example` with all keys documented
- [ ] Create `src/lib/config.ts` — all thresholds, zero magic numbers elsewhere
- [ ] Create `src/types/index.ts` — `PhotoTag`, `Question`, `Answer`, `Event`, `StudyTarget`, `CueType`
- [ ] Create `README.md` skeleton (sections: Setup, Env vars, Scripts, Deployed URL, Assumptions)
- [ ] Set up Google Fonts (Roboto or Inter) in `layout.tsx`
- [ ] Set up Tailwind base styles (mobile-first, 390 px max-width container)

**Done when:** `npm run dev` shows a blank page at `localhost:3000` with no errors.

---

### 1.2 Pexels Download Script

- [ ] Write `scripts/download_pexels.py` (from spec section 4.6)
- [ ] Run script with `PEXELS_API_KEY` → downloads ~14 photos × 10 themes to `/public/library/`
- [ ] Manually review: remove blurry, off-theme, near-duplicate photos
- [ ] Cut to ~100 total, ensuring variety within each theme
- [ ] Verify `credits.csv` created correctly in `/data/`

**Done when:** ~100 images in `/public/library/`, `data/credits.csv` populated.

---

### 1.3 Gemini Tagging Script

- [ ] Write `scripts/tag_library.py`:
  - Reads all files from `/public/library/`
  - Calls Gemini Flash vision with `tag_prompt.txt`
  - Outputs raw tags to `data/tags_raw.json`
- [ ] Write `scripts/tag_prompt.txt` (from spec section 4.7)
- [ ] Write normalisation step in `tag_library.py`:
  - Lowercase + trim all strings
  - Map colours to base palette
  - Split `clothing` into `{colour, item}` pairs
  - Compute `people_bucket`
  - Compute `tag_coverage`
- [ ] **Run on 10 photos first** → output `data/tags_sample.json`
- [ ] **STOP — wait for owner review of tags_sample.json**

**Done when:** `tags_sample.json` ready for Tharun's review.  
**Owner action:** Review 10 tags, approve or request prompt changes.

---

### 1.4 Photos Home Screen (S1)

- [ ] `GET /api/photos` route — reads `/public/library/` file list + `tags.json` (or just filenames if tags not ready)
- [ ] `src/app/page.tsx` — renders `<PhotoGrid>` with all ~100 photos
- [ ] `PhotoGrid.tsx` — 3-column CSS grid, square thumbnails, 2 px gaps
- [ ] `PhotoCard.tsx` — image with `onError` grey placeholder, tap → `/photo/[id]`
- [ ] `BottomNav.tsx` — Photos (active), Search, two inert placeholders with "Not part of this prototype" toast
- [ ] Top app bar — generic "Photos" wordmark + search icon

**Done when:** All photos display in a 3-column grid, tapping one navigates to `/photo/[id]` (viewer page, can be blank for now).

---

### Phase 1 Checkpoint ✅

| Check | Pass condition |
|---|---|
| `npm run dev` runs clean | No TypeScript errors |
| ~100 photos visible at `localhost:3000` | Grid renders |
| `data/credits.csv` populated | All photos credited |
| `data/tags_sample.json` exists | 10 photos tagged |
| Owner has reviewed tags | Approved or changes requested |

---

## Phase 2 — Search Backend + Mode A (Fully Working)
**Date:** Oct 2 (Friday)  
**Prerequisite:** Owner has approved the 10 sample tags.

### 2.0 Complete Tagging

- [ ] Run `tag_library.py` on all ~100 photos
- [ ] Verify `tag_coverage >= 90%` in script output
- [ ] Commit `data/tags.json`

---

### 2.1 In-Memory Data Loader

- [ ] `src/lib/dataLoader.ts`:
  - Loads `tags.json`, `targets.json` (placeholder for now), `synonyms.json`, `places.json`, `cue_lexicon.json` at server start
  - Exports a singleton `DataStore`
  - Returns typed `PhotoMeta[]` derived from tags

- [ ] Create placeholder config files:
  - `data/synonyms.json` — `{ "pool": "swimming pool", "kid": "child", "bday": "birthday", "friends": "friend", "beach": "seaside" }`
  - `data/places.json` — `{ "namedPlaces": [], "people": [] }` (minimal for MVP)
  - `data/cue_lexicon.json` — word lists per cue type

---

### 2.2 Lexical Search Engine

- [ ] `src/lib/search.ts`:
  - `normalise(query)` — lowercase, strip punctuation, remove stopwords
  - `applySynonyms(tokens, synonyms)` — expand via synonyms.json
  - `scorePhoto(photo, tokens)` — weighted field matching + multi-cue bonus
  - `search(query) → { results, count, bucket }` — full pipeline
- [ ] Unit tests for `search.ts`:
  - `"pool"` returns all pool photos
  - `"red swimsuit"` scores pool_03 higher than pool_01
  - `"silver racket"` returns ≤ 5 results (bucket: "few")
  - Synonym: `"kid"` matches `children playing park` photos

---

### 2.3 `POST /api/search` Route

- [ ] `src/app/api/search/route.ts`
- [ ] Validates request body
- [ ] Calls `search(query)`
- [ ] Logs `search_submitted` event (fire-and-forget)
- [ ] Returns `{ results, count, bucket }`

---

### 2.4 Search Screens (S2, S3, S6, S8)

- [ ] `src/app/search/page.tsx`:
  - S2 state: empty search bar focused, static People/Places/Things placeholders
  - S3 state: typed query, "×" clear button, Enter or Search button triggers search
  - Mode read from query param `?mode=A` or `?mode=B`
  - Debounce 500ms on input (fires vague check in Mode B — stubbed for now)
- [ ] `SearchBar.tsx` — rounded pill input, focused state, clear button
- [ ] `src/app/results/page.tsx`:
  - S6: results grid (3-column, same PhotoGrid component)
  - Query shown in search bar at top
  - "Edited search" pill if Mode B (placeholder for now)
  - Debug mode (`?debug=1`): shows score per photo
- [ ] S8: zero-results state — "No photos found." + "Try again" button
- [ ] `src/app/photo/[id]/page.tsx` — S7 viewer: full-screen photo, back arrow, "This is the photo" + "Not it" buttons (hidden in normal browsing mode)

---

### Phase 2 Checkpoint ✅

| Check | Pass condition |
|---|---|
| Type `pool` → Search → results grid | 10+ pool photos returned |
| Type `silver racket` → results | ≤ 5 results (few bucket) |
| Zero results → S8 | "No photos found" shown, "Try again" works |
| Photo tap → S7 viewer | Full photo visible, back arrow works |
| Mode A end-to-end | No coach ever appears |

---

## Phase 3 — Vague Check + Coach Engine + Mode B Core
**Date:** Oct 3 (Saturday)  
**Goal:** Coach appears for `pool`, chips narrow candidates, Mode B fully interactive.

### 3.1 Vague Check

- [ ] `src/lib/vagueCheck.ts`:
  - `checkPersonAnchor(query, people)` — name from places.json people list
  - `checkTimeAnchor(query)` — regex for exact date / month+year / 4-digit year
  - `checkLocationAnchor(query, places)` — named place match
  - `vagueCheck(query) → { isVague, anchors, preciseCount }`
- [ ] Unit tests for all spec acceptance cases (section 13.1):
  - `"pool"` → vague
  - `"me at the pool"` → vague
  - `"silver racket"` → not triggered (few matches)
  - `"12 March 2021 pool"` → document preciseCount logic in README
  - `"beach"` submitted before 500ms → coach does not appear
  - Any query in Mode A → coach never appears

---

### 3.2 Coach Engine

- [ ] `src/lib/coachEngine.ts`:
  - `filterCandidates(photos, answers)` — apply tapped answers as in-memory filter
  - `computeFieldDistribution(candidates, field)` — value counts, ignore unknown/none
  - `computeBalanceScore(distribution, cueWeight)` — coverage × normalised entropy × weight
  - `selectQuestions(candidates, query, priorAnswers) → Question[]` — top 3, distinct cue types
  - `genericFallbackQuestions(query, priorAnswers) → Question[]` — Layer 1 hardcoded
- [ ] Coach trigger rules (`coachEngine.shouldTrigger`):
  - Mode = B
  - Query has ≥1 real word (3+ chars)
  - After 500ms debounce
  - `isVague === true`
  - Preview `count >= COACH_MIN_MATCHES` (12)
  - Candidate set ≥ 4
  - Show once per query (dismiss lock)
- [ ] Unit tests: balance score correctness, cue-type deduplication, generic fallback trigger

---

### 3.3 Coach API Routes

- [ ] `POST /api/coach/analyze`:
  - Runs `vagueCheck` + `search` preview + `coachEngine.selectQuestions`
  - Logs `vague_check` and `coach_triggered` / `coach_shown` events
  - Returns full `{ isVague, anchors, triggered, layer, bucket, questions }`
- [ ] `POST /api/coach/answer`:
  - Applies current answers as candidate filter
  - Re-runs `coachEngine.selectQuestions` on filtered set
  - Logs `chip_tapped` event
  - Returns `{ bucket, questions }`

---

### 3.4 Coach Panel UI (S4)

- [ ] Wire `useCoach.ts` hook:
  - State machine: `IDLE → DEBOUNCING → COACH_VISIBLE → COMPOSING → PROMPT_REVIEW`
  - Calls `/api/coach/analyze` after debounce
  - Calls `/api/coach/answer` after each chip tap
  - Manages answers array
- [ ] `CoachPanel.tsx`:
  - Slide-in animation (CSS `transform: translateY`)
  - Header: "Lots of photos match. Help us narrow it down."
  - Up to 3 `QuestionBlock` components
  - Buttons: "Build my search" (primary), "Search anyway" (secondary), "Not these" (reset)
- [ ] `QuestionBlock.tsx`:
  - Question text
  - Chip grid (up to 4 chips + "Something else" + "I don't remember")
  - "Something else" → inline `<input>` appears
  - "I don't remember" → greys out question, logs `chip_skipped`
  - Questions re-rank with short fade after answer
- [ ] `ChipOption.tsx`:
  - `<button>` with `aria-pressed`
  - Active/selected visual state
  - Occasion chips labelled with "?" suffix (soft guess)
- [ ] Debug mode (`?debug=1`): show candidate count + balance scores

---

### Phase 3 Checkpoint ✅

| Check | Pass condition |
|---|---|
| Type `pool` in Mode B | Coach panel slides in with ≤3 questions |
| Chip tap | Candidates reduce, questions re-rank (no AI call) |
| "Not these" | All answers cleared, original query shown |
| "Search anyway" | Plain search with typed text, coach does not reopen |
| `silver racket` Mode B | Coach does NOT appear |
| Any query Mode A | Coach NEVER appears |
| A question already answered in query | That question NOT shown |

---

## Phase 4 — Prompt Composer + Study Mode + Event Logging
**Date:** Oct 4 (Sunday)  
**Goal:** Full B flow with editable prompt. Full study session logs end-to-end.

### 4.1 Prompt Composer

- [ ] `src/lib/promptComposer.ts`:
  - `hashRequest(query, answers)` — stable hash for cache key
  - `callGroq(query, answers)` — Groq API call with system + user prompt from spec 8.2
  - `deterministicFallback(query, answers)` — comma-join, no duplicates
  - `compose(query, answers) → { prompt, cues, composer }` — cache → Groq → fallback
- [ ] `POST /api/coach/compose` route:
  - Calls `promptComposer.compose`
  - Simple rate limiter (e.g. 10 req/min per IP)
  - Logs `prompt_composed` event
  - Returns `{ prompt, cues, composer }`
- [ ] Unit tests:
  - `pool` + `[friends, red swimsuit, outdoors]` → prompt contains all three, adds nothing else
  - Groq key removed → fallback still returns valid prompt, flow completes

---

### 4.2 Prompt Review UI (S5)

- [ ] `PromptReview.tsx`:
  - Title: "Here's your search. Change anything you like."
  - Removable cue chips above editable `<textarea>`
  - Removing a chip triggers prompt recomposition (client-side, deterministic only)
  - "Search" button → fires `/api/search` with textarea content
  - "Back" link → returns to coach panel (S4)
  - Debug: small label shows `composer: "groq"` or `"fallback"`
- [ ] `prompt_edited` event fired when textarea content differs from composed prompt

---

### 4.3 Database Setup

- [ ] `src/db/schema.sql` — events table DDL
- [ ] `src/db/client.ts` — Supabase or SQLite connection singleton
- [ ] Run migrations locally, verify insert/select works

---

### 4.4 Event Logger

- [ ] `src/lib/eventLogger.ts` (server-side):
  - `writeEvent(event)` — DB insert, never throws
- [ ] `POST /api/log` route:
  - Validates event shape loosely
  - Calls `writeEvent`
  - Always returns `{ ok: true }`
- [ ] Client-side `logEvent(event)` utility:
  - POSTs to `/api/log`
  - On failure: pushes to `localStorage` queue
  - On next success: flushes queue

---

### 4.5 Study Mode Screens

- [ ] `src/app/moderator/page.tsx` (S9):
  - PIN check (`MODERATOR_PIN` validated server-side on form submit)
  - Fields: participant ID, mode (A/B), target photo dropdown (from `targets.json`)
  - Buttons: "Start task", "Show target", "End task"
  - Live task timer display
  - Live event log tail (last 5 events)
  - "Export CSV" link → `/api/admin/export.csv`
- [ ] `src/app/study/page.tsx` (S10 + S11):
  - S10 — Target reveal: full-screen photo, 5-second countdown, then "Now find this photo from memory." → redirects to `/search?mode=B&session=...`
  - 3-minute timer starts on redirect
  - S11 — Task end: appears on found/give-up/timeout. Two 1–5 scale questions + optional comment. "Done" → back to `/moderator`
- [ ] Wire timeout: when 3 min expires → show S11 with `outcome: "timeout"`
- [ ] `data/targets.json` — owner populates with 10 target files
- [ ] One-line consent notice on moderator console

---

### 4.6 Admin / Metrics

- [ ] `src/lib/metrics.ts` — compute all derived metrics from events array (section 10.3)
- [ ] `src/app/admin/page.tsx` — table of sessions with metrics per row, PIN protected
- [ ] `GET /api/admin/export.csv` — reads events from DB, runs `metrics.ts`, returns CSV

---

### Phase 4 Checkpoint ✅

| Check | Pass condition |
|---|---|
| "Build my search" → S5 | Composed prompt shown in editable textarea |
| Removing a cue chip | Prompt updates, removed cue absent |
| Editing textarea → Search | Edited text is what's searched |
| GROQ key removed | Fallback prompt, no error shown |
| Moderator console | Target photo selectable, "Start task" works |
| 5-second target reveal | Photo shown then hidden, search opens |
| Full session | Events in DB: task_start → … → task_end |
| Export CSV | Downloads file with correct columns |

---

## Phase 5 — Deploy + Credits + End-to-End Polish
**Date:** Oct 5 (Monday)  
**Goal:** Public link works without login, tested on a real phone.

### 5.1 Deployment

- [ ] Push to GitHub (private repo)
- [ ] Connect to Vercel
- [ ] Set all env vars in Vercel dashboard:
  - `GROQ_API_KEY`, `GROQ_MODEL`
  - `MODERATOR_PIN`
  - `DATABASE_URL` (Supabase connection string)
- [ ] Deploy and verify `https://<app>.vercel.app` loads
- [ ] Run database migrations on Supabase (or Render)
- [ ] Verify: no `PEXELS_API_KEY` or `GEMINI_API_KEY` in Vercel (offline only)

### 5.2 About & Credits (S12)

- [ ] `src/app/about/page.tsx`:
  - Purpose: "Prototype for a product-management case study. Not affiliated with Google. Photos from Pexels."
  - Photographer credits table from `credits.csv` with Pexels URL links
  - Pexels licence note
  - Current licence URL: https://www.pexels.com/license/

### 5.3 README Completion

- [ ] How to run locally
- [ ] All env vars explained
- [ ] How to re-tag photos (re-run `tag_library.py`)
- [ ] How to export event data (CSV endpoint)
- [ ] Deployed URL
- [ ] **Assumptions made** section
- [ ] **Known limitations** section (from spec section 15)

### 5.4 End-to-End Testing (real phone)

- [ ] Mode A: type `pool` → results → tap photo → "This is the photo" → S11 → back to moderator
- [ ] Mode B: type `pool` → coach → tap chips → "Build my search" → S5 → Search → results → "This is the photo"
- [ ] "Not these" resets correctly
- [ ] "Search anyway" skips coach
- [ ] "I don't remember" on all questions → still can "Build my search"
- [ ] Zero results → S8 → retry works
- [ ] 3-minute timeout → S11 shown
- [ ] Disconnect internet mid-session → events queue in localStorage, flush on reconnect
- [ ] CSV export from `/admin` has complete rows for both modes

### 5.5 Accessibility Pass

- [ ] All chips have `aria-pressed`
- [ ] All interactive elements focusable
- [ ] Minimum contrast ratio 4.5:1
- [ ] Tap targets ≥ 44 px
- [ ] Minimum text 14 px

---

### Phase 5 Checkpoint ✅

| Check | Pass condition |
|---|---|
| Public URL loads | No login required |
| Mode A full session | Logged in DB, CSV row correct |
| Mode B full session | Logged in DB, CSV row correct |
| Phone test (Chrome Android) | Layout correct at 390px, coach usable |
| S12 credits | All photographers listed with links |
| README complete | All sections filled |

---

## Phase 6 — User Testing Window
**Dates:** Oct 5 (evening) – Oct 6 (Monday)  
**Owner (Tharun) runs sessions. Antigravity on standby for blockers.**

### Protocol

- At least **3 participants**, target 5, from the segment (Google Photos users with vague memory recall)
- Each participant: **2 tasks** — one Mode A, one Mode B
- **Counterbalance order** (P01: A then B; P02: B then A; etc.) and use different target photos of comparable difficulty
- Task: moderator shows target photo 5 seconds, participant finds from memory, 3-minute limit
- Moderator console at `/moderator` (PIN protected)
- After session: export CSV, spot-check event trail

### Blockers to watch for

| Symptom | Likely cause |
|---|---|
| Coach does not appear for `pool` | `COACH_MIN_MATCHES` or tag coverage issue |
| Coach appears for precise queries | Vague check bug |
| Groq compose times out frequently | Increase `GROQ_TIMEOUT_MS` or check model availability |
| Events missing in CSV | DB connection drop; check localStorage queue |
| Photos too slow to load | Vercel CDN caching issue |

---

## Phase 7 — Freeze (Fix Blockers Only)
**Date:** Oct 6 (Tuesday)  
**Rule:** No new features. No visual polish. Fix only what breaks a study session.

### Blocker criteria (fix these)

- App crashes or shows uncaught error to participant
- Events not logged (CSV will be unusable)
- Coach never appears (Mode B indistinguishable from A)
- "Build my search" flow broken
- Moderator console unusable

### Non-blocker (do NOT fix now)

- Visual imperfections
- Minor layout shifts
- Admin table formatting
- Edge-case vague check accuracy

### Final checks before deadline

- [ ] Deployed link works
- [ ] All planned test sessions completed
- [ ] CSV exported and saved offline
- [ ] README has deployed URL
- [ ] No API keys in git history

---

## Dependency Tree

```
Phase 1 (Scaffold + Data)
  └── Phase 2 (Search + Mode A)
        ├── Phase 3 (Vague check + Coach engine)     ← needs tags.json
        │     └── Phase 4a (Prompt composer)
        │           └── Phase 4b (Study mode + Logging)
        │                 └── Phase 5 (Deploy + E2E)
        └── Phase 4b can start in parallel with Phase 3
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Gemini tags low quality | Medium | High | Review 10 tags with owner (Phase 1 gate). Adjust prompt. |
| Groq model unavailable | Low | Medium | Config `GROQ_MODEL` is swappable; fallback always works |
| Tag coverage < 90% | Low | Medium | More photos can be downloaded; or lower threshold to 80% with note |
| Supabase connection drops | Low | Low | localStorage queue ensures no data loss |
| Deadline slip (< 3 sessions) | Medium | High | Start user testing Oct 5 morning, not evening |
| Coach re-ranking feels slow | Low | Low | All in-memory; no AI call — should be < 100ms |
| Phone layout issues | Medium | Medium | Test on real device after every phase |

---

## Config Files to Create (before Phase 2)

### `data/synonyms.json`
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
  "cat": "pet",
  "outdoor": "outdoors",
  "outside": "outdoors",
  "inside": "indoor"
}
```

### `data/places.json`
```json
{
  "namedPlaces": [],
  "people": []
}
```
*(MVP: empty lists — means most queries will be vague, which is expected)*

### `data/cue_lexicon.json`
```json
{
  "who":      ["friend", "friends", "family", "me", "us", "kids", "child", "couple", "group", "alone", "solo"],
  "when":     ["morning", "afternoon", "evening", "night", "summer", "winter", "spring", "autumn", "fall", "sunset", "sunrise"],
  "where":    ["pool", "beach", "restaurant", "park", "mountain", "home", "office", "stadium", "café", "cafe", "outdoor", "indoor"],
  "what":     ["swimming", "eating", "hiking", "dancing", "running", "playing", "drinking", "celebrating"],
  "occasion": ["birthday", "graduation", "wedding", "festival", "party", "celebration", "trip", "holiday", "vacation"],
  "look":     ["red", "blue", "green", "yellow", "orange", "pink", "purple", "white", "black", "grey", "brown", "bright", "dark", "colourful", "sunny", "rainy", "snowy"]
}
```

---

## Done Definitions Summary

| Phase | Done when |
|---|---|
| 1 | App runs. ~100 photos in grid. 10 tags reviewed by owner. |
| 2 | `pool` returns ranked results in Mode A. Zero results shows S8. |
| 3 | Coach appears for `pool` in Mode B. Chips narrow candidates. Re-rank works. |
| 4 | Full B flow: coach → compose → editable prompt → search. One full study session logged. |
| 5 | Public deployed link, phone-tested, credits page, README complete. |
| 6 | ≥ 3 study sessions logged with correct CSV rows. |
| 7 | Final deployed link. No blockers. Frozen. |

---

*End of IMPLEMENTATION_PLAN.md*
