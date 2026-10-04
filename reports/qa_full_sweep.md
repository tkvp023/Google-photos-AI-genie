# Full QA Sweep Audit Report: Google Photos AI Genie MVP

> **Audit Type:** Rigorous Product, Engineering, and Security Audit (Non-destructive, Audit Only)  
> **Environment:** Windows 11 x64, Node.js v24.19.0, Next.js 16.3.8, React 19.2.8  
> **Target App:** Google Photos AI Genie MVP (`Gp2 solution`)  
> **Date of Audit:** October 4, 2026  
> **Master QA Execution Command:** `npx tsx scripts/qa/run_all_qa.ts`  

---

## 1. Executive Summary

| Stage | Focus Area | Status | PASS | FAIL / DEV | BLOCKED |
|---|---|:---:|:---:|:---:|:---:|
| **Stage 1** | Build & Existing Test Suites | **PASS with Warnings** | 24 | 1 | 0 |
| **Stage 2** | Data Integrity & Schemas | **DEVIATIONS** | 7 | 2 | 0 |
| **Stage 3** | Search & Vague Check | **FAIL / DEVIATIONS** | 5 | 3 | 0 |
| **Stage 4** | Trigger & Questions Engine | **DEVIATIONS** | 15 | 31 | 0 |
| **Stage 5** | UI & Accessibility | **BLOCKED (Screenshots) / AUDITED (DOM)** | 6 | 2 | 1 |
| **Stage 6** | Study Flow & Event Logging | **PASS / DEVIATIONS** | 6 | 1 | 0 |
| **Stage 7** | Resilience & Security | **CRITICAL VULNERABILITY** | 5 | 1 | 0 |
| **Stage 8** | Performance & Deployment Readiness | **PASS / BLOCKED (Deploy URL)** | 5 | 0 | 1 |
| **Stage 9** | Documentation Accuracy | **DEVIATIONS** | 2 | 6 | 0 |
| **TOTALS** | **Comprehensive MVP Sweep** | **OVERALL: NO-GO** | **75** | **47** | **2** |

### One-Paragraph Verdict
The Google Photos AI Genie MVP showcases exceptional core engineering, sub-10ms search retrieval, zero-leak path traversal protection, robust concurrent event logging (30/30 parallel posts captured), and dynamic Shannon-entropy question generation. However, **the prototype is rated NO-GO for running real participant sessions**. Three primary blockers must be resolved first: (1) **Mode A is completely inaccessible in the UI** because `src/app/search/page.tsx:21` and `src/app/results/page.tsx:66,73` hardcode `mode = "B"`, which renders unassisted A/B comparison impossible; (2) **The secret moderator PIN is exposed in client browser bundles** via default `useState` initialization in `src/app/moderator/page.tsx:13`; and (3) **Rule C is severely violated** by proposing cast names (Meera, Rohan) for generic queries like "pool", surfacing up to 3 metadata rows and 0 memory cues instead of the mandatory 2+ memory cues.

---

## 2. Findings Table

| ID | Stage | Severity | Expected Behavior | Actual Behavior | Evidence / Output | Suspected File & Function | Reproduction Steps |
|---|:---:|:---:|---|---|---|---|---|
| **F-01** | Stage 7 / 1 | **BLOCKER** | Client bundles must never contain secrets or the moderator PIN (Rule H). | Literal `MODERATOR_PIN` is hardcoded as default state in client React component and compiled into `.next/static` chunks (`0cz1d0mv5g_q7.js`, `1jdd5rn2cfe4b.js`). | Grep hit in `.next/static`: `const [pin, setPin] = useState("[REDACTED]")` | `src/app/moderator/page.tsx:13` | Run `npx tsx scripts/qa/qa_resilience_security.ts` step 3. |
| **F-02** | Stage 5 / 6 | **BLOCKER** | Mode A (`?mode=A`) must run unassisted plain search without AI Genie strip or coach calls (Rule F, B). | Search and Results pages hardcode `mode: "A" \| "B" = "B"`, ignoring `searchParams.get("mode")`. Mode A cannot be accessed by study participants in the UI. | `const mode: "A" \| "B" = "B";` | `src/app/search/page.tsx:21`<br/>`src/app/results/page.tsx:66,73` | Navigate to `http://localhost:3000/search?mode=A` in browser; observe Mode B Genie strip triggers. |
| **F-03** | Stage 4 | **BLOCKER** | Rule C: "no cast-name row unless the typed text contains a name; at least 2 rows are memory cues; max 1 row is metadata". | For "pool", coach proposes WHO = `cast_people` (Meera, Rohan), WHERE = `place_city`, WHEN = `time_period`.surfaces 3 metadata rows and 0 memory cues. | `Original 'pool' questions: place_city:[...] \| cast_people:[...] \| time_period:[...]` | `src/lib/coachEngine.ts:308, 320-405` (`selectQuestions`) | Run `npx tsx scripts/qa/qa_genie.ts`; observe Rule C violations on 29/46 queries. |
| **F-04** | Stage 2 / 6 | **MAJOR** | Committed `data/events.json` must be empty `[]` before study launch; no simulation events (Rule I). | `data/events.json` in git HEAD contains 159 mock/test events from previous pipeline runs. | `data/events.json contains 159 events` | `data/events.json` | Run `npx tsx scripts/qa/qa_data.ts` section 6. |
| **F-05** | Stage 3 | **MAJOR** | Strict Monotonicity: adding a content word must never increase `count_strong` (Rule E). | 11 monotonicity violations detected out of 300 queries (e.g. `summer` has 0 strong, but `summer graduation` has 20 strong matches). | `Monotonicity VIOLATION: "summer" (0) -> "summer graduation" (20)` | `src/lib/search.ts:311-340`<br/>`src/lib/timeParser.ts` | Run `npx tsx scripts/qa/qa_search.ts` section 3. |
| **F-06** | Stage 6 | **MAJOR** | CSV export must contain `trigger_blocked_reason` and `hint_shown` (Rule G). | CSV export headers lack `trigger_blocked_reason` and `hint_shown`. | `MISSING FIELDS IN CSV: trigger_blocked_reason, hint_shown` | `src/lib/metrics.ts:568-625` (`metricsToCsv`) | Run `npx tsx scripts/qa/qa_study_logging.ts` section 5. |
| **F-07** | Stage 3 | **MAJOR** | Time parser must support relative anchor "earlier" with soft-range decay (Rule E, Stage 3). | `parseTimeQuery("pool earlier")` returns `null`; "earlier" is completely unhandled in `timeParser.ts`. | `FAIL: Could not parse time phrase: "earlier"` | `src/lib/timeParser.ts:53-150` (`parseTimeQuery`) | Run `npx tsx scripts/qa/qa_search.ts` section 4. |
| **F-08** | Stage 3 | **MAJOR** | Theme word "road trip" must return >= 10 Tier-1 matches in theme roadtrip. | "road trip" matches 26 photos in Tier 3 and 0 in Tier 1 because photos are tagged with "road" or "roadtrip", but not "trip". | `Query: "road trip" -> Total: 26, Tier-1: 0` | `data/tags.json`<br/>`src/lib/search.ts` | Run `npx tsx scripts/qa/qa_search.ts` section 1. |
| **F-09** | Stage 4 / 5 | **MINOR** | Rule D: "X dismisses" strip. | The 'X' dismiss button was removed in prior turns to make Genie "always on". Strip cannot be manually dismissed. | Absence of dismiss button in `CoachStrip.tsx:60-72` | `src/components/coach/CoachStrip.tsx` | Inspect `CoachStrip.tsx`. |
| **F-10** | Stage 5 | **MINOR** | Micro-typography: no font under 14 px. | `CoachStrip.tsx` uses `text-[11px]` for cue labels and `text-[12px]` for caption text (chips themselves are 14 px). | `className="text-[11px] font-semibold text-[#8f7e73]"` | `src/components/coach/CoachStrip.tsx:107` | Inspect `CoachStrip.tsx` CSS classes. |
| **F-11** | Stage 7 | **MINOR** | API routes should enforce rate limits and restrict CORS where appropriate. | CORS is set to `*` on all API endpoints; no rate limiting is configured on `/api/search` or `/api/coach/analyze`. | `CORS = *, RateLimit = None` | `src/app/api/*/route.ts` | Run `npx tsx scripts/qa/qa_resilience_security.ts` section 4. |
| **F-12** | Stage 5 / 8 | **BLOCKED** | Live browser screenshot capture across viewports (390x844, 360x740, 1280x800). | Playwright driver binary download returned HTTP 404 from Microsoft Azure CDN on Windows x64. | `Playwright driver 404: https://playwright.azureedge.net/builds/driver/playwright-1.57.0-win32_x64.zip` | Browser Tool / Environment | Invoked `browser_subagent`. User authorized marking live screenshots BLOCKED. |
| **F-13** | Stage 8 | **BLOCKED** | Live smoke test against deployed production URL (`scripts/smoke_test_deployed.py`). | `process.env.DEPLOYED_URL` is unset; no public production URL provided. | `DEPLOYED_URL: NOT SET` | Environment Configuration | Run `npx tsx scripts/qa/qa_perf_deployment.ts` section 5. |
| **F-14** | Stage 9 | **MINOR** | Documentation claims "100-photo library", older trigger thresholds (`strong >= 15`), and "Edited search" pill. | `README.md` and `MASTER_PROJECT_DOCUMENTATION.md` contain stale claims from older iterations. | README: "curated 100-photo library" (actual: 200 photos). | `README.md:3`, `MASTER_PROJECT_DOCUMENTATION.md:53` | View `README.md`. |
| **F-15** | Stage 2 | **MINOR** | Tags vocabulary should strictly adhere to controlled sets. | 19 unknown setting values (e.g. `studio`, `school`, `volcano`), 2 non-controlled group types (`crowd`, `group`), and 1 bucket (`none`). | `Unknown setting values: studio, school, volcano...` | `data/tags.json` | Run `npx tsx scripts/qa/qa_data.ts` section 2. |

---

## 3. Trigger and Questions Matrix & Hard-Coding Verdict

Detailed query-by-query breakdown is published in [qa_genie_matrix.md](file:///c:/Users/THARUN/Videos/Gp2%20solution/reports/qa_genie_matrix.md).

### Summary of Matrix Results:
- **Total Queries Evaluated:** 46 queries
- **Trigger Decisions:**
  - Simple Trigger Mode (`COACH_TRIGGER_MODE=simple`): Accurately triggers on all 19 MUST TRIGGER queries (including `me in a restaurant`, `restaurant`, `dinner`, `family picnic`, `kids park`). Accurately suppresses on `me`, `po`, `""`, `elephant`, `asdfgh`, `12 March 2021 Goa pool`, and Mode A queries.
  - Older Strict Gate Comparison: Blocked **25 valid vague queries** (e.g. `dinner`, `family picnic`, `festival`, `graduation`, `cake`, `sunset`, `backpack`) due to `count_strong >= 15` and `ambiguous_count >= 12` hurdles.
- **Rule C Violations (29 queries):**
  - **Cast Name Leakage:** Surfacing cast names (`Meera`, `Rohan`, `Ananya`) under WHO when no name was typed.
  - **Metadata Dominance:**Surfacing 2 to 3 metadata rows (`place_city`, `cast_people`, `time_period`) and 0 to 1 memory cues instead of the mandatory $\ge 2$ memory cues.

### Relevance Proof & Hard-Coding Audit Verdict
1. **Coach Strip Relevance:**
   - Codebase search confirmed that question generation in `coachEngine.ts` computes Shannon entropy across candidate distributions dynamically. **No hardcoded query-to-chip lookup tables exist in the coach path.**
   - **Perturbation Test:** Shuffling photo tags in memory dynamically shifted top question rows from `place_city` to `clothing_color` and `activity` (**VERDICT: DATA-DRIVEN**).
2. **Hard-coded Text Discovered in Results Screen:**
   - In `src/app/results/page.tsx:22-45`, function `getAiExplanation` contains literal hardcoded strings keyed to terms like `"medal"`, `"certificate"`, `"little me"`, `"marksheet"`, and `"spanish"`. One string explicitly references a real personal name: *"You can see Tharun Krisshna receiving a certificate..."*. This function is used exclusively for the explanatory banner on S6, not for coach chips.

---

## 4. Intended vs. Actual Scorecard (Rules A to I)

| Rule | Area | Intended Specification | Actual Codebase Behavior | Status |
|---|---|---|---|:---:|
| **A** | **Vague Check** | Precise anchors in $< 2$ of 3 filters (Person, Time, Location). Typed text only. | Fully compliant. Accurately flags `pool` (0), `pool goa` (1), `12 March 2021 Goa pool` (2, not vague). | **OK** |
| **B** | **Trigger** | Mode B only, content word $\ge 3$, vague, candidates $\ge 6$, no-match caption. | Trigger logic works accurately in simple mode. However, the older strict mode blocked 25 queries, and the 'X' dismiss was removed. | **DEVIATES** |
| **C** | **Questions** | $\le 3$ rows, distinct cues, $\ge 2$ memory cues, $\le 1$ metadata row, no cast names unless typed. | Surfaces cast names without typed names; surfaces up to 3 metadata rows and 0 memory cues for queries like `pool`. | **DEVIATES** |
| **D** | **Chips** | Tap appends phrase with `", "`, untap cleans commas, row replace works, manual re-sync, 'X' dismiss. | Text appending, untapping, row replacement, and input re-sync function cleanly. 'X' dismiss button is missing. | **DEVIATES** |
| **E** | **Search** | Stemming, stopwords, 3 tiers, strict monotonicity (more words never increase `count_strong`). | Deterministic, identical results. However, 11 monotonicity violations occur on temporal/setting queries (`summer` vs `summer graduation`). "road trip" has 0 Tier-1 matches. "earlier" is unparsed. | **DEVIATES** |
| **F** | **Study Flow** | 5s target reveal with vague hint, 180s timer, S11 survey, Mode A unassisted vs Mode B coach. | Logic exists in `/study`, but Mode A cannot be accessed in the UI because `search/page.tsx:21` hardcodes `mode = "B"`. | **DEVIATES** |
| **G** | **Logging** | Full telemetry CSV: `first_typed_text`, `is_vague`, `trigger_blocked_reason`, `hint_shown`, `narrowing_ratio`, etc. | CSV exports 19 of 21 required columns; missing `trigger_blocked_reason` and `hint_shown`. Concurrency safe (30/30). | **DEVIATES** |
| **H** | **Security** | PIN only via Bearer or POST body; refuse if unset; no secrets in client bundles. | Bearer authentication & unset checks pass. However, literal `MODERATOR_PIN` is leaked into `.next/static` bundles via `moderator/page.tsx:13`. | **DEVIATES** |
| **I** | **No Simulated Data** | `data/events.json` empty `[]`, no `study_export_final.csv`, sim script archived. | `study_export_final.csv` removed, simulation script archived. However, `data/events.json` in HEAD contains 159 mock events. | **DEVIATES** |

---

## 5. Not Verified List

1. **Automated Live Browser Screenshots (Stage 5):**
   - *Reason:* The `browser_subagent` encountered a `404 Not Found` failure when downloading the Playwright driver binary from Microsoft Azure CDN (`https://playwright.azureedge.net/builds/driver/playwright-1.57.0-win32_x64.zip`) on Windows x64.
   - *Alternative Audit Applied:* Complete source code, JSX structure, ARIA accessibility attributes, CSS styles, and component logic were thoroughly inspected and validated statically in `CoachStrip.tsx`, `PromptReview.tsx`, `SearchContent`, and `ResultsContent`.
2. **Deployed Live Production URL Smoke Test (Stage 8):**
   - *Reason:* `process.env.DEPLOYED_URL` was unset in the local environment.
   - *Status:* Marked **BLOCKED: "no public URL"** as mandated by audit instructions. Local production build (`npm run start`) on port 3000 was audited instead.

---

## 6. GO / NO-GO Verdict & Actionable Remediation Plan

### Verdict: **NO-GO FOR PARTICIPANT SESSIONS**

The application must **NOT** be launched for real study participant sessions until the following **5 Blockers** are addressed. They are ordered by engineering effort (smallest first):

```
+---------------------------------------------------------------------------------------------------------+
|                                    PRIORITIZED BLOCKER RESOLUTION                                      |
+----+---------------------------------------------------+----------+-------------------------------------+
| #  | Blocker Description                               | Effort   | Target File & Remediation           |
+----+---------------------------------------------------+----------+-------------------------------------+
| 1. | Reset committed events storage to empty array     | 1 min    | data/events.json                    |
|    | (Ensure events.json is committed as [])           |          | Overwrite with [] before study run  |
+----+---------------------------------------------------+----------+-------------------------------------+
| 2. | Remove secret PIN from client bundle state        | 2 mins   | src/app/moderator/page.tsx:13       |
|    | (Prevent leaking moderator PIN to client users)   |          | Change useState("[PIN]") to ("")    |
+----+---------------------------------------------------+----------+-------------------------------------+
| 3. | Fix hardcoded Mode B in search & results UI       | 5 mins   | src/app/search/page.tsx:21          |
|    | (Allow participants to test unassisted Mode A)    |          | src/app/results/page.tsx:66,73      |
|    |                                                   |          | Read searchParams.get("mode")       |
+----+---------------------------------------------------+----------+-------------------------------------+
| 4. | Add missing Rule G columns to CSV export          | 15 mins  | src/lib/metrics.ts:568-625          |
|    | (Include trigger_blocked_reason and hint_shown)   |          | Add columns to headers and rows map |
+----+---------------------------------------------------+----------+-------------------------------------+
| 5. | Enforce Rule C memory cue constraints in Coach    | 20 mins  | src/lib/coachEngine.ts:320-405      |
|    | (No cast names unless typed; max 1 metadata row;  |          | Prioritize look/what/occasion/mood; |
|    | require >= 2 memory cues)                         |          | restrict cast_people & place_city   |
+----+---------------------------------------------------+----------+-------------------------------------+
```

---

## 7. Data Safety Verification & Checksums

As required by the audit charter, the persistent event database was locked and protected throughout the sweep.

| Checkpoint | File Path | SHA256 Hash | Status |
|---|---|---|:---:|
| **Baseline Checksum** | `data/events.json` | `81EC23406895589E68AB9BF9AC6DB1564C9216B0805AE26AA09CD178AA15D78E` | Recorded |
| **Final Checksum** | `data/events.json` | `81EC23406895589E68AB9BF9AC6DB1564C9216B0805AE26AA09CD178AA15D78E` | **MATCH (100% UNCHANGED)** |
| **Temp Isolation Dir** | `%TEMP%\gp2_temp_data` | Isolated temp directory used for all logging and server tests | Confirmed Isolated |
