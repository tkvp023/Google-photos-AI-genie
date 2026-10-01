# DECISIONS_LOG.md — Architecture Decision Records
## Pre-Search "Narrow It Down" Coach — Google Photos MVP

> **Purpose:** Every significant design or technology choice is recorded here with its rationale.
> This prevents re-litigating decisions mid-build and gives future contributors context.
> **Format:** ADR (Architecture Decision Record) — lightweight version.

---

## ADR-001 — Framework: Next.js App Router

**Date:** Oct 1 2026  
**Status:** Accepted

**Context:**  
Need a framework that supports both a React frontend and server-side API routes in one project, deployable easily without a separate backend.

**Decision:**  
Use **Next.js 14+ with App Router**. API routes in `src/app/api/`. Frontend pages in `src/app/`.

**Rationale:**
- Single repo, single deploy
- API routes keep all secrets server-side (no client exposure)
- Vercel native deployment — zero config
- TypeScript support built-in
- App Router (RSC) allows cleaner data fetching patterns

**Rejected alternatives:**
- Vite + Express: two separate services to deploy
- Remix: less familiar, smaller community docs for this use case
- Pure SPA + Supabase edge functions: more complex key management

**Trade-offs:**
- Cold starts on Vercel serverless (~200ms) — acceptable given 1s coach budget

---

## ADR-002 — Styling: Tailwind CSS

**Date:** Oct 1 2026  
**Status:** Accepted

**Context:**  
Need fast, consistent mobile-first styling. Spec explicitly mentions Tailwind.

**Decision:**  
Use **Tailwind CSS** with custom design tokens for Google Photos-like aesthetics.

**Rationale:**
- Spec-specified (section 11.1)
- Utility classes → fast iteration on 6-day deadline
- No custom CSS file maintenance burden
- Works seamlessly with Next.js

**Trade-offs:**
- Longer className strings
- No visual polish of custom CSS animations by default → supplement with custom `@keyframes` in `globals.css`

---

## ADR-003 — Database: Supabase (Postgres) with SQLite fallback

**Date:** Oct 1 2026  
**Status:** Accepted

**Context:**  
Events must persist across deploys. Need a free, managed database. No user data → simple schema.

**Decision:**  
Use **Supabase free tier** for production. **SQLite** (via `better-sqlite3`) for local dev.

**Rationale:**
- Supabase: managed Postgres, free tier sufficient, easy connection string
- SQLite: zero setup for local dev, same schema runs on both
- `DATABASE_URL` env var determines which driver is used
- Events are append-only → no complex transaction needs

**Rejected alternatives:**
- PlanetScale: MySQL, free tier discontinued
- Firebase Realtime DB: non-relational, harder CSV export
- MongoDB Atlas: overkill for flat event log
- SQLite on Render: viable alternative if Supabase has issues

**Switch to Render + SQLite if:**  
Supabase connection is unreliable → Render.com free tier with persistent disk + SQLite

---

## ADR-004 — LLM: Groq for runtime prompt composition

**Date:** Oct 1 2026  
**Status:** Accepted

**Context:**  
Need fast LLM for composing a 25-word natural language prompt from the user's typed text + tapped answers. Budget: 3000ms.

**Decision:**  
Use **Groq** (OpenAI-compatible API) with a current Llama 3 instruct model.

**Rationale:**
- Groq inference is fastest available (tokens/second >> OpenAI/Gemini)
- OpenAI-compatible API → easy swap if Groq has issues
- Free tier sufficient for study sessions
- JSON mode reliable on Llama 3 instruct

**Rejected alternatives:**
- OpenAI GPT-4o: slower, more expensive, overkill for 25-word output
- Gemini (runtime): spec explicitly says "do not call Gemini at runtime"
- Anthropic Claude: no JSON mode guarantee, no free tier

**Fallback:**  
Deterministic comma-join always available. Groq failure is transparent to user.

---

## ADR-005 — LLM: Gemini Flash vision for offline tagging

**Date:** Oct 1 2026  
**Status:** Accepted

**Context:**  
Need to extract structured metadata from ~100 photos. Done once, offline. Quality matters more than speed.

**Decision:**  
Use **Gemini Flash vision** with `response_mime_type: "application/json"`.

**Rationale:**
- Strong vision understanding
- JSON mode → structured output without parsing fragility
- Spec explicitly requires Gemini for tagging
- Free quota sufficient for ~100 photos

**Trade-offs:**
- Gemini model names change frequently → use `GEMINI_MODEL` env var, not hardcoded
- Must verify current model name in AI Studio before running

---

## ADR-006 — Search Engine: Weighted lexical scoring (no AI at runtime)

**Date:** Oct 1 2026  
**Status:** Accepted

**Context:**  
Both Mode A and Mode B must use the same search function. Any difference in results must come from the query, not the search. Needs to be fast and deterministic.

**Decision:**  
Weighted token matching across tag fields, with multi-cue bonus. No ML, no embeddings.

**Rationale:**
- Spec requirement: "both modes call the same function" (section 5)
- Deterministic → reproducible results, no variance between sessions
- Fast: in-memory lookup, no network call
- Explainable: field weights and match reasons are visible in debug mode

**Optional upgrade:**  
`SEARCH_MODE=embeddings` flag available (spec section 5.3) but default off. Only activate if lexical search clearly fails on natural-language prompts during testing.

**Field weights rationale:**

| Weight | Fields | Why |
|---|---|---|
| 3 | `setting` | Most specific locator (pool, beach) |
| 2 | `one_line`, `activity`, `occasion`, `objects`, `clothing` | Scene descriptors |
| 1.5 | `group_type`, `people_ages` | Person descriptors |
| 1 | `mood`, `weather`, `time_of_day`, `text` | Atmospheric, less specific |

---

## ADR-007 — Coach: No AI at question selection time

**Date:** Oct 1 2026  
**Status:** Accepted

**Context:**  
Coach must appear within ~1 second after 500ms debounce. Cannot afford an LLM call.

**Decision:**  
All question selection is **in-memory computation** — entropy/balance scoring on tag field distributions.

**Rationale:**
- 1-second budget after debounce → no time for LLM call
- Spec explicitly says "No AI" for question selection (section 2.6 table)
- Deterministic → consistent behaviour for study comparison
- Library is small (~100 photos) → computation is trivially fast

**How it works:**  
Balance score = coverage × normalised entropy × cue weight. Top 3 questions with distinct cue types selected.

---

## ADR-008 — State Management: React built-ins (no Redux/Zustand)

**Date:** Oct 1 2026  
**Status:** Accepted

**Context:**  
Need to manage coach state machine, session state, and study timer.

**Decision:**  
Use `useState`, `useReducer`, and `useContext` only. No external state library.

**Rationale:**
- App is not complex enough to justify Redux/Zustand
- 6-day deadline → adding a new library costs setup + learning time
- Next.js App Router already has good data fetching patterns
- Coach state machine fits cleanly in `useReducer`

**State split:**
- Coach state → `useCoach` hook (local to search page)
- Study session → `useStudySession` hook + React Context (available across screens)
- Event queue → module-level Map in `eventLogger.ts`

---

## ADR-009 — Photo Naming: `<theme>_<nn>.jpg`

**Date:** Oct 1 2026  
**Status:** Accepted

**Context:**  
Need a consistent, human-readable naming convention for ~100 photos.

**Decision:**  
`<theme>_<nn>.jpg` where `nn` is zero-padded 2-digit index. Example: `pool_01.jpg`.

**Rationale:**
- Theme visible in filename → easy manual review
- Sort by filename gives predictable order
- Matches the download script output
- Used as the photo `id` (without `.jpg`) throughout the app

---

## ADR-010 — Event Logging: Client-side + server-side hybrid

**Date:** Oct 1 2026  
**Status:** Accepted

**Context:**  
Events must never block the user. DB write can fail. Events must survive brief network outages.

**Decision:**  
Client calls `POST /api/log` → server writes to DB. On client failure → `localStorage` queue → flush on next success.

**Rationale:**
- Fire-and-forget: `/api/log` always returns `{ok: true}` even on DB failure
- localStorage queue ensures events survive brief offline periods
- Simple pattern, no message queue infrastructure needed
- Acceptable data loss: if browser tab is closed while offline AND Supabase is down → events lost. Probability during a 3-min study task: very low.

---

## ADR-011 — Vague Check: Rule-based, no AI

**Date:** Oct 1 2026  
**Status:** Accepted

**Context:**  
Need to detect whether a query is "vague" (lacks precise anchors). Must be instant and free.

**Decision:**  
Pure rule-based: regex for time anchors, list lookup for person/location anchors. `isVague = preciseCount < 2`.

**Rationale:**
- Spec requirement (section 6)
- In this MVP library, there are no real dates, named people, or named places → almost all queries will be vague → expected and correct

**Implication:**  
`places.json` and `people` lists are empty in the MVP. This means `preciseCount` will almost always be 0 or 1, so `isVague: true` for most queries. This is the intended behaviour for testing.

---

## ADR-012 — Mobile Design Width: 390px

**Date:** Oct 1 2026  
**Status:** Accepted

**Context:**  
The app is primarily used on smartphones during the study. Desktop is a secondary concern.

**Decision:**  
390 px max-width, centred on desktop. All layout decisions made for 390 px first.

**Rationale:**
- 390 px = iPhone 14 Pro / most mid-range Android widths
- Spec requirement (section 9.1)
- Study participants will use a phone
- Desktop just shows the 390 px frame centred on a grey background

---

## ADR-013 — No Mode C for MVP

**Date:** Oct 1 2026  
**Status:** Accepted

**Context:**  
Spec mentions Mode C (chips after submit) as a stretch goal.

**Decision:**  
Do **not** build Mode C unless all other phases are done by Oct 5 (day 5) with a full day of buffer.

**Rationale:**
- Tight deadline
- Mode C adds complexity without being required for the primary study
- Cut polish, not testing time (spec rule)
- Add to "Known limitations" in README

---

## ADR-014 — Groq Response Caching: In-memory Map

**Date:** Oct 1 2026  
**Status:** Accepted

**Context:**  
Same query + same answers may be sent multiple times (e.g. user goes back and rebuilds). Groq calls cost latency.

**Decision:**  
In-memory `Map<hash, result>`. Cache lives for the duration of the server process.

**Rationale:**
- Supabase-based persistent cache would add complexity
- Study sessions are short (3 min each); cold start between sessions is fine
- Cache key: `sha256(typedQuery + sortedAnswers)`
- On Vercel cold start: cache is empty — acceptable

---

## ADR-015 — Occasion Chips: Soft guess (with "?")

**Date:** Oct 1 2026  
**Status:** Accepted

**Context:**  
Occasion tags are AI guesses based on visual clues. They can be wrong. Showing them as facts would mislead the user.

**Decision:**  
Occasion options display with "?" suffix. e.g. "Birthday?" not "Birthday". Only shown if `occasion_basis !== "none"`.

**Rationale:**
- Spec requirement (section 7.3)
- Epistemically honest — the AI is guessing, not knowing
- Study participants should not be misled by confident wrong guesses

---

## Open Decisions (resolve before Phase 3)

| Question | Options | Deadline |
|---|---|---|
| Should the coach panel be a bottom sheet or an inline card? | Follow wireframe when received from Tharun | When wireframes arrive |
| Single-select or multi-select per chip question? | Spec says "default single-select" (S4 spec) | Phase 3 start |
| Should the 3-min timer be visible to the participant or only the moderator? | Spec says timer in moderator console; participant may feel pressured if shown | Phase 4 start |
| SQLite or Supabase for local dev? | SQLite (no setup) vs Supabase (parity with prod) | Phase 1 |

---

*End of DECISIONS_LOG.md*
