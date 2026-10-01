# EDGECASES.md — Edge Case Catalog
## Pre-Search "Narrow It Down" Coach — Google Photos MVP

> **Purpose:** Every non-happy-path scenario is documented here with the correct expected behaviour. Before shipping each phase, verify the relevant section. If behaviour is unclear, defer to `PROBLEM_STATEMENT.md` section noted per case.
> **Convention:** Each case has an ID, a trigger condition, the expected behaviour, and the implementation note.

---

## Table of Contents

1. [Search Engine Edge Cases](#1-search-engine-edge-cases)
2. [Vague Check Edge Cases](#2-vague-check-edge-cases)
3. [Coach Trigger Edge Cases](#3-coach-trigger-edge-cases)
4. [Coach Engine / Question Selection Edge Cases](#4-coach-engine--question-selection-edge-cases)
5. [Chip Interaction Edge Cases](#5-chip-interaction-edge-cases)
6. [Prompt Composer Edge Cases](#6-prompt-composer-edge-cases)
7. [UI / Interaction Edge Cases](#7-ui--interaction-edge-cases)
8. [Study Mode Edge Cases](#8-study-mode-edge-cases)
9. [Event Logging Edge Cases](#9-event-logging-edge-cases)
10. [Data / Tagging Edge Cases](#10-data--tagging-edge-cases)
11. [Network & Infrastructure Edge Cases](#11-network--infrastructure-edge-cases)
12. [Security Edge Cases](#12-security-edge-cases)

---

## 1. Search Engine Edge Cases

| ID | Trigger | Expected Behaviour | Implementation Note |
|---|---|---|---|
| SE-01 | Query is empty string `""` | Return `{ results: [], count: 0, bucket: "few" }` | Guard at top of `search()` |
| SE-02 | Query is only stopwords: `"the a on"` | Return 0 results after stopword removal | Tokens array empty after normalise |
| SE-03 | Query is only self-words: `"me my i"` | Return 0 results (self-words ignored for scoring) | Self-words removed before scoring |
| SE-04 | Query is very long (200+ chars) | Normalise and score normally; no crash | No length limit needed; just tokenise |
| SE-05 | Query has special chars: `"pool!!!"` | Strip punctuation, score as `"pool"` | Regex `[^a-z0-9\s]` strip in normalise |
| SE-06 | Query has mixed case: `"Pool BEACH"` | Normalise to lowercase before scoring | `query.toLowerCase()` first step |
| SE-07 | Unknown synonym: `"xyz123"` | No expansion, score as literal | Synonym map miss = no-op |
| SE-08 | Two tokens match same field | Field counted only once for multi-cue bonus | `Set<string>` for matched fields |
| SE-09 | All photos score 0 | Return empty results, S8 shown | Standard zero-results path |
| SE-10 | `MIN_SCORE` config changed | Threshold applied correctly | Read from `config.ts`, not hardcoded |
| SE-11 | Synonym maps to multi-word: `"pool" → "swimming pool"` | Both "swimming" and "pool" added as tokens | Split synonym value into tokens |
| SE-12 | Photo has `unknown` in setting field | `"unknown"` does not match any real query token | Stopword + unknown filtering in scorer |

---

## 2. Vague Check Edge Cases

| ID | Trigger | Expected Behaviour | Implementation Note |
|---|---|---|---|
| VC-01 | Empty query | `isVague: true`, `preciseCount: 0` | Guard: empty → return vague |
| VC-02 | Query = `"me"` | Vague (`"me"` is approximation, not precise person) | Self-words are NOT precise anchors |
| VC-03 | Query = `"2023"` alone | `time anchor: true`, `preciseCount: 1`, still vague | Year alone = 1 anchor; needs 2 to be precise |
| VC-04 | Query = `"january 2022"` | `time anchor: true`, `preciseCount: 1`, still vague | Month+year = 1 anchor |
| VC-05 | Query = `"12 March 2021 pool"` | `time anchor: true` (exact date), `preciseCount ≥ 1` | Document exact behaviour in README |
| VC-06 | Query with a name NOT in people list | No person anchor | List lookup, no fuzzy matching |
| VC-07 | Query = `"birthday party outdoor sunny friends"` | Still vague (no anchors) | None of these are date/person/place |
| VC-08 | Places list is empty (MVP) | No location anchors ever match | Expected — most queries will be vague |
| VC-09 | Query = `"at the beach"` | Vague (`"the beach"` is approximate, not named place) | "beach" not in named places list |
| VC-10 | Query has newline or tab chars | Normalise whitespace first | `query.trim().replace(/\s+/g, ' ')` |
| VC-11 | Vague check called twice on same query | Same result returned | Deterministic, no state |
| VC-12 | `preciseCount` threshold changed in config | Would affect `isVague`; currently hardcoded at 2 | Note: currently not in `config.ts`; keep it there if ever changed |

---

## 3. Coach Trigger Edge Cases

| ID | Trigger | Expected Behaviour | Implementation Note |
|---|---|---|---|
| CT-01 | Mode A, any query | Coach NEVER appears | Mode check is first condition |
| CT-02 | User submits before 500ms debounce fires | Search runs plainly; coach does not appear | Abort debounce timer on submit |
| CT-03 | Query < 3 chars (e.g. `"me"`) | Coach does not appear (no real word ≥ 3 chars) | Check before debounce call |
| CT-04 | Query vague but count < 12 (e.g. `"silver racket"`) | Coach does not appear | `count < COACH_MIN_MATCHES` → skip |
| CT-05 | Coach dismissed; user adds one word to query | Coach re-evaluates (change > 1 word triggers re-show) | Track `lastDismissedQuery`; diff word count |
| CT-06 | Coach dismissed; user changes nothing | Coach does NOT re-appear | `lastDismissedQuery === currentQuery` → no re-show |
| CT-07 | Candidate set < 4 after preview search | Coach skips (nothing to split) | `candidateCount < 4` → fall to generic |
| CT-08 | Tag coverage < MIN_TAG_COVERAGE | Layer 1 generic questions shown (not library-aware) | Coverage check at analyze time |
| CT-09 | User types fast (many keystrokes) | Only ONE analyze call fires (last debounce) | Debounce correctly cancels previous timer |
| CT-10 | User pastes a long query instantly | Debounce resets on paste input event | `onChange` fires debounce reset |
| CT-11 | Analyze API call fails (500) | Coach does not appear; user can still search | Catch + swallow error; no crash |
| CT-12 | Network offline when analyze fires | Coach does not appear; search still works | Same as CT-11 |

---

## 4. Coach Engine / Question Selection Edge Cases

| ID | Trigger | Expected Behaviour | Implementation Note |
|---|---|---|---|
| QS-01 | Typed query already contains "friends" | `who` question NOT shown | Skip field if any value present in query |
| QS-02 | Typed query contains "outdoor" | `indoor_outdoor` option for "outdoor" NOT shown in `look`/`where` question | Query token match check per value |
| QS-03 | All photos have `occasion_guess: "none"` | `occasion` question not shown (coverage 0) | Coverage filter removes it |
| QS-04 | One value has 100% share (e.g. all candidates are "friends") | Balance score ≈ 0; question ranked low | Entropy of single-value distribution = 0 |
| QS-05 | All values have equal share (4 values, 25% each) | Max balance score | Entropy maximised |
| QS-06 | A field has > 4 distinct values | Show top 4 by count only + "Something else" | `sort desc, take 4` |
| QS-07 | All 3 question slots filled but user keeps typing | Questions already shown; do not re-trigger with new questions | `show once per query` rule |
| QS-08 | `occasion_basis: "none"` for all candidates | Occasion options excluded (no soft guess possible) | `occasion_basis !== "none"` filter |
| QS-09 | Candidates filtered to 0 after chip taps | Stop showing new questions; show "Build my search" only | `candidateCount === 0` → `questions: []` |
| QS-10 | Candidates ≤ `COACH_STOP_AT` (8) | Stop showing new questions | `candidateCount <= COACH_STOP_AT` → `questions: []` |
| QS-11 | Re-rank returns same order | No animation change (avoid flicker) | Hash question order; animate only on change |
| QS-12 | Two fields in same cue type (e.g. `clothing_colour` and `indoor_outdoor` both in `look`) | Only top-scoring one used per cue type | Cue-type deduplication in `selectQuestions` |

---

## 5. Chip Interaction Edge Cases

| ID | Trigger | Expected Behaviour | Implementation Note |
|---|---|---|---|
| CI-01 | User taps same chip twice | Second tap deselects it (toggle) | `aria-pressed` toggle |
| CI-02 | User selects "Something else" and types nothing | Treat as no answer for that question | Empty string answer = ignored |
| CI-03 | User types a free-text answer with special chars | Sanitise before sending to API | Strip HTML, limit length 100 chars |
| CI-04 | "I don't remember" on all 3 questions | Coach has no answers; "Build my search" still works | `answers = []`; fallback prompt = typed text |
| CI-05 | User selects chip, then selects "I don't remember" on same question | "I don't remember" wins; chip deselected | Clear chip selection on "I don't remember" tap |
| CI-06 | Chip tap fires while answer API is still loading | Debounce or queue; do not send two simultaneous calls | Lock chips during in-flight request |
| CI-07 | User taps "Not these" | All answers cleared; `answers = []`; original query shown; coach dismissed | `coach_reset` event logged |
| CI-08 | User selects a chip that removes the last candidate | `questions: []`; "Build my search" button prominent | Show message: "Narrow enough — build your search!" |
| CI-09 | "Something else" input too long | Trim to 100 chars on submit | Client-side trim |
| CI-10 | Chip text is very long (wraps) | Chip wraps, min tap target maintained | CSS `word-break: break-word`, min-height: 44px |

---

## 6. Prompt Composer Edge Cases

| ID | Trigger | Expected Behaviour | Implementation Note |
|---|---|---|---|
| PC-01 | Groq returns valid JSON but `prompt` field is missing | Fall back to deterministic | Validate response shape strictly |
| PC-02 | Groq returns prompt with invented detail not in answers | Log warning; still use fallback | Check: every word in prompt must be traceable to typed or answers |
| PC-03 | Groq returns prompt > 200 chars | Trim to 200 chars or re-request | Apply `maxLength` guard post-response |
| PC-04 | All answers are "I don't remember" | `answers = []`; prompt = typed text only | Standard empty-answers path |
| PC-05 | Typed text is blank (user cleared it) | Prompt = comma-joined answers only | Handle `typed === ""` |
| PC-06 | Duplicate values across answers (e.g. "friends" in both who and look) | De-duplicate in prompt | Set-based join |
| PC-07 | Cache key collision (extremely unlikely hash collision) | Overwrite old cache entry | Acceptable risk; cache is in-memory |
| PC-08 | Groq rate limit (429 response) | Fall back to deterministic; log `composer: "fallback"` | Catch 429 in `callGroq` |
| PC-09 | User edits textarea to empty string | "Search" button disabled or warns | Validate before submit |
| PC-10 | User removes all cue chips in S5 | Prompt becomes typed text only; search still works | Rebuild prompt from remaining chips |
| PC-11 | Groq response is HTML (misconfigured endpoint) | JSON parse fails → fallback | `JSON.parse` catch |
| PC-12 | `GROQ_MODEL` env var not set | Server startup error or fallback-only mode | Check at startup; log warning |

---

## 7. UI / Interaction Edge Cases

| ID | Trigger | Expected Behaviour | Implementation Note |
|---|---|---|---|
| UI-01 | User navigates back from results to search | Search bar shows previous query; coach state reset | Browser back — use `router.back()` or URL state |
| UI-02 | User opens two browser tabs during study | Each tab is an independent session (different sessionId) | sessionId generated client-side per page load |
| UI-03 | User rotates phone mid-session | Layout adapts; no state lost | CSS responsive; state in React context |
| UI-04 | User zooms browser to 200% | Layout may break at 200%; acceptable at 100%–150% | Only guarantee 100% design width |
| UI-05 | Photo image loads slowly | Skeleton/placeholder shown until loaded | CSS `background-color` on img container |
| UI-06 | User presses Enter in coach "Something else" input | Treat as answer submission for that field | `onKeyDown Enter` → submit answer |
| UI-07 | Study timer reaches 3 min while user is in coach panel | S11 shown immediately; coach state discarded | Timer triggers regardless of screen |
| UI-08 | User presses browser Refresh mid-task | Session ID resets; old session becomes incomplete | Log `task_end {outcome: "browser_refresh"}` via `beforeunload` |
| UI-09 | Bottom nav tapped during coach session | "Search anyway" behaviour (nav away) | Confirm dialog: "Leave this search?" — or just allow |
| UI-10 | "This is the photo" tapped on wrong photo | Logs `wrong_open` and returns to results; does NOT end task | Only "found" on the actual target ends the task |
| UI-11 | "This is the photo" tapped on correct target photo | Logs `found`, task ends, S11 shown | Target ID matched server-side |
| UI-12 | Coach appears for a query but user immediately types more | Coach dismissed; new debounce starts | Input change cancels current coach state |

---

## 8. Study Mode Edge Cases

| ID | Trigger | Expected Behaviour | Implementation Note |
|---|---|---|---|
| SM-01 | Moderator starts task but participant is not ready | "Show target" button available separately from "Start task" | Two-step: start (opens study page), then show target |
| SM-02 | Target photo is also in the library grid | Target photo visible in results — this is intentional | Do not hide target from library |
| SM-03 | Moderator closes console tab mid-task | Task continues on participant's device unaffected | Moderator console is separate session |
| SM-04 | Two tasks same participant, same target | Event logs separated by sessionId | sessionId unique per task |
| SM-05 | Task end: user does not submit survey | `task_end` fires on timeout; survey optional after that | Log `task_end` on timer; survey fires `survey_answered` separately |
| SM-06 | `targets.json` not found | Moderator console shows error; cannot start study | Validate file exists at startup |
| SM-07 | Participant finds a photo that looks correct but is not the target | Logs `wrong_open` (not `found`) | Only the exact target file triggers `found` |
| SM-08 | Participant finds photo before 5-second reveal ends | Not possible — search page only opens after reveal | 5-second reveal strictly gated |
| SM-09 | Moderator accidentally clicks "End task" early | `task_end {outcome: "moderator_end"}` logged; S11 shown | Add confirmation dialog on "End task" |
| SM-10 | No targets in `targets.json` | Moderator console shows "No targets available" | Guard in moderator page |
| SM-11 | Study run without moderator console (URL direct) | `/study?pid=P01&mode=B&target=T03` works | Both paths must work per spec |

---

## 9. Event Logging Edge Cases

| ID | Trigger | Expected Behaviour | Implementation Note |
|---|---|---|---|
| EL-01 | DB is unreachable when event fires | `{ ok: true }` returned; event queued in localStorage | Never block user; fire-and-forget |
| EL-02 | localStorage full | Drop oldest queued events; log current event | Check quota; trim queue to last 50 events |
| EL-03 | Network back online mid-session | Queued events flushed in order | On next successful `/api/log`, send queue |
| EL-04 | Two events fire simultaneously (race) | Both logged; order by `ts` in DB | Parallel POSTs both accepted |
| EL-05 | Event `ts` is client clock (may be wrong) | Use client `ts` for sequence; DB `created_at` for actual time | Store both; use DB timestamp for analysis |
| EL-06 | Same event fired twice (double-tap) | Both logged; de-dup in analysis if needed | Acceptable; mark with same `sessionId` and `ts` |
| EL-07 | `query_typed` fires for every debounce snapshot | Can be many events per session | Only the final query before submit is critical; `query_typed` is informational |
| EL-08 | `vague_check` event fired in Mode A | Should NOT fire (coach analyze not called in Mode A) | Mode check before calling analyze |
| EL-09 | Export CSV with 0 events | Returns CSV with headers only, no data rows | Guard in export handler |
| EL-10 | Export CSV with 1000+ events | Should complete in < 5 seconds | Paginate or stream if needed |

---

## 10. Data / Tagging Edge Cases

| ID | Trigger | Expected Behaviour | Implementation Note |
|---|---|---|---|
| DT-01 | Photo file in `/public/library/` has no entry in `tags.json` | Photo still appears in grid; not searchable by tags | Show photo; search returns score 0 for it |
| DT-02 | `tags.json` entry has `null` values | Skip null fields in scoring | Null guard in scorer per field |
| DT-03 | `tag_coverage` < 90% | Coach Layer 2 disabled; Layer 1 generic only | Check coverage at server start |
| DT-04 | `occasion_guess` is valid but `occasion_basis` is `"none"` | Occasion NOT shown as chip option | Filter at question-selection time |
| DT-05 | `clothing` array is empty | No clothing chips shown | Empty array → no clothing options |
| DT-06 | `people_count: 0` but `group_type: "friends"` | Contradiction — trust `group_type` for chips; note in README | Tag normalisation should catch this |
| DT-07 | Gemini returns `clothing` as string instead of array | Normalisation step converts to array | `Array.isArray(t.clothing) ? t.clothing : [t.clothing]` |
| DT-08 | Pexels rate limit hit during download | Script sleeps 1s between calls; exits cleanly on 429 | `time.sleep(1)` + retry once |
| DT-09 | Pexels returns a photo already downloaded (duplicate ID) | Skip duplicate | `seen` set check in download script |
| DT-10 | `targets.json` references a file not in `/public/library/` | Moderator console shows warning per missing target | Validate on startup |
| DT-11 | Gemini API key invalid during tagging | Script exits with clear error message | `try/except` with meaningful message |
| DT-12 | Re-running tagging script overwrites `tags.json` | Old entries preserved for unprocessed files | Merge mode: only re-tag files not already in `tags.json` |

---

## 11. Network & Infrastructure Edge Cases

| ID | Trigger | Expected Behaviour | Implementation Note |
|---|---|---|---|
| NW-01 | Vercel cold start (serverless) | First request slow (~500ms extra); subsequent fast | Acceptable; coach budget is 1s total |
| NW-02 | Supabase connection pool exhausted | DB write fails; event queued in localStorage | Connection pool limit in Supabase free = 60; more than enough |
| NW-03 | Groq API down | Fallback composer used; `composer: "fallback"` | No user-visible error |
| NW-04 | User on 2G (very slow connection) | Photos load slowly; coach may time out | Image size ≤ 300KB; all logic in-memory except Groq |
| NW-05 | CORS error on `/api/*` routes | Next.js handles CORS for same-origin by default | No extra config needed; all API calls are same-origin |
| NW-06 | Vercel function timeout (10s default) | Only Groq compose could approach this; timeout at 3s | `GROQ_TIMEOUT_MS = 3000` well within Vercel limit |
| NW-07 | Deploy breaks existing DB schema | Migrations must be additive only | Append columns only; never rename/drop |
| NW-08 | `DATABASE_URL` env var not set in Vercel | Startup warning; events fall back to localStorage only | Guard at startup; warn in console |

---

## 12. Security Edge Cases

| ID | Trigger | Expected Behaviour | Implementation Note |
|---|---|---|---|
| SEC-01 | Client tries to call Groq directly | Impossible — key is server-side only | `GROQ_API_KEY` never in response |
| SEC-02 | Someone discovers moderator PIN | They can access study controls — low risk in this context | PIN is simple protection, not bank-level auth |
| SEC-03 | XSS via free-text chip input | Input sanitised before rendering | Use React's default escaping; avoid `dangerouslySetInnerHTML` |
| SEC-04 | SQL injection via event payload | Supabase parameterised queries prevent this | Use Supabase client, not raw SQL |
| SEC-05 | Admin CSV endpoint without PIN | 401 returned | Check `Authorization` header server-side |
| SEC-06 | API key committed to git | `.env.local` in `.gitignore`; check with `git log --all` | Run `git log -p -- .env.local` before first push |
| SEC-07 | Someone manipulates `mode` param in URL | They can switch modes — acceptable for a prototype | Not a security issue; study logs record the mode |
| SEC-08 | Pexels API key in `/public/` or client bundle | Should never happen | Key only used in offline script, not in Next.js |
| SEC-09 | `targets.json` reveals study photos early | `targets.json` is committed; participants could theoretically read it | Acceptable — study relies on trust/protocol, not technical blinding |

---

## Priority Tier Summary

When time is short, fix edge cases in this order:

**🔴 Tier 1 — Fix before user testing (show-stoppers):**
CT-01, CT-02, CT-09, PC-04, SM-02, SM-08, EL-01, SEC-06

**🟡 Tier 2 — Fix before deploy:**
SE-01, SE-02, VC-02, QS-09, CI-04, UI-07, UI-08, EL-03

**🟢 Tier 3 — Fix if time permits:**
CI-09, PC-06, UI-04, DT-07, DT-12, NW-04

**⚪ Tier 4 — Document as known limitation, don't fix:**
UI-04 (200% zoom), SM-09 (moderator end-early), DT-09 (Pexels duplicate)

---

*End of EDGECASES.md*
