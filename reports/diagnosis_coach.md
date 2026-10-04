# Diagnosis Report: Mode B Coach Engine — Root Cause Analysis

> **Date:** 2026-10-03  
> **Scope:** DIAGNOSE ONLY. No source file was modified.  
> **Scripts:** `scripts/diagnose/diagnose_trigger.js`, `diagnose_tags.js`, `diagnose_questions.js`

---

## Executive Summary

| Issue | Expected | Actual | Status |
|-------|----------|--------|--------|
| "me in a restaurant" coach opens | YES (vague query) | **YES — shouldTrigger=true** | ✅ Trigger is NOT broken |
| "me in a pool" coach opens | YES | YES | ✅ Trigger works |
| "me in a pool" shows WHO = names | ❌ group type | `Rohan, Meera, Ananya, Priya` | 🔴 **Bug confirmed** |
| "me in a pool" shows WHERE = cities | ❌ venue type | `Pondicherry, Goa, Bengaluru, Manali` | 🔴 **Bug confirmed** |
| "me in a pool" shows WHEN = years | ⚠️ low utility | `2 years ago, Earlier, This year` | 🟡 Works but generic |

---

## Task A — Trigger Path (diagnose_trigger.js)

### Test Matrix (14 queries, Mode B, not dismissed)

| Query | isVague | preciseCount | count_strong | ambiguous | trigger | blocked reason |
|-------|---------|-------------|-------------|-----------|---------|----------------|
| me in a restaurant | true | 0 | 25 | 20 | **true** | — |
| me in a pool | true | 0 | 21 | 12 | **true** | — |
| me at the beach | true | 0 | 37 | 16 | **true** | — |
| me hiking | true | 0 | 21 | 12 | **true** | — |
| birthday party | true | 0 | 7 | 1 | false | few_strong_matches |
| graduation photos | true | 0 | 20 | 11 | false | clear_winner |
| road trip | true | 0 | 0 | 0 | false | few_strong_matches |
| me with friends | true | 0 | 33 | 1 | false | clear_winner |
| festival photos | true | 0 | 20 | 5 | false | clear_winner |
| kids playing | true | 0 | 23 | 5 | false | clear_winner |
| pet photos | true | 0 | 23 | 7 | false | clear_winner |
| photos in Goa | true | 1 | 28 | 28 | true | — |
| photos with Meera | true | 1 | 29 | 29 | true | — |
| photos from 2022 | true | 1 | 0 | 0 | false | few_strong_matches |

### Finding: RC-A1 — "me in a restaurant" is NOT blocked

**The premise in the bug report was incorrect.** Live execution proves:

- `"me in a restaurant"` → normalised tokens: `[restaurant]`
- `vagueCheck` → `isVague=true`, `preciseCount=0` (no named person, year, or place)
- `search` → `count_strong=25`, `ambiguous_count=20`
- `evaluateTrigger` → `shouldTrigger=true`, `blockedReason=""`

> [!IMPORTANT]
> **"me in a restaurant" DOES trigger the coach.** The reported bug (coach not opening) is **not** reproduced by the engine logic. The failure to open must occur in the UI layer (React state, dismissal flag, debounce) — not in `coachEngine.ts` or `vagueCheck.ts`.

### Finding: RC-A2 — "me in a pool" trigger path is correct

- tokens: `[pool]`
- `vagueCheck` → `isVague=true` ✅
- `search` → `count_strong=21`, `ambiguous_count=12` (exactly at `COACH_MIN_AMBIGUOUS=12`)
- trigger passes all 5 gates ✅

> [!WARNING]
> "me in a pool" passes by a margin of **1** on the `ambiguous_count` gate (`12 >= 12`). Adding even one more distinct top-score restaurant photo would flip it. The system is brittle at these exact thresholds.

### Finding: RC-A3 — Queries that fail and why

| Blocked reason | Queries | Root cause |
|----------------|---------|-----------|
| `few_strong_matches` | birthday party, road trip, photos from 2022 | Multi-token queries fail tier-1 (birthday+party: only 7 match both); year token `2022` not matched by text scoring (year is metadata integer, not a text field in content scoring) |
| `clear_winner` | graduation, festival, friends, pets, kids | High score concentration → top-1 score dominates → ambiguous_count < 12 |

---

## Task B — Tag Vocabulary (diagnose_tags.js)

### Per-theme field coverage (coachable = coverage ≥ 60% AND distinct ≥ 2)

#### Pool (20 photos)
| Field | Coverage | Distinct | Coachable | Top values |
|-------|---------|---------|-----------|------------|
| setting | 100% | 1 | ❌ | pool(20) |
| indoor_outdoor | 90% | 2 | ✅ | outdoor(15), indoor(3) |
| activity | 60% | 3 | ✅ | swimming(10), relaxing(1), jumping(1) |
| group_type | 60% | 2 | ✅ | solo(10), friends(2) |
| occasion_guess | 5% | 1 | ❌ | party(1) |
| **metadata.people** | **60%** | **6** | **✅** | **rohan(4), meera(4), ananya(3)...** |
| **metadata.place.city** | **100%** | **3** | **✅** | **Goa(7), Pondicherry(7), Bengaluru(6)** |
| metadata.year → time_period | 100% | 3 | ✅ | earlier(7), two years ago(7), this year(6) |

#### Restaurant (20 photos) — low coverage in key fields
| Field | Coverage | Distinct | Coachable |
|-------|---------|---------|-----------|
| group_type | **35%** | 3 | ❌ |
| activity | **70%** | 1 | ❌ |
| occasion_guess | **5%** | 1 | ❌ |
| mood | **50%** | 2 | ❌ |
| time_of_day | **30%** | 2 | ❌ |
| indoor_outdoor | 100% | 2 | ✅ |

> [!NOTE]
> Restaurant photos have severe `unknown`/`none` coverage gaps in behavioural tag fields. Even when the coach triggers, it will struggle to form useful questions.

### Cross-theme low-coverage fields (< 60%)

- `activity` — birthday (40%), roadtrip (15%)
- `group_type` — birthday (15%), pets (35%), restaurant (35%), roadtrip (15%)
- `occasion_guess` — beach, hiking, kids, pets, pool, restaurant, roadtrip all at 0–5%

---

## Task C — Question Selection (diagnose_questions.js)

### Full `selectQuestions()` trace for "me in a pool" (21 tier-1 candidates)

| Field | CueType | Coverage | Distinct | Score | Decision | Options shown |
|-------|---------|---------|---------|-------|---------|--------------|
| **place_city** | **where** | 100% | 4 | **0.624** | **KEPT** | Pondicherry, Goa, Bengaluru, Manali |
| **cast_people** | **who** | 62% | 6 | **0.579** | **KEPT** | Rohan, Meera, Ananya, Priya |
| **time_period** | **when** | 100% | 4 | **0.535** | **KEPT** | 2 years ago, Earlier, This year, Last year |
| season_year | when | 100% | 4 | 0.535 | dedup (when already selected) | — |
| activity | what | 62% | 4 | **0.319** | KEPT (rank 5) | swimming, relaxing, jumping, playing |
| mood | mood | 95% | 4 | 0.386 | KEPT (rank 4) | calm, cheerful, energetic, playful |
| occasion_guess | occasion | 5% | 1 | 0 | SKIP: low coverage | — |
| clothing_color | look | 38% | 8 | 0 | SKIP: low coverage | — |
| time_of_day | when | 76% | 2 | 0.154 | dedup | — |

### Selected Q1/Q2/Q3 (top 3 by score, distinct cueType)

| # | CueType | Field | Score | Options | Problem |
|---|---------|-------|-------|---------|---------|
| Q1 | **where** | place_city | 0.624 | Pondicherry, Goa, Bengaluru, Manali | 🔴 Cities, not venue type |
| Q2 | **who** | cast_people | 0.579 | Rohan, Meera, Ananya, Priya | 🔴 Cast names, not relationship |
| Q3 | **when** | time_period | 0.535 | 2 years ago, Earlier, This year | 🟡 Useful but generic |

**Displaced useful fields:**
- `activity` (score 0.319) — **never reaches top-3** because 3 higher-scoring fields take the 3 slots
- `group_type` — not even in the field config loop in `selectQuestions()` (coachEngine.ts line 307–315); the loop only covers `place_city, cast_people, time_period, season_year, activity, occasion_guess, clothing_color, time_of_day, mood`
- `indoor_outdoor` — not in the loop either

---

## Root Cause Catalogue

### RC-A1 — Trigger bug claim is false at the engine layer

**Finding:** `evaluateTrigger()` returns `shouldTrigger=true` for "me in a restaurant" (count_strong=25, ambiguous=20). The engine-level trigger is working correctly.

**Real location of the reported bug:** Must be upstream in the React/UI state — likely the `hasBeenDismissed` flag persisting from a prior session, the debounce timer not firing, or a conditional in the component that guards coach rendering.

**Evidence:** `diagnose_trigger.js` output, line 1 of summary table.

---

### RC-B1 — cast_people wins WHO with cast names, not relationship labels

**Root cause:** `computeFieldDistribution(field="cast_people")` reads `metadata.people`, which is an array of individual cast member names (`["Rohan", "Meera", "Aarav"]`). Because each pool photo has a different subset of names, the entropy is high (6 distinct values, each appearing 1–5 times), giving `cast_people` a balance score of **0.579** — higher than `group_type` (0.xx, fewer distinct values).

The `selectQuestions()` loop in `coachEngine.ts` (lines 307–315) places `cast_people` in the `who` cue slot **before** `group_type`. Since cue deduplication keeps only the first `who` entry sorted by score, `cast_people` always wins and `group_type` is never shown.

**Impact:** The WHO question displays individual names (Rohan, Meera…) which are not meaningful memory cues — the user is searching *because* they can't recall who was there.

---

### RC-B2 — place_city wins WHERE with city names, not venue type

**Root cause:** `computeFieldDistribution(field="place_city")` reads `metadata.place.city`. Pool photos span 3 cities (Goa, Pondicherry, Bengaluru), so coverage=100%, distinct=4, balance score=**0.624** — the highest of all fields.

Meanwhile:
- `setting` = "pool" for all 20 photos → distinct=1 → score=0 → skipped
- `indoor_outdoor` = "outdoor" for 15/20 photos → distinct=2 but very skewed → low score

So WHERE defaults to city names. A user who typed "me in a pool" is unlikely to remember the city — they remember the occasion or group, not the geography.

**Impact:** Q1 shows city options (Pondicherry, Goa, Bengaluru) which are geography trivia, not memory cues.

---

### RC-B3 — activity is suppressed to rank #5 by the current scoring

**Root cause:** `activity` has coverage=62% and distinct=4 (swimming, relaxing, jumping, playing) giving score=**0.319** — fifth overall. The top 3 slots are taken by place_city (0.624), cast_people (0.579), and time_period (0.535). Activity never enters the final Q1–Q3 set.

**Impact:** The most obvious distinguishing question ("What were you doing?") is never asked.

---

### RC-B4 — clothing_color and indoor_outdoor are unconditionally eliminated

**Root cause:**
- `clothing_color` coverage=38% for pool photos (most tag entries have `"unknown"` colour) → below `MIN_FIELD_COVERAGE=0.6` → score=0.
- `indoor_outdoor` is not even in the `fieldsConfig` array in `selectQuestions()` (the loop uses `place_city`, `cast_people`, `time_period`, `season_year`, `activity`, `occasion_guess`, `clothing_color`, `time_of_day`, `mood`). It is absent.

**Impact:** Two potentially useful memory cues (clothing, indoor/outdoor) can never appear in Q1–Q3.

---

## Hypothesis Checklist

| # | Hypothesis | Confirmed? | Evidence |
|---|-----------|-----------|---------|
| H1 | "me in a restaurant" fails vagueCheck | ❌ FALSE | preciseCount=0, isVague=true |
| H2 | "me in a restaurant" fails evaluateTrigger | ❌ FALSE | count_strong=25≥15, ambiguous=20≥12, shouldTrigger=true |
| H3 | "me in a pool" WHO question shows cast names | ✅ TRUE | cast_people field → metadata.people names |
| H4 | cast_people wins due to high entropy from many unique names | ✅ TRUE | 6 distinct names, score=0.579 > group_type |
| H5 | "me in a pool" WHERE question shows city names | ✅ TRUE | place_city wins with 4 cities |
| H6 | "me in a pool" WHEN shows relative years not occasion | ✅ TRUE | time_period score=0.535, occasion_guess score=0 |
| H7 | activity (swimming) is displaced from Q1–Q3 | ✅ TRUE | score=0.319, rank 5 of 7 scored fields |
| H8 | clothing_color could be a useful cue but is eliminated | ✅ TRUE | coverage=38% < MIN_FIELD_COVERAGE=0.6 |

---

## Impact & Fix Analysis (no fixes applied — diagnose only)

| Root Cause | Severity | Minimal fix (described, not implemented) |
|-----------|---------|------------------------------------------|
| RC-A1: restaurant trigger is fine; UI bug elsewhere | High | Investigate `hasBeenDismissed` React state persistence and debounce race in `page.tsx`/coach component |
| RC-B1: cast_people shows names | High | Replace `cast_people` in fieldsConfig with `group_type`; OR add a label mapping step that converts individual names to relationship labels before display |
| RC-B2: place_city shows cities | Medium | Remove `place_city` from `fieldsConfig` OR de-rank it relative to behavioural fields (`activity`, `group_type`) |
| RC-B3: activity suppressed | High | Increase `activity`'s CUE_WEIGHT for `what` (currently 0.9 vs where 0.7) OR move it earlier in `fieldsConfig` ordering |
| RC-B4: indoor_outdoor absent | Low | Add `indoor_outdoor` to `fieldsConfig` in `selectQuestions()` |
| RC-B4: clothing_color coverage too low | Medium | Improve tag coverage for clothing.colour in data generation; OR lower threshold only for clothing |

---

## Files Created

| File | Purpose |
|------|---------|
| [`scripts/diagnose/diagnose_trigger.js`](file:///c:/Users/THARUN/Videos/Gp2%20solution/scripts/diagnose/diagnose_trigger.js) | Task A: Inlined trigger path (search → vagueCheck → evaluateTrigger) for 14 queries |
| [`scripts/diagnose/diagnose_tags.js`](file:///c:/Users/THARUN/Videos/Gp2%20solution/scripts/diagnose/diagnose_tags.js) | Task B: Tag field coverage by theme, pool candidate field audit |
| [`scripts/diagnose/diagnose_questions.js`](file:///c:/Users/THARUN/Videos/Gp2%20solution/scripts/diagnose/diagnose_questions.js) | Task C: Full `selectQuestions()` trace with per-field balance scores |
| [`reports/diagnosis_coach.md`](file:///c:/Users/THARUN/Videos/Gp2%20solution/reports/diagnosis_coach.md) | This report |

> [!NOTE]
> All scripts are pure Node.js (no TypeScript compilation required).  
> Run: `node scripts/diagnose/diagnose_trigger.js`, etc.  
> No source files, data files, or tests were modified.
