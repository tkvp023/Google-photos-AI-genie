# ARCHITECTURE.md — Pre-Search "Narrow It Down" Coach (Google Photos MVP)

> **Document type:** Technical Architecture Reference  
> **Audience:** Antigravity (coding agent), Tharun (product owner), any developer joining the project.  
> **Source of truth for behaviour:** `PROBLEM_STATEMENT.md`. This document describes **how** to build what is specified there.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [High-Level Architecture Diagram](#2-high-level-architecture-diagram)
3. [Repository & Folder Structure](#3-repository--folder-structure)
4. [Tech Stack](#4-tech-stack)
5. [Data Layer](#5-data-layer)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Backend / API Layer](#7-backend--api-layer)
8. [Core Logic Modules](#8-core-logic-modules)
9. [AI Integration Points](#9-ai-integration-points)
10. [Study Mode & Logging Architecture](#10-study-mode--logging-architecture)
11. [Configuration System](#11-configuration-system)
12. [Deployment Architecture](#12-deployment-architecture)
13. [Data Flow Diagrams](#13-data-flow-diagrams)
14. [Security & Key Management](#14-security--key-management)
15. [Error Handling Strategy](#15-error-handling-strategy)
16. [Testing Strategy](#16-testing-strategy)

---

## 1. System Overview

The MVP is a **standalone web app** that simulates a Google Photos search experience. It is used to run a **controlled A/B study** comparing plain search (Mode A) against coach-assisted search (Mode B).

### Two operating modes

| Mode | Name | Description |
|---|---|---|
| **A** | Plain search | Query → Search → Results. No coach. |
| **B** | Coach search | Query → Vague check → Coach panel → Composed prompt → Search → Results |
| **C** *(stretch)* | Post-submit chips | Coach shown on results page, not before search |

### What the system does NOT do

- No real Google Photos integration
- No face recognition or GPS metadata
- No user accounts or login
- No AI calls at search runtime (Gemini is offline-only; Groq only for prompt composition)

---

## 2. High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Mobile-first, 390px)            │
│                                                                 │
│  ┌──────────┐  ┌──────────────────────────────────────────────┐ │
│  │ Photos   │  │ Search Flow                                  │ │
│  │ Home (S1)│  │  S2 (empty) → S3 (typing) → S4 (coach)      │ │
│  │ Grid     │  │  → S5 (prompt review) → S6 (results)        │ │
│  └──────────┘  │  → S7 (viewer) → S8 (zero results)          │ │
│                └──────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Study Mode: S9 (moderator) → S10 (target) → S11 (end)  │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTPS / Next.js API Routes
┌───────────────────────▼─────────────────────────────────────────┐
│                    NEXT.JS SERVER (Vercel)                       │
│                                                                  │
│  ┌────────────┐  ┌─────────────┐  ┌────────────┐  ┌──────────┐ │
│  │ /api/photos│  │ /api/search │  │/api/coach/ │  │ /api/log │ │
│  │            │  │             │  │ analyze    │  │          │ │
│  │ Photo list │  │ Lexical     │  │ answer     │  │ Event    │ │
│  │ from tags  │  │ scorer      │  │ compose    │  │ writer   │ │
│  └────────────┘  └─────────────┘  └─────┬──────┘  └────┬─────┘ │
│                                         │               │       │
│  ┌──────────────────────────────────────▼───────────────▼─────┐ │
│  │               In-Memory Data Store (server start)          │ │
│  │   tags.json  ·  targets.json  ·  synonyms.json            │ │
│  │   places.json  ·  cue_lexicon.json                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────┐  ┌────────────────────────┐│
│  │    GROQ (external, runtime)     │  │  DATABASE (Supabase /  ││
│  │    Prompt composer only         │  │  SQLite on Render)     ││
│  │    llama-3.x-instruct           │  │  Event log persistence ││
│  └─────────────────────────────────┘  └────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘

OFFLINE PIPELINE (runs once, not at runtime):
  Pexels API → download_pexels.py → /public/library/*.jpg
  /public/library/ → tag_library.py (Gemini Flash vision) → data/tags.json
```

---

## 3. Repository & Folder Structure

```
/ (project root)
├── public/
│   └── library/                  # ~100 downloaded Pexels images
│       ├── pool_01.jpg
│       ├── beach_01.jpg
│       └── ...                   # <theme>_<nn>.jpg naming convention
│
├── data/
│   ├── tags.json                 # Gemini-tagged photo metadata (offline output)
│   ├── targets.json              # 10 study target photos chosen by owner
│   ├── credits.csv               # photographer, Pexels URL per photo
│   ├── synonyms.json             # token synonyms for lexical search
│   ├── places.json               # named places for vague-check precision
│   └── cue_lexicon.json          # word lists per cue type (who/when/where/etc.)
│
├── scripts/
│   ├── download_pexels.py        # Downloads ~14 photos per theme from Pexels
│   ├── tag_library.py            # Calls Gemini vision, outputs tags.json
│   └── tag_prompt.txt            # Tagging system prompt for Gemini
│
├── wireframes/                   # Owner-supplied wireframes (source of truth for layout)
│   ├── S01_home.png
│   ├── S02_search_empty.png
│   └── ...
│
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── page.tsx              # S1 — Photos home (library grid)
│   │   ├── search/
│   │   │   └── page.tsx          # S2/S3 — Search home + typing state
│   │   ├── results/
│   │   │   └── page.tsx          # S6/S8 — Results grid / zero results
│   │   ├── photo/
│   │   │   └── [id]/page.tsx     # S7 — Photo viewer
│   │   ├── moderator/
│   │   │   └── page.tsx          # S9 — Moderator console (PIN-protected)
│   │   ├── study/
│   │   │   └── page.tsx          # S10/S11 — Target reveal + Task end
│   │   ├── about/
│   │   │   └── page.tsx          # S12 — About and Credits
│   │   ├── admin/
│   │   │   └── page.tsx          # Admin dashboard with metrics table
│   │   └── api/
│   │       ├── photos/route.ts
│   │       ├── search/route.ts
│   │       ├── coach/
│   │       │   ├── analyze/route.ts
│   │       │   ├── answer/route.ts
│   │       │   └── compose/route.ts
│   │       ├── log/route.ts
│   │       └── admin/
│   │           └── export.csv/route.ts
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── SearchBar.tsx
│   │   │   ├── PhotoGrid.tsx
│   │   │   ├── PhotoCard.tsx
│   │   │   ├── BottomNav.tsx
│   │   │   └── Toast.tsx
│   │   ├── coach/
│   │   │   ├── CoachPanel.tsx
│   │   │   ├── QuestionBlock.tsx
│   │   │   ├── ChipOption.tsx
│   │   │   └── PromptReview.tsx
│   │   └── study/
│   │       ├── ModeratorConsole.tsx
│   │       ├── TargetReveal.tsx
│   │       └── TaskEndSurvey.tsx
│   │
│   ├── lib/
│   │   ├── config.ts
│   │   ├── dataLoader.ts
│   │   ├── search.ts
│   │   ├── vagueCheck.ts
│   │   ├── coachEngine.ts
│   │   ├── promptComposer.ts
│   │   ├── eventLogger.ts
│   │   └── metrics.ts
│   │
│   ├── hooks/
│   │   ├── useCoach.ts
│   │   ├── useSearch.ts
│   │   └── useStudySession.ts
│   │
│   ├── types/
│   │   └── index.ts
│   │
│   └── db/
│       ├── client.ts
│       └── schema.sql
│
├── .env.example
├── README.md
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 4. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Framework | **Next.js 14+ (App Router)** | SSR + API routes in one project; easy Vercel deploy |
| Language | **TypeScript** | Type safety across frontend and backend |
| Styling | **Tailwind CSS** | Spec-specified; fast mobile-first layouts |
| Font | **Roboto / Inter** (Google Fonts) | Matches Google Photos aesthetic |
| LLM (runtime) | **Groq** (Llama 3.x instruct) | Fast, cheap, JSON-mode; only for prompt composition |
| LLM (offline) | **Gemini Flash vision** | Photo tagging — runs once, never at runtime |
| Photo source | **Pexels API** | Free, licensed, download script in spec |
| Database | **Supabase (Postgres)** or **SQLite on Render** | Event log persistence |
| Hosting | **Vercel** | Serverless, HTTPS, free tier sufficient |
| State (client) | **React useState / useReducer** | No external state lib needed at this scale |
| LocalStorage | **Web Storage API** | Event queue fallback when DB unreachable |

---

## 5. Data Layer

### 5.1 Static Data Files (loaded into server memory on startup)

```typescript
// src/lib/dataLoader.ts
interface DataStore {
  tags: Record<string, PhotoTag>;
  targets: StudyTarget[];
  synonyms: Record<string, string>;
  places: string[];
  cueLexicon: Record<CueType, string[]>;
  photos: PhotoMeta[];
}
```

### 5.2 `tags.json` Schema

```jsonc
{
  "pool_01.jpg": {
    "one_line": "a group of friends splashing in a sunny outdoor pool",
    "setting": "pool",
    "indoor_outdoor": "outdoor",
    "activity": "swimming",
    "occasion_guess": "none",
    "occasion_basis": "none",
    "people_count": 4,
    "people_ages": ["adult"],
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

**Normalisation applied post-tagging:**
- Lowercase + trim all string fields
- Colours mapped to base palette: `red, blue, green, yellow, orange, pink, purple, white, black, grey, brown, beige`
- `clothing` split into `{colour, item}` pairs
- `people_bucket` computed: `1 | 2 | 3-5 | 6+`
- `tag_coverage` = `validTags / totalPhotos` — must be ≥ 90% to enable Layer 2

### 5.3 `targets.json` Schema

```jsonc
[
  {
    "id": "T01",
    "file": "pool_03.jpg",
    "theme": "pool",
    "difficulty": "high-match-count",
    "distinctiveFeature": "red swimsuit, group of 5"
  }
]
```

### 5.4 Database Schema (Event Log)

```sql
CREATE TABLE events (
  id             SERIAL PRIMARY KEY,
  ts             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_id     TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  mode           CHAR(1) NOT NULL,
  type           TEXT NOT NULL,
  payload        JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_events_session ON events(session_id);
CREATE INDEX idx_events_ts ON events(ts);
```

---

## 6. Frontend Architecture

### 6.1 Screen → Route Map

| Screen | Route | Mode |
|---|---|---|
| S1 — Photos home | `/` | All |
| S2/S3 — Search | `/search` | A or B |
| S4 — Coach panel | `/search` (overlay state) | B only |
| S5 — Prompt review | `/search` (overlay state) | B only |
| S6/S8 — Results | `/results?q=...` | All |
| S7 — Photo viewer | `/photo/[id]` | All |
| S9 — Moderator | `/moderator` | PIN protected |
| S10/S11 — Study | `/study` | Moderator-initiated |
| S12 — About | `/about` | All |
| Admin | `/admin` | PIN protected |

### 6.2 Coach UI State Machine

```
IDLE
  │  (typing starts, Mode B)
  ▼
DEBOUNCING
  │  (500ms pause, vague=true, count≥12)
  ▼
COACH_VISIBLE  ◄──── re-rank after each chip tap
  │
  ├── "Build my search" ──► COMPOSING ──► PROMPT_REVIEW
  ├── "Search anyway"   ──► SEARCHING (plain, original query)
  └── "Not these"       ──► IDLE (clear all answers)

PROMPT_REVIEW
  │  "Search" pressed
  ▼
SEARCHING → RESULTS
```

### 6.3 Key Component Responsibilities

| Component | Responsibility |
|---|---|
| `CoachPanel.tsx` | Renders questions, wires chip taps to `/api/coach/answer`, triggers compose |
| `QuestionBlock.tsx` | Single question + chips + "Something else" input + "I don't remember" |
| `ChipOption.tsx` | Accessible button with `aria-pressed`, single-select default |
| `PromptReview.tsx` | Removable cue chips above editable `<textarea>`; fires final search |

### 6.4 Mobile-First Layout

- Design width: **390 px** centred on desktop
- Bottom navigation: Photos, Search, two inert placeholders
- Search bar: rounded pill, sticky at top during search flow
- Photo grid: 3-column CSS Grid, square thumbnails, 2 px gaps
- Coach panel: slides up from below search bar (`transform` animation)
- All tap targets ≥ 44 px, minimum text 14 px

---

## 7. Backend / API Layer

### 7.1 `GET /api/photos`

```typescript
Response: { photos: Array<{ id: string; file: string; theme: string; src: string }> }
```

### 7.2 `POST /api/search`

```typescript
Request:  { query: string; sessionId: string; mode: "A"|"B"|"C" }
Response: { results: Array<{ id: string; score: number; matchedFields: string[] }>; count: number; bucket: "few"|"some"|"many" }
```

### 7.3 `POST /api/coach/analyze`

```typescript
Request:  { query: string; sessionId: string }
Response: { isVague: boolean; anchors: {...}; preciseCount: number; triggered: boolean; layer: "library"|"generic"|"none"; bucket: string; questions: Question[] }
```

### 7.4 `POST /api/coach/answer`

```typescript
Request:  { query: string; answers: Answer[]; sessionId: string }
Response: { bucket: string; questions: Question[] }
```

### 7.5 `POST /api/coach/compose`

```typescript
Request:  { query: string; answers: Answer[]; sessionId: string }
Response: { prompt: string; cues: Array<{type: CueType; value: string}>; composer: "groq"|"fallback" }
```

### 7.6 `POST /api/log`

```typescript
Request:  Event object (see spec section 10.2)
Response: { ok: true }  // always, even on DB failure
```

### 7.7 `GET /api/admin/export.csv`

Protected by `Authorization: Bearer <MODERATOR_PIN>`. Returns CSV of all events + derived metrics.

### 7.8 `Question` Shape

```typescript
interface Question {
  id: string;
  cueType: "who"|"occasion"|"look"|"what"|"where"|"when";
  field: string;
  text: string;
  layer: "library"|"generic";
  options: Array<{ label: string; value: string }>;
  allowText: boolean;
  allowDontRemember: boolean;
}
```

---

## 8. Core Logic Modules

### 8.1 `lib/search.ts` — Lexical Scorer

```
query → lowercase → strip punctuation → tokenise
     → remove stopwords (a, an, the, of, with, at, in, on, and, my, me, i, we, our,
                          photo, photos, picture, pictures, pic)
     → apply synonym map (synonyms.json)
     → apply stem/lemma map

For each photo:
  score = 0
  matchedFields = []
  For each token:
    For each weighted field:
      if token ∈ field_value: score += field_weight; record field
  multi-cue bonus: score += (distinct matched fields - 1) if > 1
  include if score >= MIN_SCORE

Sort DESC by score, then ASC by filename.
```

**Field weights:**

| Field | Weight |
|---|---|
| `setting` | 3 |
| `one_line`, `activity`, `occasion_guess`, `objects`, `clothing` | 2 |
| `group_type`, `people_ages` | 1.5 |
| `mood`, `weather_or_season`, `text_in_image`, `time_of_day` | 1 |

### 8.2 `lib/vagueCheck.ts`

```
person anchor:   name ∈ places.json People list
time anchor:     regex for exact date / month+year / 4-digit year
location anchor: token ∈ places.json named places

preciseCount = count of anchors found
isVague = preciseCount < 2
```

### 8.3 `lib/coachEngine.ts`

```
For each cue type:
  1. Gather relevant tag fields
  2. Skip if query already contains a value from this field
  3. Compute value distribution across candidateSet (ignore unknown/none)
  4. Skip if coverage < MIN_FIELD_COVERAGE (0.6)
  5. balance_score = coverage × normalised_entropy(top4_shares) × cue_weight

Pick top 3 questions with distinct cue types.
Each question: top 4 value chips + "Something else" + "I don't remember"

Fallback → generic Layer 1 questions if coverage low or candidates < 4.
```

**Balance score formula:**
```
entropy           = -Σ(p_i × log2(p_i))   over top-4 value shares
max_entropy       = log2(min(4, distinct_values))
normalised_entropy = entropy / max_entropy
balance_score     = coverage × normalised_entropy × cue_weight
```

### 8.4 `lib/promptComposer.ts`

```
1. Cache check: hash(query + sortedAnswers) → return if hit
2. Build Groq messages (system + user)
3. POST to Groq, 3000ms timeout
4. Parse + validate JSON response
5. Cache result, return { prompt, cues, composer: "groq" }

Fallback (on any failure):
  prompt = [query, ...answers.map(a => a.value)].join(", ")
  return { prompt, cues, composer: "fallback" }
  (user never sees an error)
```

---

## 9. AI Integration Points

### Gemini Flash Vision — Offline Tagging (once only)

| Property | Value |
|---|---|
| When | Offline, before deploy, run by developer |
| Script | `scripts/tag_library.py` |
| Model | `GEMINI_MODEL` env var (verify in AI Studio) |
| Key | `GEMINI_API_KEY` — local `.env` only, never in Vercel |
| Output | `data/tags.json` — committed and static at runtime |
| Review gate | Tag 10 photos → owner approves → tag all ~100 |

### Groq Llama — Runtime Prompt Composition

| Property | Value |
|---|---|
| When | User presses "Build my search" only |
| Model | `GROQ_MODEL` env var |
| Temperature | 0.2 |
| Max tokens | 120 |
| Timeout | 3000 ms |
| Key | `GROQ_API_KEY` — Vercel server-side env only |
| Caching | In-memory Map on server |
| Fallback | Deterministic comma-join (always available) |

### What uses NO AI at runtime

- Vague check, search scorer, coach question selection, preview filtering, event logging

---

## 10. Study Mode & Logging Architecture

### 10.1 Session Lifecycle

```
/moderator (PIN) → fill participantId / mode / targetId → "Start task"
  → POST log { task_start }
  → /study?pid=P01&mode=B&target=T03
    → S10: show target 5s → POST log { target_shown / target_hidden }
    → S2/S3: user searches (3-min timer running)
      → all search/coach events logged
    → S7: "This is the photo" → POST log { found }
    → S11: survey → POST log { survey_answered / task_end }
    → back to /moderator
```

### 10.2 Event Types

| Type | Key payload fields |
|---|---|
| `task_start` | `targetId` |
| `target_shown` / `target_hidden` | `durationMs` |
| `query_typed` | `text` |
| `vague_check` | `{isVague, anchors, preciseCount}` |
| `coach_triggered` | `{previewBucket, candidateCount, layer}` |
| `chip_tapped` | `{questionId, cueType, value}` |
| `chip_skipped` | `{questionId}` |
| `coach_reset` | — |
| `prompt_composed` | `{typed, answers, prompt, composer, latencyMs}` |
| `prompt_edited` | `{before, after}` |
| `search_submitted` | `{queryText, isFirstQuery, resultCount, topIds}` |
| `photo_opened` | `{photoId, rank}` |
| `found` / `wrong_open` / `gave_up` / `timeout` | `{photoId?}` |
| `task_end` | `{outcome, seconds}` |
| `survey_answered` | `{easy, confidence, comment}` |

### 10.3 Derived Metrics (computed at export time)

| Metric | Computation |
|---|---|
| First query text | First `search_submitted` where `isFirstQuery=true` per session |
| Cue types in first query | `cue_lexicon.json` classifier on first query |
| Query Formation Rate | Sessions with 2+ cue types ÷ vague sessions |
| Results per first query | `resultCount` in first `search_submitted` |
| Time to find | `found.ts − task_start.ts` in seconds |
| Found or not | `outcome` in `task_end` |
| Coach trigger rate | `coach_triggered` sessions ÷ Mode B sessions |
| Prompt edit rate | `prompt_edited` sessions ÷ `prompt_composed` sessions |

### 10.4 Offline Queue

```
logEvent(event)
  ├── POST /api/log
  │     ├── success → DB insert
  │     └── failure → push to localStorage queue
  └── (never throws or blocks UI)

On next successful POST: flush localStorage queue.
```

---

## 11. Configuration System

```typescript
// src/lib/config.ts  — no magic numbers anywhere else
export const config = {
  COACH_DEBOUNCE_MS:    500,
  COACH_MIN_MATCHES:    12,
  COACH_STOP_AT:        8,
  MIN_TAG_COVERAGE:     0.9,
  MIN_SCORE:            2,
  MAX_QUESTIONS:        3,
  MAX_OPTIONS:          4,
  MIN_FIELD_COVERAGE:   0.6,
  TASK_TIME_LIMIT_SEC:  180,
  TARGET_SHOW_SEC:      5,
  GROQ_TEMPERATURE:     0.2,
  GROQ_MAX_TOKENS:      120,
  GROQ_TIMEOUT_MS:      3000,
  MATCH_BUCKETS:        { few: 5, some: 20 },
  FIELD_WEIGHTS: {
    setting: 3,
    one_line: 2, activity: 2, occasion_guess: 2, objects: 2, clothing: 2,
    group_type: 1.5, people_ages: 1.5,
    mood: 1, weather_or_season: 1, text_in_image: 1, time_of_day: 1,
  },
  CUE_WEIGHTS: {
    occasion: 1.0, who: 1.0, look: 1.0, what: 0.9, where: 0.7, when: 0.6,
  },
} as const;
```

---

## 12. Deployment Architecture

```
VERCEL
  ├── Next.js serverless functions (API routes)
  ├── /public/library/*.jpg → Vercel CDN
  └── /data/*.json → bundled with server functions

SUPABASE (free tier)
  └── Postgres → events table (append-only)

ALTERNATIVE: Render.com + SQLite on persistent disk
```

### 12.1 Deployment Checklist

- [ ] `PEXELS_API_KEY` and `GEMINI_API_KEY` — **never in Vercel** (offline only)
- [ ] All photos committed to `/public/library/`
- [ ] `data/tags.json` committed (offline tagging output)
- [ ] `data/targets.json` committed (owner-selected)
- [ ] `GROQ_API_KEY`, `MODERATOR_PIN`, `DATABASE_URL` set in Vercel env vars
- [ ] App works at deployed URL **without login**
- [ ] Tested on a real mid-range Android phone in Chrome

---

## 13. Data Flow Diagrams

### Mode A — Plain Search

```
User types "pool" → presses Enter
  → POST /api/search { query: "pool", mode: "A" }
    → tokenise → score each photo → sort → return results
  → Render S6 results grid
  → Tap photo → S7 → "This is the photo" or "Not it"
```

### Mode B — Coach Flow

```
User types "pool"
  → 500ms debounce
  → POST /api/coach/analyze
      vagueCheck → isVague: true
      search preview → count: 18, bucket: "many"
      coachEngine → 3 questions (who / look / occasion)
  → Render S4 coach panel

User taps chip "friends" (who)
  → POST /api/coach/answer
      filter candidates → pool + friends → 7 photos
      re-rank remaining questions
  → Panel updates

User taps "Build my search"
  → POST /api/coach/compose
      Groq → "Me with friends at the pool in red swimsuits, outdoors"
  → Render S5 prompt review

User edits (optional) → presses Search
  → POST /api/search { query: "<composed prompt>" }
      Same scorer as Mode A, richer query → fewer results
  → Render S6 results
```

---

## 14. Security & Key Management

| Key | Lives in | Never in |
|---|---|---|
| `PEXELS_API_KEY` | Local `.env` only | Vercel, git |
| `GEMINI_API_KEY` | Local `.env` only | Vercel, git, browser |
| `GROQ_API_KEY` | Vercel env vars (server) | Browser, git |
| `MODERATOR_PIN` | Vercel env vars (server) | Browser, git |
| `DATABASE_URL` | Vercel env vars (server) | Browser, git |

- `.env.local` in `.gitignore` — always
- No `NEXT_PUBLIC_` prefix on any secret
- All external API calls via Next.js API routes only

---

## 15. Error Handling Strategy

| Failure | User sees | Technical action |
|---|---|---|
| Groq timeout / bad JSON | Fallback prompt, no error shown | `composer: "fallback"` logged |
| DB write failure | No disruption | Event queued in localStorage |
| DB read failure (export) | Error on admin page | HTTP 503 |
| Photo 404 | Grey placeholder | `<img onError>` handler |
| `/api/coach/analyze` timeout | Coach does not appear; search runs normally | Graceful no-op |
| `/api/search` failure | Toast + "Try again" button | Never a dead end |
| Zero results | S8 screen with retry options | Never a blank page |
| 3-min timeout | S11 task end screen | `task_end { outcome: "timeout" }` logged |

---

## 16. Testing Strategy

### Unit tests (Jest + ts-jest)

| Module | What to test |
|---|---|
| `lib/vagueCheck.ts` | All acceptance cases from spec 13.1 |
| `lib/search.ts` | Scoring, synonym expansion, multi-cue bonus |
| `lib/coachEngine.ts` | Balance score, cue deduplication, generic fallback |
| `lib/promptComposer.ts` | Fallback format, cache hit/miss |
| `lib/metrics.ts` | Query Formation Rate, time-to-find arithmetic |

### Manual acceptance tests

| Test | Expected |
|---|---|
| `pool` in Mode B | Coach appears with ≤3 questions |
| `silver racket` | Coach does NOT appear |
| Any query in Mode A | Coach NEVER appears |
| Tap chip | Candidates reduce, questions re-rank |
| "Not these" | All answers cleared, original query restored |
| "Search anyway" | Plain search with original typed text |
| GROQ_API_KEY removed | Fallback prompt produced, flow completes |
| Full session | Complete event trail, correct CSV row |

### Device testing

- Chrome on mid-range Android (primary)
- Safari on iPhone (secondary)
- Desktop Chrome at 390 px emulation

---

*End of ARCHITECTURE.md — For behaviour, see `PROBLEM_STATEMENT.md`. For layout, see `/wireframes/`.*
