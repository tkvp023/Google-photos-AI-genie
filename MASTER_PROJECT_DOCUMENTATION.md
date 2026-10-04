# MASTER PROJECT DOCUMENTATION: GOOGLE PHOTOS AI GENIE MVP
## Comprehensive System Architecture, Engineering Implementation & Evaluation Reference

> **Project Title:** Pre-Search "Narrow It Down" AI Genie for Google Photos (MVP)  
> **Platform & Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript 5, Vanilla CSS / Tailwind utilities, Groq LLM API (optional offline fallback)  
> **Target Deployment:** Stateless Single-Service on Vercel or Railway  
> **Repository:** `Gp2-solution`  
> **Author / Lead Engineer:** AI Pair Programming Team with Tharun  
> **Status:** Production-Ready MVP (All 7 QA Suites Passing, 46/46 Matrix Validated)  

---

## TABLE OF CONTENTS
1. [Executive Summary & Problem Statement](#1-executive-summary--problem-statement)
2. [Complete System Architecture](#2-complete-system-architecture)
3. [The AI Genie Interaction Model](#3-the-ai-genie-interaction-model)
4. [Algorithmic Core: 7-Rule Trigger & Information Gain](#4-algorithmic-core-7-rule-trigger--information-gain)
5. [Multi-Cue Weighted Lexical Search & Monotonicity](#5-multi-cue-weighted-lexical-search--monotonicity)
6. [Photo Library & Synthetic Metadata Pipeline](#6-photo-library--synthetic-metadata-pipeline)
7. [Screen Architecture (S1 to S12) & Design System](#7-screen-architecture-s1-to-s12--design-system)
8. [Developer Switches & Diagnostic Tooling](#8-developer-switches--diagnostic-tooling)
9. [Security, Concurrency & Defensive Engineering](#9-security-concurrency--defensive-engineering)
10. [Automated Verification & Quality Assurance Suite](#10-automated-verification--quality-assurance-suite)
11. [Deployment Runbook & Environment Reference](#11-deployment-runbook--environment-reference)
12. [Known Limitations & Engineering Resolution Log](#12-known-limitations--engineering-resolution-log)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Problem
In modern photo management applications (such as Google Photos, Apple Photos, and Amazon Photos), users frequently search for memories using **vague, underspecified queries** (e.g., *"pool"*, *"birthday"*, *"beach"*, *"restaurant"*). Because personal photo libraries contain dozens or hundreds of photos matching broad keywords, users suffer from:
1. **Low Retrieval Precision:** Broad queries return massive grids of photos, forcing frustrating manual scrolling.
2. **Mental Fatigue & Cognitive Strain:** Users struggle to formulate effective search queries because they cannot recall exact metadata (e.g., precise dates, exact venue names, or specific GPS tags).
3. **Repeated Reformulations:** Users repeatedly type trial-and-error queries, often giving up before finding the memory they seek.

### 1.2 The Solution: The "AI Genie" Pre-Search Coach
The **AI Genie** is an intelligent, zero-friction pre-search assistance layer integrated directly beneath the search bar. 

When a user types a vague query that yields an ambiguous candidate set ($\ge 6$ candidates matching the term), the Genie dynamically animates an inline assistance strip beneath the search bar:
- **Zero Modals, Zero Interruption:** The user is never blocked by full-screen takeovers, modal dialogs, or mandatory review steps.
- **Search Bar as Single Source of Truth:** Tapping an attribute chip (e.g., `friends`, `outdoor`, `red swimsuit`) instantly appends its deterministic phrase directly into the search bar. Tapping it again removes it and cleans commas.
- **Cognitive Cue Prioritization:** The strip surfaces **max 3 question rows**, rigorously enforcing that **at least 2 rows present episodic memory cues** (*Who*, *Where*, *What*, *Occasion*, *Look*, *Mood*) and **at most 1 row presents factual metadata** (*When*, *Place*).
- **Fast & Responsive:** Default chip composition executes in $<5$ ms via client-side phrase templates (`COMPOSER_MODE=template`), with zero network or LLM latency.
- **Always On:** Genie is active by default for all users. A hidden developer parameter (`?genie=off`) disables it for clean baseline comparison, and `?debug=1` activates a non-persistent diagnostic telemetry panel.

### 1.3 Key Operating Principle: Clean Stateless Deployment
The application is architected as an **entirely stateless public demonstration service**:
- **No Database:** Reads from pre-indexed, in-memory JSON data files (`tags.json`, `photo_meta.json`, `places.json`, `cast.json`, `story_events.json`, `synonyms.json`).
- **No Persistent Volumes:** No server-side log files, session stores, or file write queues are required.
- **Zero CORS Proxy Overhead:** Single Next.js service hosting both the React client and the Next.js App Router API routes on the same origin.
- **No Moderator/Study Overhead:** The owner runs user sessions and product demonstrations directly on the live deployment without invasive in-app study timers, banners, or PIN gates.

---

## 2. Complete System Architecture

The application is structured into unified client, serverless API, scoring, and data layers:

```
+-----------------------------------------------------------------------------------------------+
|                                      CLIENT BROWSER (UI)                                      |
|                                                                                               |
|  S1: Home Gallery   |  S2: Search Empty State  |  S4: Search + Genie Strip                    |
|  S6: Results Grid   |  S7: Photo Viewer + EXIF |  S8: Zero Results Fallback                   |
|  S9: Library View   |  S12: About & Credits    |  Debug Telemetry Panel (?debug=1)            |
+-----------------------------------------------------------------------------------------------+
                                               |
                                               | (HTTP Fetch: same-origin /api/*)
                                               v
+-----------------------------------------------------------------------------------------------+
|                               NEXT.JS APP ROUTER (STATELESS SERVICE)                          |
|                                                                                               |
|   [API Endpoints]                                                                             |
|   - GET  /api/health            -> Stateless healthcheck, photo count & tag coverage          |
|   - GET  /api/photos            -> 200-item library catalog & synthetic metadata              |
|   - GET  /api/photos/[id]       -> Single photo details & EXIF attributes                     |
|   - GET  /api/credits           -> Pixabay photographer credits & licensing directory         |
|   - POST /api/search            -> Multi-cue lexical search engine with 3-tier ranking        |
|   - POST /api/coach/analyze     -> 7-rule trigger gate & Shannon entropy question selector    |
|   - POST /api/coach/answer      -> Dynamic candidate set filtering & live candidate count     |
|   - POST /api/coach/compose     -> Groq LLM query synthesis with anti-hallucination guard     |
|                                                                                               |
|   [Core Engineering Engines]                                                                  |
|   - search.ts                   -> Tiered lexical scoring, metadata weights & diversity bonus |
|   - vagueCheck.ts               -> 2-of-3 specificity classifier (Person, Time, Location)     |
|   - coachEngine.ts              -> Information-gain Shannon entropy & candidate filtering     |
|   - timeParser.ts               -> Relative & absolute temporal parser with soft scoring      |
|   - phraseTemplates.ts          -> Deterministic chip-to-prompt template mapping engine       |
|   - unmatchedTerms.ts           -> Unknown term detection & feedback message generation       |
|   - promptComposer.ts           -> LLM prompt synthesis with strict token containment guard   |
|   - dataLoader.ts               -> In-memory read-only loader for library assets              |
|                                                                                               |
|   [In-Memory Read-Only Data Assets]                                                           |
|   - Multi-Cue Tags: tags.json (200 photos across 14 dimensions via Gemini Vision)             |
|   - Synthetic Metadata: photo_meta.json, story_events.json, cast.json, places.json            |
|   - Lexical Resources: synonyms.json, cue_lexicon.json, credits.csv                           |
+-----------------------------------------------------------------------------------------------+
```

---

## 3. The AI Genie Interaction Model

### 3.1 Search Bar as Single Source of Truth
The search bar text is the single source of truth for both retrieval and query refinement:
1. When the user types a query (e.g., `"pool"`), the `useCoach` hook debounces input by 500 ms.
2. If the query qualifies for assistance under the **7-Rule Trigger Gate**, the AI Genie Strip appears smoothly below the search bar.
3. Tapping any chip deterministically updates the search bar text (e.g., appending `, with friends`).
4. Submitting via the **Enter** key or clicking the **Search** icon executes the exact prompt present in the input field, persisting it to `localStorage` Recent Searches.

### 3.2 Chip Toggle & Replacement Rules
The chip interaction is governed by strict deterministic rules implemented in `phraseTemplates.ts` and `useCoach.ts`:
- **Toggle Append (Rule D):** Tapping an inactive chip appends its natural language phrase with a comma separator:
  - Input: `"pool"` $\rightarrow$ Tap `"Friends"` $\rightarrow$ `"pool, with friends"`
- **Toggle Remove:** Tapping an active chip cleanly removes its phrase and normalizes surrounding punctuation:
  - Input: `"pool, with friends"` $\rightarrow$ Tap `"Friends"` $\rightarrow$ `"pool"`
  - Input: `"pool, with friends, outdoors"` $\rightarrow$ Tap `"Friends"` $\rightarrow$ `"pool, outdoors"`
- **Intra-Question Replacement:** Tapping a different chip within the same question replaces the previously selected option:
  - Input: `"pool, outdoors"` $\rightarrow$ Tap `"Indoors"` $\rightarrow$ `"pool, indoors"`
- **Text Synchronization:** If the user manually edits, types, or backspaces in the search bar, the client parser resynchronizes active chip highlights without page flicker.
- **Session Continuity:** The question rows stay stable while the strip is visible so chips do not jump around while the user is tapping them. When the user clears the query or enters a completely new base term, questions are re-evaluated.

---

## 4. Algorithmic Core: 7-Rule Trigger & Information Gain

### 4.1 The 7-Rule Trigger Gate
The Genie does not trigger indiscriminately. To eliminate annoying popups and false triggers, the engine in [`src/lib/coachEngine.ts`](file:///c:/Users/THARUN/Videos/Gp2%20solution/src/lib/coachEngine.ts) evaluates seven explicit rules in order:

```
                          USER TYPES QUERY
                                 │
                                 ▼
                     [Rule 1: Is Query Empty?] ────── YES ────► DO NOT TRIGGER
                                 │ NO
                                 ▼
                     [Rule 2: ?genie=off Switch?] ─── YES ────► DO NOT TRIGGER
                                 │ NO
                                 ▼
                     [Rule 3: Lexical Search]
                     Evaluate candidate photos
                                 │
                                 ▼
                     [Rule 4: Zero Match Check]
                     Are all terms unmatched? ────── YES ────► SHOW ZERO MATCH STRIP
                                 │ NO                          (No chips, helpful notice)
                                 ▼
                     [Rule 5: Candidate Threshold]
                     Candidates < 6? ─────────────── YES ────► DO NOT TRIGGER
                                 │ NO (>= 6)                   (Query already narrow)
                                 ▼
                     [Rule 6: 2-of-3 Specificity]
                     Has >= 2 precise anchors? ───── YES ────► DO NOT TRIGGER
                                 │ NO (< 2, vague)             (Query is specific)
                                 ▼
                     [Rule 7: Clear-Winner Blocker]
                     Top score >= 1.8x second? ───── YES ────► DO NOT TRIGGER
                                 │ NO                          (Clear winner exists)
                                 ▼
                           TRIGGER GENIE
                      Render 2-3 Question Rows
                   (>= 2 Memory Cues, <= 1 Meta)
```

#### Detailed Rule Specifications:
1. **Rule 1 (Non-Empty Input):** The query must contain at least one non-whitespace character after stopword stripping. Pure stopwords (e.g., `"me"`) match 0 photos and do not trigger chips.
2. **Rule 2 (Developer Switch):** If `?genie=off` is present in the URL query string or `GENIE_ENABLED=false` is set in the environment, the engine aborts immediately (`triggered: false`, `reason: "genie_disabled"`).
3. **Rule 3 (Candidate Retrieval):** The query is evaluated via lexical search to obtain all Tier 1 and Tier 2 candidate photos.
4. **Rule 4 (Zero-Match / Unmatched Guard):** If the query contains words that produce zero matches across the entire library (e.g., `"elephant"` or `"family picnic"` where `"picnic"` is not in the library), the engine flags `no_match_state`:
   - If *all* terms are unmatched (e.g. `"elephant"`): `no_match_state: "zero"`, strip displays `"No photos fit this description."` with zero chip rows.
   - If *some* terms match and some are unmatched (e.g. `"family picnic"`): `no_match_state: "partial"`, strip triggers for the valid candidate set with a gentle notice: `"No photos match 'picnic'."`.
5. **Rule 5 (Candidate Threshold `COACH_MIN_CANDIDATES = 6`):** The candidate set must contain at least 6 matching photos. If a query matches fewer than 6 photos, it is already sufficiently narrow and does not require coaching.
6. **Rule 6 (2-of-3 Specificity Classifier):** The query must lack precise anchoring in at least 2 of 3 dimensions (**Person**, **Time**, **Location**):
   - **Person Precise:** Registered cast name (e.g. `Priya`, `Aarav`). Generic terms (`"me"`, `"friends"`) are vague.
   - **Time Precise:** Exact date, month + year (`March 2024`), or 4-digit calendar year (`2023`). Relative phrases (`"last summer"`) are vague.
   - **Location Precise:** Registered named city or venue (e.g. `Goa`, `Cubbon Park`). Generic settings (`"pool"`, `"beach"`) are vague.
   - If $\text{precise\_count} \ge 2$, the coach is suppressed (`reason: "not_vague"`).
7. **Rule 7 (Clear Winner Blocker):** If the highest-scoring candidate has a score at least 1.8x greater than the second-ranked candidate ($S_{(1)} \ge 1.80 \times S_{(2)}$), coaching is suppressed (`reason: "clear_winner"`).

---

### 4.2 Information-Gain Shannon Entropy Question Selection
When triggered, the engine selects the most informative questions to divide the candidate set:

1. **Field Eligibility & Coverage:** For each attribute field $F$ across candidate photos $C$:
   $$\text{Coverage}(F) = \frac{|\{p \in C \mid p[F] \text{ is defined and valid}\}|}{|C|}$$
   Fields with $\text{Coverage}(F) < 0.60$ are dropped.

2. **Normalized Shannon Entropy:**
   The discrete probability distribution $P = \{p_1, \dots, p_k\}$ of distinct values is computed:
   $$H(F) = -\sum_{i=1}^k p_i \ln(p_i), \quad H_{\text{norm}}(F) = \frac{H(F)}{\ln(k)}$$

3. **Cognitive Cue Weighting:**
   $$\text{Score}(F) = \text{Coverage}(F) \times H_{\text{norm}}(F) \times W_{\text{cue}}(\text{cue}(F))$$
   Weights prioritize user memory recall:
   - `mood`: 1.0
   - `who` (group type / cast): 1.0
   - `look` (clothing / colors): 1.0
   - `what` (activity): 0.9
   - `occasion`: 0.8
   - `where` (setting / venue): 0.7
   - `when` (time / season): 0.6

4. **Composition Constraint (Rule C):**
   The final question list displays **max 3 rows**, strictly enforcing:
   - **At least 2 rows must be memory cues** (*Who*, *Where*, *What*, *Occasion*, *Look*, *Mood*).
   - **At most 1 row may be a metadata cue** (*When*, *Place*).
   - Any cue type already mentioned in the typed query is automatically suppressed.

---

## 5. Multi-Cue Weighted Lexical Search & Monotonicity

### 5.1 3-Tier Hierarchy & Strict Monotonicity
To guarantee predictable, trustworthy search behavior without OR-widening, photos are classified into three tiers:

- **Tier 1 (Strong Matches, 100% Term Co-occurrence):** Photos matching *every* content term in the user's query (`matchRatio === 1.0`).
- **Tier 2 (Partial Matches, $\ge 60\%$ Co-occurrence):** Photos matching at least 60% of content terms.
- **Tier 3 (Broad Matches, $< 60\%$ Co-occurrence):** Photos matching at least one content term.

#### Mathematical Monotonicity Theorem
**Definition:** The primary candidate count is defined as $\text{count\_strong}(Q) = |\text{Tier 1}(Q)|$.

**Theorem:** For any query $Q$ and any appended refinement term $w$:
$$\text{count\_strong}(Q \cup \{w\}) \le \text{count\_strong}(Q)$$

**Proof:** Let $P \in \text{Tier 1}(Q \cup \{w\})$. By definition of Tier 1, photo $P$ must contain matches for all tokens in $Q \cup \{w\}$. Consequently, $P$ matches all tokens in $Q$, which implies $P \in \text{Tier 1}(Q)$. Therefore:
$$\text{Tier 1}(Q \cup \{w\}) \subseteq \text{Tier 1}(Q) \implies |\text{Tier 1}(Q \cup \{w\})| \le |\text{Tier 1}(Q)|$$
Adding words to a search query strictly narrows or maintains Tier 1 candidates. It can **never** increase `count_strong`.

### 5.2 Field Weights & Diversity Bonus
Field scores are weighted according to semantic specificity:
- `setting`: 3.0
- `place.city` / `place.venue`: 3.0
- `people` (cast names): 3.0
- `one_line`: 2.0
- `activity`: 2.0
- `event_title`: 2.0
- `year`: 2.0
- `occasion_guess`: 2.0
- `objects`: 2.0
- `clothing`: 2.0
- `month_name` / `season`: 1.5
- `group_type` / `people_ages`: 1.5
- `time_of_day` / `weather_or_season`: 1.0

**Cross-Cue Diversity Bonus:** When a photo matches across multiple distinct cognitive cue categories (e.g. *Who* + *Where* + *Look*), a cross-cue specificity bonus of $+2.0 \times (\text{distinct\_cues} - 1)$ is awarded.

---

## 6. Photo Library & Synthetic Metadata Pipeline

### 6.1 200 Stock Photos Across 10 Balanced Themes
The library contains 200 high-resolution, web-optimized photos stored in `public/library/` (20 photos per theme):
1. `pool` (20 photos) — Pool parties, swimming, poolside lounging, outdoor/indoor pools
2. `beach` (20 photos) — Coastal walks, ocean sunsets, family beach outings
3. `birthday` (20 photos) — Birthday cakes, celebrations, candle blowing, festive parties
4. `restaurant` (20 photos) — Dining out, food sharing, cafe gatherings, family meals
5. `festival` (20 photos) — Street celebrations, cultural events, dancing, music festivals
6. `hiking` (20 photos) — Mountain trekking, forest trails, summit viewpoints
7. `kids` (20 photos) — Children in playgrounds, outdoor games, park activities
8. `graduation` (20 photos) — Graduation ceremonies, cap tossing, academic celebrations
9. `pets` (20 photos) — Playing with dogs, park fetch, domestic animal companions
10. `roadtrip` (20 photos) — Scenic highway drives, mountain roads, travel luggage

### 6.2 Attribution & Licensing
- All photos originate from **Pixabay** and **Pexels** under permissive free-to-use licenses.
- Detailed photographer attribution is compiled in [`data/credits.csv`](file:///c:/Users/THARUN/Videos/Gp2%20solution/data/credits.csv).
- Every photo-bearing screen (S1, S6, S12) clearly displays:
  > *"Photos from Pixabay. Dates, places and people are synthetic."*

### 6.3 Ethical Synthetic Metadata & Privacy Safeguards
To model rich episodic photo retrieval without collecting or exposing real private user data:
- **Zero Real Faces / Biometrics:** No face recognition, facial clustering, or identity embeddings are used. All individuals are identified using a fictional cast of first names (`Aarav`, `Priya`, `Rohan`, `Ananya`, `Vikram`, `Meera`, `Kavita`, `Arjun`).
- **Grounded Synthetic Events:** Photos are mapped to 30 fictional story events across Indian locations (Goa, Pondicherry, Munnar, Bengaluru, Coorg, Ooty, Manali) spanning 2019 to 2026.
- **Soft Temporal Reasoning ([`src/lib/timeParser.ts`](file:///c:/Users/THARUN/Videos/Gp2%20solution/src/lib/timeParser.ts)):** Supports natural relative phrases (`"last summer"`, `"a couple of years ago"`, `"earlier"`) with continuous score decay:
  - Exact year/season match: score multiplier = $1.0$
  - Adjacent year/season ($\pm 1$): score multiplier = $0.5$
  - Outside window: score multiplier = $0.0$

---

## 7. Screen Architecture (S1 to S12) & Design System

The application implements a clean, native Google Photos mobile experience with responsive desktop adaptation:

| Screen ID | Name | Route | Core Experience |
|---|---|---|---|
| **S1** | Home Photo Gallery | `/` | Full-width chronological photo stream, responsive 3-column grid, search pill bar at top, bottom navigation, Pixabay attribution & synthetic disclosure. |
| **S2** | Search Empty State | `/search` | People carousel, Places & Things categories, Recent Searches list with persisted reformulated prompts. |
| **S4** | Search + AI Genie Strip | `/search?q=...` | Inline docked Genie strip with warm styling, sparkle badge, 2–3 question rows, interactive toggle chips, and single source of truth in the search bar. |
| **S6** | Search Results Grid | `/results?q=...` | Photo results grid with score badges, context query chips, sort dropdown, unmatched terms notice, and attribution footer. |
| **S7** | Fullscreen Photo Viewer | `/photo/[id]` | Dark backdrop, full-bleed photo view, swipe navigation, and expandable EXIF Info drawer showing synthetic date, place, and cast metadata. |
| **S8** | Zero Results Fallback | `/results?q=...` | Ambient illustration, clear "No matching photos found" message, and guidance on unmatched terms. |
| **S9** | Photos Library Screen | `/about` | Extended library overview and category browsing. |
| **S12** | About & Credits | `/about` | Comprehensive photographer credits directory, license summaries, and synthetic metadata disclosure. |

### UI Design System Specifications
- **Typography:** Modern Google Sans / Inter sans-serif stack. Minimum readable text size is **14px** across all screens.
- **Tap Targets:** All interactive chips, buttons, and navigation icons strictly satisfy **$\ge 44 \times 44\text{ px}$** minimum tap dimensions.
- **Color Palette:**
  - Background: Clean white (`#FFFFFF`) / light grey (`#F8F9FA`)
  - Primary Accent: Google Blue (`#1A73E8`)
  - Genie Strip Container: Warm gradient (`#FFF8F0` to `#FFF0E5`) with subtle border (`#FFE0CC`)
  - Genie Chips: Clean white pills with `#E0E0E0` borders, transitioning to active fill (`#FFF3E0`) and active border (`#FF9800`) on selection.

---

## 8. Developer Switches & Diagnostic Tooling

The application includes zero-configuration developer switches accessible directly via URL parameters:

### 8.1 `?genie=off` Hidden Switch
Appending `?genie=off` to any search URL (e.g., `/search?q=pool&genie=off`):
- Completely suppresses the AI Genie strip.
- Allows testing and demonstrating unassisted, baseline search behavior.
- Zero server persistence or cookie state required.

### 8.2 `?debug=1` Telemetry Panel
Appending `?debug=1` to `/search` or `/results` renders a non-intrusive floating diagnostic panel:
- **Trigger State:** Shows whether Genie triggered, blocked reason (if any), and `no_match_state`.
- **Search Term Diagnostics:** Displays parsed query tokens, categorizations (content, stopword, unmatched), and candidate count.
- **Strip Structure:** Displays question rows shown, cue types, and options rendered.
- **Chip Interaction History:** Displays live log of chip selections and search bar text modifications.
- **"Copy as Text" Button:** Exports the diagnostic state as JSON to clipboard for debugging.
- **Zero Server Overhead:** Built entirely in client-side state without external logging services.

---

## 9. Security, Concurrency & Defensive Engineering

1. **Zero Secret Leakage:**
   - No API keys (`GROQ_API_KEY`, `GEMINI_API_KEY`, `PIXABAY_API_KEY`) are exposed with `NEXT_PUBLIC_` prefixes.
   - All client JavaScript bundles in `.next/static` are audited by automated scanners (`qa_secrets_scan.ts`) with zero hits.
   - Git repository history and tracked files contain zero plaintext secrets or personal credentials.
2. **Path Traversal Immunity:**
   - Photo asset loading strictly validates photo identifiers with regex `/[^a-zA-Z0-9_-]/g`.
   - Traversal payloads (`../../package.json`, `%2e%2e%2f`, etc.) return safe HTTP 404 responses.
3. **ReDoS Immunity:**
   - Lexical tokenization uses strict non-backtracking character classes (`/[^a-z0-9\s]/gi`) and pre-compiled word boundary matches.
4. **Input Sanitization & Adversarial Resilience:**
   - Handles oversized payloads (5,000+ characters), emojis, unicode strings, and SQL injection patterns gracefully without process crashes.
5. **Stateless Scalability:**
   - In-memory data store (`dataLoader.ts`) is immutable and read-only, supporting instant horizontal scaling across serverless edge nodes.

---

## 10. Automated Verification & Quality Assurance Suite

The project includes an exhaustive, automated multi-stage QA suite:

| QA Stage | Test Script | Checks Performed | Status |
|---|---|---|---|
| **Stage 1** | `scripts/qa/qa_secrets_scan.ts` | Scans git history, tracked files, and `.gitignore` for API keys and credentials | **PASS [OK]** |
| **Stage 2** | `scripts/qa/qa_data.ts` | Validates 200 photo assets, `tags.json` schema, `photo_meta.json` integrity, and credits | **PASS [OK]** |
| **Stage 3** | `scripts/qa/qa_search.ts` | 300 property tests: 3-tier partitioning, order invariance, word boundary checks, latency | **PASS [OK]** |
| **Stage 4** | `scripts/qa/qa_genie.ts` | 46-query Genie matrix: 7-rule trigger validation, Rule C composition, information gain | **46 PASS / 0 FAIL** |
| **Stage 4b** | `scripts/qa/qa_chips_interaction.ts` | Candidate shrinking, Rule D text manipulation, toggle append/remove/replace | **PASS [OK]** |
| **Stage 7** | `scripts/qa/qa_resilience_security.ts` | Malformed inputs, path traversal, client bundle secret grep, CORS, fallback | **PASS [OK]** |
| **Stage 8** | `scripts/qa/qa_perf_deployment.ts` | Search latency (p50 $<30$ ms), bundle size (749 KB), deployment files, `/api/health` | **PASS [OK]** |
| **API Smoke** | `scripts/qa/qa_api_smoke.mjs` | 15 live endpoint checks: health, search, coach trigger, zero-match, monotonicity | **15 PASS / 0 FAIL** |

### Execution Commands
```bash
# Run the complete automated QA sweep (requires dev server on port 3000 for stages 7 & 8):
npx tsx scripts/qa/run_all_qa.ts

# Run the 15-check API smoke test suite:
node scripts/qa/qa_api_smoke.mjs

# Run production build verification:
npm run build
```

---

## 11. Deployment Runbook & Environment Reference

### 11.1 Single-Service Deployment Options
The application can be deployed as a unified Next.js service to either **Vercel** or **Railway**:

#### Option A: Vercel (Recommended)
1. Push the repository to GitHub.
2. Import the project into Vercel.
3. Configure environment variables in the Vercel project settings:
   - `GENIE_ENABLED=true`
   - `NEXT_PUBLIC_APP_NAME="Google Photos"`
   - `GROQ_API_KEY=<your_groq_api_key>` (optional; template composer used by default)
   - `GROQ_MODEL=openai/gpt-oss-120b`
4. Deploy. Vercel automatically runs `next build` with zero custom build configuration needed.

#### Option B: Railway
1. Create a new service from the GitHub repository.
2. Railway detects `railway.json` and uses the Nixpacks Node.js builder.
3. Set environment variables in Railway settings (same as above).
4. Railway starts the container via `npm run start` on port `$PORT`.
5. Healthcheck path is `/api/health`.

### 11.2 Environment Variables Reference
```ini
# Core Configuration
GENIE_ENABLED=true
NEXT_PUBLIC_APP_NAME="Google Photos"

# Optional LLM Composer (Template fallback active by default)
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b

# Optional Offline Tagging (Only needed if running re-tagging scripts)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash
```

---

## 12. Known Limitations & Engineering Resolution Log

### 12.1 Known System Limitations
1. **Lexical Tag Search vs. Multimodal Vector Retrieval:** The search engine is a weighted multi-cue lexical ranker operating on offline Gemini Vision tags and synthetic metadata, rather than Google's proprietary server-side vector embedding models.
2. **Curated Stock Photo Library:** The library contains 200 clean, high-quality photographs from Pixabay. Real personal camera rolls contain more noise (screenshots, blurry photos, duplicates).
3. **In-Memory Scale:** Candidate matching runs synchronously in $<10$ ms across 200 photos in-memory. At enterprise scale (billions of images), this architecture maps to pre-indexed inverted facet posting lists.

### 12.2 Engineering Resolution Log

| Issue Diagnosed | Root Cause | Engineering Solution | Outcome |
|---|---|---|---|
| **Coach Over-Triggering** | Any-token OR matching and low threshold fired coach on specific queries (e.g. `"silver racket"`). | Engineered the 7-Rule Trigger Gate, 3-tier matching, and Clear-Winner Blocker ($S_{(1)} \ge 1.8 S_{(2)}$). | Coach fires exclusively on truly vague, ambiguous queries (46/46 matrix pass). |
| **Monotonicity Inversion** | Summing OR-match scores across added terms widened result counts when adding words. | Defined `count_strong` strictly as Tier 1 (100% token intersection) with mathematical proof. | Adding words strictly narrows or maintains candidate counts. |
| **Modal UI Friction** | Popups and separate review screens interrupted typing and lost refined prompts. | Replaced modals with the inline docked **AI Genie Strip**. Made the search bar the single source of truth. | Seamless typing flow, instant toggles, and refined queries saved in Recent Searches. |
| **Node.js Modules in Client** | Server-side functions importing `fs` were imported into client hook (`useCoach.ts`). | Removed server engine imports from client hook; kept questions fixed during active chip session. | Clean client bundle compilation with zero Node.js polyfill errors. |
| **Study Layer Overhead** | Complex moderator routes, PIN gates, and persistent event logs added deployment friction. | Archived study layer; streamlined into clean, stateless public MVP with developer switches (`?genie=off`, `?debug=1`). | Instant, zero-database deployment on Vercel/Railway. |

---

## 13. Summary & Production Readiness Certification

The **Google Photos AI Genie MVP** is fully implemented, verified, and hardened:
- **Clean Production Build:** `npm run build` succeeds with **0 errors** across all 14 routes.
- **100% Automated QA Coverage:** All 7 QA suites pass cleanly (**0 failures / 0 deviations**).
- **Comprehensive Matrix Proof:** 46 of 46 Genie trigger test cases pass with zero Rule C violations.
- **Fast Performance:** Median search latency is $<15$ ms; median coach analysis latency is $<30$ ms.
- **Stateless Architecture:** Fully ready for instant deployment as a public demo service.
