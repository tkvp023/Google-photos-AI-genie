# EVALS.md — Evaluation Framework
## Pre-Search "Narrow It Down" Coach — Google Photos MVP

> **Purpose:** Every module has a clear pass/fail definition. Run these before merging any phase. If a check fails, do not proceed to the next phase.
> **Owner:** Antigravity (runs automated), Tharun (runs manual/study evals).

---

## Table of Contents

1. [Module Unit Evals](#1-module-unit-evals)
2. [API Integration Evals](#2-api-integration-evals)
3. [UI / Screen Evals](#3-ui--screen-evals)
4. [Study Mode Evals](#4-study-mode-evals)
5. [Performance Evals](#5-performance-evals)
6. [Logging & Metrics Evals](#6-logging--metrics-evals)
7. [Accessibility Evals](#7-accessibility-evals)
8. [Deployment Evals](#8-deployment-evals)
9. [Study Outcome Evals (post-session)](#9-study-outcome-evals-post-session)
10. [Eval Scorecard](#10-eval-scorecard)

---

## 1. Module Unit Evals

### 1.1 `lib/vagueCheck.ts`

Run: `npx jest vagueCheck`

| Test ID | Input | Expected `isVague` | Expected `preciseCount` | Notes |
|---|---|---|---|---|
| VC-01 | `"pool"` | `true` | `0` | No anchors at all |
| VC-02 | `"me at the pool"` | `true` | `0` | "me" is approximation, not precise person anchor |
| VC-03 | `"silver racket"` | `true` | `0` | Vague but few matches — coach doesn't trigger (that's coach rule, not vague check) |
| VC-04 | `"12 March 2021 pool"` | `false` | `2` | Exact date (time anchor) + named place? Document this result in README |
| VC-05 | `"beach"` | `true` | `0` | Single-word vague |
| VC-06 | `"birthday party"` | `true` | `0` | Occasion but no anchor |
| VC-07 | `"2023 pool"` | `false` | `1` | Year counts as time anchor; still vague (preciseCount < 2) |
| VC-08 | `""` (empty) | `true` | `0` | Empty string is vague |
| VC-09 | `"pool me friends"` | `true` | `0` | "me", "friends" are approximations |
| VC-10 | `"january 2022 beach"` | `false` | `1` | month+year = time anchor; still vague |

**Pass condition:** All 10 tests match expected output.

---

### 1.2 `lib/search.ts`

Run: `npx jest search`

| Test ID | Query | Expected behaviour | Pass condition |
|---|---|---|---|
| SR-01 | `"pool"` | Returns all pool-themed photos | count ≥ 8 |
| SR-02 | `"red swimsuit"` | Pool photos with red swimsuit rank highest | `pool_03` (or equivalent) in top 3 |
| SR-03 | `"silver racket"` | Very few results | count ≤ 3 (bucket: "few") |
| SR-04 | `"birthday cake"` | Birthday-themed photos | birthday photos in top results |
| SR-05 | `"friends hiking mountain"` | Multi-token matches score higher | hiking photos with friends rank above solo hiking |
| SR-06 | `"kid"` (synonym → child) | Synonym expansion works | kids-themed photos appear |
| SR-07 | `"bday"` (synonym → birthday) | `birthday_01.jpg` in results | Birthday photos appear |
| SR-08 | `"the at a on"` (stopwords only) | No results or zero score | count = 0 |
| SR-09 | `"outdoor sunny friends pool"` | Multi-cue bonus applies | top results have score > single-cue |
| SR-10 | `""` (empty) | Zero results | count = 0 |
| SR-11 | Multi-cue bonus check | `"red swimsuit outdoor friends pool"` | score > `"pool"` alone for same photo |
| SR-12 | Bucket: few | count ≤ 5 → bucket = "few" | Bucket correct |
| SR-13 | Bucket: some | 6 ≤ count ≤ 20 → bucket = "some" | Bucket correct |
| SR-14 | Bucket: many | count > 20 → bucket = "many" | Bucket correct |

**Pass condition:** All 14 tests pass.

---

### 1.3 `lib/coachEngine.ts`

Run: `npx jest coachEngine`

| Test ID | Scenario | Expected |
|---|---|---|
| CE-01 | `selectQuestions` on pool candidates | Returns ≤ 3 questions with distinct cue types |
| CE-02 | Query already contains "friends" | `who` question NOT in returned questions |
| CE-03 | Query already contains "outdoor" | `where` or `look` question that asks indoor/outdoor NOT shown |
| CE-04 | Field coverage < 0.6 | That field skipped |
| CE-05 | Candidates < 4 | Generic fallback questions returned |
| CE-06 | All 3 questions answered | `selectQuestions` returns empty array |
| CE-07 | Balance score: even split | Higher score than lopsided split |
| CE-08 | Balance score: 100% one value | Score ≈ 0 (nothing to split on) |
| CE-09 | Re-rank after chip tap | Previously lowest-ranked question may become top after filter |
| CE-10 | Occasion option | Labelled with "?" suffix (soft guess) |
| CE-11 | tag_coverage < MIN_TAG_COVERAGE | Layer 1 generic questions returned (not library-aware) |
| CE-12 | `COACH_STOP_AT` candidates reached | `selectQuestions` returns empty |

**Pass condition:** All 12 tests pass.

---

### 1.4 `lib/promptComposer.ts`

Run: `npx jest promptComposer`

| Test ID | Input | Expected |
|---|---|---|
| PC-01 | `typed: "pool"`, `answers: [{who, friends}, {look, red swimsuit}, {where, outdoors}]` | Prompt contains "pool", "friends", "red swimsuit", "outdoors" |
| PC-02 | Same as PC-01, Groq disabled | Fallback: `"pool, friends, red swimsuit, outdoors"` — flow completes |
| PC-03 | Groq returns invalid JSON | Fallback used, `composer: "fallback"` in response |
| PC-04 | Groq times out (> 3000ms) | Fallback used within 3100ms total |
| PC-05 | Same request twice | Cache hit on second call, no Groq call |
| PC-06 | Empty answers array | Prompt = typed text only |
| PC-07 | Answer with `source: "typed"` | Included in prompt |
| PC-08 | Duplicate values in answers | De-duplicated in composed prompt |
| PC-09 | Groq adds invented detail | Fail — prompt must contain ONLY typed + answer values |
| PC-10 | `answers` with skipped questions | Skipped (dontRemember) answers NOT in prompt |

**Pass condition:** PC-01 through PC-08, PC-10 pass. PC-09: review Groq output manually on 5 samples.

---

### 1.5 `lib/metrics.ts`

Run: `npx jest metrics`

| Test ID | Event array input | Expected output |
|---|---|---|
| MT-01 | Session with `search_submitted {isFirstQuery: true, resultCount: 18}` | `results_per_first_query = 18` |
| MT-02 | Session `task_start` at T=0, `found` at T=45s | `time_to_find = 45` |
| MT-03 | Session `task_end {outcome: "timeout"}` | `found = false` |
| MT-04 | First query = "pool friends red swimsuit" | Cue classifier returns `["who", "look"]` → `cue_count = 2` |
| MT-05 | First query = "pool" | `cue_count = 1` (only `where`) |
| MT-06 | Mode B, 5 sessions, 3 with 2+ cues | `query_formation_rate = 0.6` |
| MT-07 | Session with `prompt_edited` event | `prompt_edit_rate` counts this session |
| MT-08 | Session with no `coach_triggered` event | Not counted in coach trigger rate |

**Pass condition:** All 8 tests pass.

---

## 2. API Integration Evals

Run against local dev server (`npm run dev`). Use a REST client (curl / Postman / httpie).

### 2.1 `GET /api/photos`

| Test ID | Action | Expected |
|---|---|---|
| AP-01 | `GET /api/photos` | 200, JSON array of ~100 photo objects |
| AP-02 | Each photo has `id`, `file`, `theme`, `src` | All fields present, no nulls |
| AP-03 | `src` field resolves to a real image | `GET <src>` returns 200 with image/jpeg |

---

### 2.2 `POST /api/search`

| Test ID | Body | Expected |
|---|---|---|
| AS-01 | `{query: "pool", mode: "A"}` | 200, results array, count ≥ 8 |
| AS-02 | `{query: "silver racket", mode: "A"}` | bucket = "few", count ≤ 3 |
| AS-03 | `{query: "", mode: "A"}` | 200, count = 0 |
| AS-04 | Missing `query` field | 400 with error message |
| AS-05 | Mode B search with composed prompt | Same result format as Mode A |

---

### 2.3 `POST /api/coach/analyze`

| Test ID | Body | Expected |
|---|---|---|
| AC-01 | `{query: "pool"}` | `isVague: true, triggered: true, questions` array length ≤ 3 |
| AC-02 | `{query: "silver racket"}` | `triggered: false` (few matches) |
| AC-03 | `{query: "me pool friends outdoor"}` | Coach triggered; "who" question absent (friends in query) |
| AC-04 | Mode A context | Never called — coach should not be triggered by frontend |
| AC-05 | `{query: "pool"}` in Mode B | `layer: "library"` if coverage ≥ 90% |

---

### 2.4 `POST /api/coach/answer`

| Test ID | Body | Expected |
|---|---|---|
| AA-01 | `{query: "pool", answers: [{cueType: "who", value: "friends"}]}` | Updated questions, answered cue type absent |
| AA-02 | `{query: "pool", answers: [{cueType: "who", value: "friends"}, {cueType: "look", value: "red swimsuit"}]}` | Candidates reduced, ≤ 2 questions remaining |
| AA-03 | All cue types answered | `questions: []` |
| AA-04 | "I don't remember" on a question | That question skipped, cue type may still appear if another field covers it |

---

### 2.5 `POST /api/coach/compose`

| Test ID | Body | Expected |
|---|---|---|
| ACP-01 | `{query: "pool", answers: [{cueType:"who", value:"friends"}, {cueType:"look", value:"red swimsuit"}]}` | `prompt` contains "pool", "friends", "red swimsuit" |
| ACP-02 | Same as ACP-01 (second call) | Cache hit, faster response |
| ACP-03 | Invalid `GROQ_API_KEY` set | `composer: "fallback"`, valid prompt returned |
| ACP-04 | `answers: []` | Prompt = typed text only |

---

### 2.6 `POST /api/log`

| Test ID | Body | Expected |
|---|---|---|
| AL-01 | Valid event object | 200, `{ok: true}` |
| AL-02 | Missing fields | Still returns `{ok: true}` (never blocks user) |
| AL-03 | DB offline | Returns `{ok: true}`, event not lost (client queues in localStorage) |

---

### 2.7 `GET /api/admin/export.csv`

| Test ID | Action | Expected |
|---|---|---|
| AE-01 | Valid PIN in Authorization header | 200, valid CSV with headers |
| AE-02 | Wrong PIN | 401 |
| AE-03 | No PIN | 401 |
| AE-04 | CSV has one row per session | Row count matches session count |
| AE-05 | CSV columns | `session_id, participant_id, mode, first_query, cue_count, results_per_first_query, time_to_find, outcome, coach_triggered, prompt_edited` all present |

---

## 3. UI / Screen Evals

Manual test. Run in Chrome at 390px width, then on a real Android phone.

### 3.1 S1 — Photos Home

| Test ID | Action | Expected |
|---|---|---|
| UI-S1-01 | Load `/` | ~100 photos in 3-column grid, no broken images |
| UI-S1-02 | Scroll to bottom | All photos loaded (no lazy-load cutoff) |
| UI-S1-03 | Tap a photo | Navigates to `/photo/[id]` |
| UI-S1-04 | Tap "Search" in bottom nav | Navigates to `/search` |
| UI-S1-05 | Tap "Collections" placeholder | Shows "Not part of this prototype" toast |

---

### 3.2 S2/S3 — Search

| Test ID | Action | Expected |
|---|---|---|
| UI-S2-01 | Load `/search` | Search bar focused, placeholder text visible |
| UI-S2-02 | Tap People/Places/Things | "Not part of this test" toast |
| UI-S2-03 | Type "pool", press Enter | Results page loads |
| UI-S2-04 | Type "pool", tap × | Input cleared |
| UI-S2-05 | Mode A: type "pool", pause 1s | Coach does NOT appear |
| UI-S2-06 | Mode B: type "pool", pause 1s | Coach appears within ~1 second |

---

### 3.3 S4 — Coach Panel

| Test ID | Action | Expected |
|---|---|---|
| UI-S4-01 | Coach appears | Slides in smoothly, header visible |
| UI-S4-02 | Count questions | ≤ 3 questions shown |
| UI-S4-03 | Tap a chip | Chip highlights, questions re-rank |
| UI-S4-04 | Tap "Something else" | Inline text input appears |
| UI-S4-05 | Tap "I don't remember" | Question greyed out |
| UI-S4-06 | Tap "Not these" | All answers cleared, original query shown |
| UI-S4-07 | Tap "Search anyway" | Navigates to results with original typed text |
| UI-S4-08 | Tap "Build my search" | Loading state shown, then S5 |
| UI-S4-09 | Debug mode `?debug=1` | Candidate count + balance scores visible |
| UI-S4-10 | Occasion chip | Displayed with "?" suffix |

---

### 3.4 S5 — Prompt Review

| Test ID | Action | Expected |
|---|---|---|
| UI-S5-01 | Arrives at S5 | Prompt shown in editable textarea |
| UI-S5-02 | Remove a cue chip | Chip removed, prompt updates |
| UI-S5-03 | Edit textarea manually | Text changes freely |
| UI-S5-04 | Tap "Search" | Searches with current textarea content |
| UI-S5-05 | Tap "Back" | Returns to S4 with previous answers intact |
| UI-S5-06 | Fallback composer | Debug label shows "fallback" |

---

### 3.5 S6/S8 — Results

| Test ID | Action | Expected |
|---|---|---|
| UI-S6-01 | Results load | Photos in 3-column grid, ranked by score |
| UI-S6-02 | Mode B results | "Edited search" pill visible |
| UI-S6-03 | Tap photo | Opens S7 viewer |
| UI-S6-04 | Zero results | S8 shown: "No photos found." |
| UI-S6-05 | S8 Mode A | "Try again" button only |
| UI-S6-06 | S8 Mode B | "Try again" + "Back to my questions" |
| UI-S6-07 | Debug mode | Score shown per photo |

---

### 3.6 S7 — Photo Viewer

| Test ID | Action | Expected |
|---|---|---|
| UI-S7-01 | Open photo | Full-size image fills screen |
| UI-S7-02 | In study session | "This is the photo" + "Not it" visible |
| UI-S7-03 | Normal browsing | Only back arrow (no study buttons) |
| UI-S7-04 | "This is the photo" | Logs `found`, navigates to S11 |
| UI-S7-05 | "Not it" | Logs `wrong_open`, returns to S6 |

---

### 3.7 S9–S11 — Study Mode

| Test ID | Action | Expected |
|---|---|---|
| UI-S9-01 | Load `/moderator` without PIN | PIN input shown |
| UI-S9-02 | Enter correct PIN | Console unlocked |
| UI-S9-03 | Select participant, mode, target → "Start task" | Navigates to `/study` |
| UI-S9-04 | Timer visible | Counts up during task |
| UI-S9-05 | Live event log | Last 5 events shown |
| UI-S10-01 | Target shown | Full-screen photo, countdown timer (5s) |
| UI-S10-02 | Countdown ends | Photo hidden, "Now find this photo from memory." shown |
| UI-S10-03 | 3-minute task timer | Visible during search |
| UI-S10-04 | Timer expires | S11 shown, `outcome: "timeout"` |
| UI-S11-01 | Task end screen | Two 1–5 scale questions + comment field |
| UI-S11-02 | Submit survey | Logs `survey_answered`, returns to `/moderator` |

---

## 4. Study Mode Evals

End-to-end test. Run a **full simulated session** before real user testing.

| Test ID | Action | Expected |
|---|---|---|
| ST-01 | Full Mode A session | Events: task_start → target_shown → target_hidden → query_typed → vague_check → search_submitted → photo_opened → found → task_end → survey_answered |
| ST-02 | Full Mode B session | Events: task_start → target_shown → target_hidden → query_typed → vague_check → coach_triggered → coach_shown → chip_tapped → prompt_composed → search_submitted → photo_opened → found → task_end → survey_answered |
| ST-03 | Participant gives up | `gave_up` event logged, S11 shown with `outcome: "gave_up"` |
| ST-04 | Timeout | `timeout` event + S11 with `outcome: "timeout"` |
| ST-05 | Two tasks, same participant | Two separate sessionIds in DB |
| ST-06 | Export CSV | One row per session, all fields present |
| ST-07 | DB offline mid-session | Events queue in localStorage; next successful POST flushes queue |
| ST-08 | Consent notice | Visible on moderator console |
| ST-09 | URL-based session | `/study?pid=P01&mode=B&target=T03` works without going through moderator console |

---

## 5. Performance Evals

### 5.1 Response Time

| Component | Budget | Measure how |
|---|---|---|
| Coach panel appearance after pause | ≤ 1000ms | Browser DevTools, Network tab, time from last keystroke |
| `/api/coach/analyze` (server) | ≤ 500ms | Server log timing |
| `/api/coach/answer` (re-rank) | ≤ 200ms | Server log timing |
| Groq compose (success path) | ≤ 3000ms | `latencyMs` in `prompt_composed` event |
| Groq fallback (failure path) | ≤ 100ms | Deterministic, no network call |
| `/api/search` | ≤ 300ms | Server log timing |
| Photos home grid load (first paint) | ≤ 3s on 4G | Lighthouse or real device |

### 5.2 Image Size

| Check | Requirement |
|---|---|
| Each `/public/library/*.jpg` | ≤ 300 KB (Pexels "large" is typically fine, verify) |
| If any > 300 KB | Compress with `sharp` or `squoosh` before deploy |

### 5.3 Load Test (basic)

- Simulate 3 concurrent study sessions running simultaneously
- All three should complete without errors
- DB should have all 3 session event trails

---

## 6. Logging & Metrics Evals

| Test ID | Check | Expected |
|---|---|---|
| LG-01 | Mode A session, export CSV | `coach_triggered = false`, `prompt_edited = N/A` |
| LG-02 | Mode B session with coach, export CSV | `coach_triggered = true`, `layer = "library"` or `"generic"` |
| LG-03 | Mode B session, user edits prompt | `prompt_edit_rate` = 1 for this session |
| LG-04 | Mode B, user taps "Search anyway" | No `prompt_composed` event in trail |
| LG-05 | Mode B, user taps "Not these" | `coach_reset` event in trail |
| LG-06 | Query Formation Rate | Computed correctly: sessions with 2+ cues ÷ vague sessions |
| LG-07 | Cue classifier on "pool friends red swimsuit" | Returns `["where", "who", "look"]` (cue_count = 3) |
| LG-08 | Cue classifier on "pool" | Returns `["where"]` (cue_count = 1) |
| LG-09 | `search_submitted` has `isFirstQuery: true` | Only on the very first submit of the session |
| LG-10 | Multiple searches in one session | Only the first `isFirstQuery=true`; rest `false` |

---

## 7. Accessibility Evals

| Test ID | Check | Tool / Method |
|---|---|---|
| A11Y-01 | All chips have `aria-pressed` | Inspect DOM |
| A11Y-02 | Tab order is logical (search bar → chips → buttons) | Tab through keyboard |
| A11Y-03 | Focus state visible on all interactive elements | Visual inspection |
| A11Y-04 | Minimum contrast ratio 4.5:1 | Chrome DevTools, Accessibility tab |
| A11Y-05 | Minimum text size 14px | CSS inspection |
| A11Y-06 | Tap targets ≥ 44 × 44px | Chrome DevTools device emulation |
| A11Y-07 | Images have `alt` text | DOM inspection |
| A11Y-08 | Error states have descriptive messages | Trigger each error, read message |

---

## 8. Deployment Evals

Run immediately after each deploy to Vercel.

| Test ID | Check | Expected |
|---|---|---|
| DEP-01 | `https://<app>.vercel.app/` loads | 200, photos grid visible |
| DEP-02 | No console errors in browser | Clean console |
| DEP-03 | `/api/photos` returns data | 200 JSON |
| DEP-04 | `/api/search` works | POST `{query:"pool"}` returns results |
| DEP-05 | `/api/coach/analyze` works | POST `{query:"pool"}` returns questions |
| DEP-06 | `/api/coach/compose` works | POST with answers returns prompt |
| DEP-07 | No API keys in browser network tab | Check XHR/fetch requests — keys must be absent |
| DEP-08 | Event logged to DB | POST `/api/log`, then check Supabase table |
| DEP-09 | `/api/admin/export.csv` with PIN | Returns CSV |
| DEP-10 | `/about` loads | Credits visible |
| DEP-11 | Phone test | Layout correct at 390px, coach usable |
| DEP-12 | HTTPS | No mixed-content warnings |

---

## 9. Study Outcome Evals (post-session)

After all user-testing sessions complete, verify data quality before analysis.

| Check | Method | Pass condition |
|---|---|---|
| ≥ 3 sessions logged | Count rows grouped by session_id in DB | ≥ 3 unique session_ids |
| Both modes represented | Count sessions per mode | ≥ 1 Mode A, ≥ 1 Mode B |
| All sessions have `task_end` event | Query DB | 0 sessions without `task_end` |
| All sessions have `survey_answered` event | Query DB | 0 sessions without survey |
| No duplicate `task_start` events per session | Query DB | 1 per session |
| CSV export complete | Download and open | All columns present, no empty required fields |
| Time-to-find is plausible | Check column | Between 5s and 180s for all `found` sessions |
| First query text present | Check column | No nulls |
| Cue count computable | Check column | 1–6 for all sessions |
| Mode A and B rows comparable | Visual check | Same columns populated in both modes |

---

## 10. Eval Scorecard

Use this table to track eval status across phases.

| Category | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|---|---|---|---|---|---|
| vagueCheck unit tests | — | ✅ | — | — | — |
| search unit tests | — | ✅ | — | — | — |
| coachEngine unit tests | — | — | ✅ | — | — |
| promptComposer unit tests | — | — | — | ✅ | — |
| metrics unit tests | — | — | — | ✅ | — |
| API integration evals | — | Partial | Partial | ✅ | — |
| UI evals (local) | — | Partial | Partial | ✅ | — |
| Performance evals | — | — | — | — | ✅ |
| Accessibility evals | — | — | — | — | ✅ |
| Deployment evals | — | — | — | — | ✅ |
| Study mode evals | — | — | — | ✅ | — |

**Legend:** ✅ = must pass before moving forward. `—` = not applicable yet.

---

*End of EVALS.md*
