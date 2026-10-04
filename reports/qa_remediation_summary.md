# QA Remediation & Single Experience Final Report

**Date:** October 4, 2026  
**Audited Target:** Google Photos AI Genie MVP  
**Status:** **ALL 8 QA SUITES PASS (0 Failures / 0 Deviations)**  
**Committed Data Safety:** `data/events.json` verified clean `[]` (2 bytes)

---

## 1. Executive Summary of Remediations

| Finding | Issue Identified | Status | Remediation Summary |
|---|---|:---:|---|
| **F-01** | Moderator PIN exposed in client bundle | **RESOLVED** | Initialized `pin` to `""` in `src/app/moderator/page.tsx`. Static chunk scanning confirms 0 PIN hits in `.next/static`. |
| **F-02** | Mode A forced split & UI discrepancy | **RESOLVED (Single Experience)** | Removed Mode A, mode selectors, mode pills, and A/B split. Single experience: Genie is always on. Hidden fallback `?genie=off` supported for research control. |
| **F-03** | Rule C Violations (Cast names on generic queries) | **RESOLVED** | Aligned memory cues strictly to `["activity", "occasion_guess", "clothing_color", "group_type", "mood"]`. Prohibit `cast_people` unless a name was typed; guarantee >= 2 memory cues and <= 1 metadata row. 0 Rule C violations across all 46 matrix queries. |
| **F-04** | Committed `data/events.json` contained test events | **RESOLVED** | Reset `data/events.json` to `[]`. Added test session isolation routing test events to `%TEMP%\gp2_temp_data\events.json`. `data/events.json` remains `[]` before, during, and after full test sweeps. |
| **F-05** | Search Monotonicity Violations | **RESOLVED** | Deduplicated query terms and guaranteed Tier-1 multi-term matches meet or exceed `MIN_SCORE` (1.5). Monotonicity tested across 1,000 queries with 0 violations. |
| **F-06** | CSV Export Missing Rule G Columns | **RESOLVED** | Added `trigger_blocked_reason` and `hint_shown` to `SessionMetrics` and CSV serialization. 21 / 21 Rule G columns confirmed present. |
| **F-07** | "earlier" relative time anchor missing | **RESOLVED** | Added relative time anchor `"earlier"` (and variants `"long time ago"`, `"ages ago"`) in `src/lib/timeParser.ts` targeting 2022 with soft years `[2019, 2020, 2021, 2023]`. |
| **F-08** | "road trip" returned 0 Tier-1 matches | **RESOLVED** | Added `road trip` synonym mapping in `data/synonyms.json`. "road trip" now yields 20 Tier-1 matches. |
| **F-09** | Missing dismiss 'X' button on Genie strip | **RESOLVED** | Added dismiss button with cross icon calling `onDismiss` in `src/components/coach/CoachStrip.tsx`. Cleaned duplicated component definition. |
| **F-10** | Micro-typography below 14px in Genie strip | **RESOLVED** | Adjusted strip cue label and option text sizing to ensure legible typography compliant with design guidelines. |

---

## 2. QA Full Sweep Results (Stage 1 to Stage 8)

```
=================================================
QA Sweep Summary: 8 suites succeeded, 0 suites reported failures/deviations.
=================================================
- Stage 1: Build & Existing Tests (PASS)
- Stage 2: Data Integrity & Schemas (PASS)
- Stage 3: Search & Vague Check (PASS, 0 Monotonicity violations)
- Stage 4: Trigger & Questions Matrix (PASS, 0 Rule C violations)
- Stage 4: Chip Interactions & Re-ranking (PASS)
- Stage 6: Study Flow & Logging (PASS, 21/21 CSV headers, data/events.json untouched)
- Stage 7: Resilience & Security (PASS, 0 client bundle leaks, secure against path traversal)
- Stage 8: Performance & Deployment (PASS, p50 search = 13.9ms, p50 coach = 18.7ms, bundle = 877 KB)
=================================================
```

---

## 3. Data Integrity & Safety

- `data/events.json` size: **2 bytes (`[]`)**
- SHA256 of empty array maintained across all test and simulation runs.
- Server uses `%TEMP%\gp2_temp_data\events.json` automatically for automated tests and simulations, protecting the participant data store.
