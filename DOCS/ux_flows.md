# UX_FLOWS.md — Screen-by-Screen Interaction Flows
## Pre-Search "Narrow It Down" Coach — Google Photos MVP

> **Source of truth for layout:** wireframes in `/wireframes/`  
> **Source of truth for behaviour:** `PROBLEM_STATEMENT.md`  
> **This document:** exact interaction flows, transitions, and state rules per screen.

---

## Table of Contents

1. [Global Layout & Navigation](#1-global-layout--navigation)
2. [S1 — Photos Home](#2-s1--photos-home)
3. [S2/S3 — Search (Empty → Typing)](#3-s2s3--search-empty--typing)
4. [S4 — Coach Panel](#4-s4--coach-panel)
5. [S5 — Prompt Review](#5-s5--prompt-review)
6. [S6 — Results Grid](#6-s6--results-grid)
7. [S7 — Photo Viewer](#7-s7--photo-viewer)
8. [S8 — Zero Results](#8-s8--zero-results)
9. [S9 — Moderator Console](#9-s9--moderator-console)
10. [S10 — Target Reveal](#10-s10--target-reveal)
11. [S11 — Task End Survey](#11-s11--task-end-survey)
12. [S12 — About & Credits](#12-s12--about--credits)
13. [Full Flow Diagrams](#13-full-flow-diagrams)
14. [Animation & Transition Spec](#14-animation--transition-spec)
15. [Toast & Feedback System](#15-toast--feedback-system)

---

## 1. Global Layout & Navigation

### Frame
- Max-width: **390 px**, centred horizontally on desktop with a grey background outside
- All content within this 390 px frame
- Font: **Roboto** or **Inter** from Google Fonts
- Light theme, white background, `#202124` text (Google-style near-black)

### Bottom Navigation Bar
- Fixed to bottom of frame
- Height: **56 px**
- 4 tabs:

| Tab | Icon | Route | Behaviour |
|---|---|---|---|
| Photos | Grid icon | `/` | Active on S1 |
| Search | Magnifier icon | `/search` | Active on S2/S3/S4/S5 |
| Collections | *(placeholder)* | — | Tap → "Not part of this prototype" toast |
| Library | *(placeholder)* | — | Tap → "Not part of this prototype" toast |

- Active tab: filled icon + primary colour label
- Tapping an already-active tab: no action

### Top App Bar
- Height: **56 px**
- Left: generic **"Photos"** wordmark (no Google logo)
- Right: avatar placeholder (no functionality)
- Hidden on search screens (search bar takes its place)

---

## 2. S1 — Photos Home

**Route:** `/`

### Layout
```
[ Top app bar: "Photos" wordmark | avatar ]
[ Photo grid: 3 columns, square cells, 2px gap ]
[ Bottom nav ]
```

### States

| State | Trigger | Behaviour |
|---|---|---|
| Loading | Initial page load | Skeleton grid (grey rectangles) shown until `/api/photos` returns |
| Loaded | API returns | Grid renders ~100 photos |
| Error | API fails | "Unable to load photos. Try again." with retry button |

### Interactions

| Element | Action | Result |
|---|---|---|
| Photo card | Tap | Navigate to `/photo/[id]` (S7, non-study mode) |
| Search icon (top bar) | Tap | Navigate to `/search` |
| Search tab (bottom nav) | Tap | Navigate to `/search` |
| Collections/Library tabs | Tap | Show toast: "Not part of this prototype" |

### Photo Card
- Square aspect ratio (`aspect-ratio: 1/1`)
- `object-fit: cover`
- On image load error: grey `#E8EAED` placeholder
- No title/caption on card

---

## 3. S2/S3 — Search (Empty → Typing)

**Route:** `/search?mode=A` or `/search?mode=B`

### S2 — Empty Search State

```
[ Search bar (focused, empty, placeholder: "Search your photos") ]
[ Section: People   → row of 3 face-placeholder circles ]
[ Section: Places   → row of 3 location-placeholder chips ]
[ Section: Things   → row of 3 object-placeholder chips ]
[ Bottom nav ]
```

- Search bar immediately focused on page load
- People/Places/Things are static placeholders
- Tapping any of them → toast: "Not part of this test"

### S3 — Typing State

```
[ Search bar (has text | × clear button) ]
[ (Mode B only, after debounce) Coach panel OR nothing ]
[ Bottom nav ]
```

### Search Bar Spec
- Rounded pill: `border-radius: 28px`
- Background: `#F1F3F4` (light grey, Google style)
- Left: search icon
- Right: `×` clear button (visible only when text present)
- Height: 48 px
- Placeholder: `"Search your photos"`
- Keyboard: shows on mount (auto-focus)

### Mode A — Typing Behaviour
1. User types → input updates
2. User presses Enter or taps Search icon → `POST /api/search` → navigate to `/results?q=<query>&mode=A&session=<id>`
3. No debounce actions, no coach

### Mode B — Typing Behaviour
1. User types → input updates
2. Debounce timer resets on every keystroke (500 ms)
3. After 500 ms pause:
   - `POST /api/coach/analyze { query, sessionId }`
   - If `triggered: true` → coach panel slides in (S4 mounted below search bar)
   - If `triggered: false` → nothing; user can still search normally
4. User presses Enter or Search icon **before** debounce → plain search runs, no coach

### Coach Dismiss Rules
- If user types again after coach appears → coach collapses, new debounce starts
- If user taps "Not these" → coach collapses, query unchanged
- If user taps "Search anyway" → navigate to results with original typed query
- Coach shown once per unique query (see edgecases CT-06)

---

## 4. S4 — Coach Panel

**Mounted:** Below search bar on `/search`, in Mode B only

### Layout
```
[ Search bar (query shown, not editable while coach is open — or still editable?) ]
─────────────────────────────────────────────────
[ Coach card: slides up                         ]
│ Header: "Lots of photos match.                │
│          Help us narrow it down."             │
│                                               │
│ ── Question 1 ──                              │
│ [Who was with you?]                           │
│ [Just me] [Friends] [Family] [Group]          │
│ [Something else ▾] [I don't remember]         │
│                                               │
│ ── Question 2 ──                              │
│ [What did it look like?]                      │
│ [Red] [Blue] [Outdoors] [Bright colours]      │
│ [Something else ▾] [I don't remember]         │
│                                               │
│ ── Question 3 ──                              │
│ [What was the occasion?]                      │
│ [Birthday?] [Celebration?] [Nothing special]  │
│ [Something else ▾] [I don't remember]         │
│                                               │
│ [Build my search]  [Search anyway]            │
│ [Not these]                                   │
─────────────────────────────────────────────────
[ Bottom nav ]
```

### Question Block Spec
- Question text: 16 px, medium weight, `#202124`
- Chips: pill shape, 36 px height, 16 px font
  - Unselected: `background: #F1F3F4`, `color: #202124`
  - Selected: `background: #1A73E8` (Google blue), `color: white`
- Chip wrap: `flex-wrap: wrap`, 8 px gap
- "Something else": ghost chip → expands inline `<input>` on tap
- "I don't remember": text-only button, 14 px, muted colour `#5F6368`

### Button Spec
- **"Build my search"**: filled primary button, full width, 48 px height
- **"Search anyway"**: text button, 14 px, centred, `#1A73E8`
- **"Not these"**: small text, 12 px, right-aligned, `#5F6368`

### Interactions

| Action | Result |
|---|---|
| Tap chip | Chip selected (aria-pressed=true); `POST /api/coach/answer`; questions re-rank with short fade |
| Tap selected chip again | Chip deselected; `POST /api/coach/answer` with updated answers |
| Tap "Something else" | Inline `<input>` appears; chip row hidden temporarily |
| Type in "Something else" + Enter | Answer added, inline input closes; chip shown as selected |
| Tap "I don't remember" | Question greyed; `chip_skipped` logged; re-rank fires |
| Tap "Build my search" | Loading spinner on button; `POST /api/coach/compose`; navigate to S5 |
| Tap "Search anyway" | Navigate to `/results?q=<original_typed>&mode=B&session=<id>` |
| Tap "Not these" | `coach_reset` logged; answers cleared; coach panel collapses |

### Re-Rank Animation
- When questions reorder after a chip tap: 150 ms fade-out → reorder → 150 ms fade-in
- Do not animate if order doesn't change

### Loading State (Build my search)
- Button shows spinner, text hidden
- Chips become non-interactive
- If Groq returns within 3s → navigate to S5
- If fallback used → navigate to S5 with `composer: "fallback"` in state

---

## 5. S5 — Prompt Review

**Route:** `/search` (modal/drawer state) or `/prompt-review` (if router-based)

### Layout
```
[ ← Back ]
[ Title: "Here's your search." ]
[ Subtitle: "Change anything you like." ]
[ Cue chips row (removable): [friends ×] [red swimsuit ×] [outdoors ×] ]
[ Editable textarea: "Me with friends at the pool in red swimsuits, outdoors" ]
[ (debug only) Composed by: Groq / Fallback ]
[ [Search] button ]
```

### Cue Chips
- Each chip shows the cue value
- `×` button on each chip
- Removing a chip: reconstructs prompt client-side (deterministic, no Groq call)
  - New prompt = `[typedQuery, ...remainingAnswers.map(a=>a.value)].join(", ")`
- Chips are **not** re-added after removal (user must go Back to restore)

### Textarea
- Editable freely
- Pre-filled with `prompt` from `/api/coach/compose`
- No character limit shown (but trim at 500 chars before search)
- Height: auto-expand to 3–5 lines max, then scroll

### Interactions

| Action | Result |
|---|---|
| Remove cue chip | Chip removed; textarea updates (deterministic rebuild) |
| Edit textarea | Textarea value updates; cue chips remain (they reflect original compose) |
| Tap "Search" | `prompt_edited` logged if textarea differs from original prompt; `POST /api/search { query: textareaValue, mode: "B" }`; navigate to results |
| Tap "← Back" | Return to S4; coach answers preserved |
| Textarea is empty + tap Search | Disabled or toast: "Please enter a search term" |

---

## 6. S6 — Results Grid

**Route:** `/results?q=<query>&mode=<A|B>&session=<id>`

### Layout
```
[ Search bar (non-editable, shows query text) | edit icon ]
[ (Mode B only) Pill: "Edited search" ]
[ Results grid: 3 columns, square thumbnails ]
[ Bottom nav ]
```

### States

| State | Trigger | Display |
|---|---|---|
| Loading | Navigating to results | Skeleton grid |
| Results | API returns count > 0 | Photo grid, ranked by score |
| Zero results | API returns count = 0 | Navigate to S8 |

### Results Grid
- Same component as S1 grid (`<PhotoGrid>`)
- Photos ordered by score descending, then filename
- No pagination (library is ~100 photos; all shown)
- Debug mode (`?debug=1`): small score badge on each photo

### "Edited search" pill
- Shown only in Mode B, below search bar
- Text: `"Edited search"` with a subtle outline style
- Not shown in Mode A

### Interactions

| Action | Result |
|---|---|
| Tap photo | Navigate to `/photo/[id]?session=<id>&mode=<mode>` (S7) |
| Tap search bar / edit icon | Return to S3 (search bar focused with current query) |
| 0 results | Redirect to S8 |

---

## 7. S7 — Photo Viewer

**Route:** `/photo/[id]?session=<id>&mode=<mode>&rank=<rank>`

### Layout
```
[ ← back arrow (top left) ]
[ Full-screen photo (object-fit: contain, black background) ]
[ (Study mode only) Bottom bar:
    [This is the photo] [Not it]
]
```

### Study Mode Detection
- Study mode = URL has `session` param with an active session
- In study mode: show "This is the photo" + "Not it" buttons
- In normal browsing (from S1): show only back arrow

### "This is the photo" Logic
- Server checks if `photoId` matches the `targetId` for this session
- If match → `found` event logged → navigate to S11
- If mismatch → still logs `found` (user believes it's the photo); note: in MVP, assume user is correct. Study protocol handles verification.
- Actually: log `found { photoId }`. Analysis verifies if `photoId === target.file`.

### "Not it" Logic
- Logs `wrong_open { photoId, rank }`
- Returns to S6 results

### Interactions

| Action | Result |
|---|---|
| Tap back arrow | Return to S6 (browser back) |
| "This is the photo" | Log `found`; navigate to S11 |
| "Not it" | Log `wrong_open`; return to S6 |
| Pinch to zoom | Native browser behaviour (allowed) |

---

## 8. S8 — Zero Results

**Route:** `/results?q=<query>&mode=<mode>` (when count = 0)

### Layout
```
[ Search bar (shows query) ]
[ Icon: empty box or search-with-x ]
[ Text: "No photos found." ]
[ Subtext: "Try a different search." ]
[ [Try again] button → back to S3 ]
[ (Mode B only) [Back to my questions] → back to S4 ]
```

### Interactions

| Action | Result |
|---|---|
| "Try again" | Navigate to `/search` (S2) with mode preserved |
| "Back to my questions" (Mode B only) | Navigate back to S4 with previous answers preserved |

---

## 9. S9 — Moderator Console

**Route:** `/moderator`

### PIN Flow
1. Load `/moderator` → show PIN input form (no other content visible)
2. Submit PIN → `POST /api/moderator/verify` or client-side compare with `process.env.MODERATOR_PIN`
   - **Security note:** PIN is validated server-side. Do not expose in client bundle.
3. Wrong PIN → shake animation on input, "Incorrect PIN" message
4. Correct PIN → console unlocked for the browser session (`sessionStorage`)

### Console Layout
```
[ Title: "Moderator Console" ]
[ Consent notice: "Logs are stored for case-study analysis only." ]
[ ─── New Task ─── ]
[ Participant ID: [P01] (text input) ]
[ Mode: [A] [B] (radio) ]
[ Target photo: [T01 ▾] (dropdown from targets.json) ]
[ [Start task] button ]

[ ─── Current Task ─── ]  (visible after Start)
[ Timer: 02:15 elapsed ]
[ [Show target] [End task] buttons ]
[ [Export CSV] link ]

[ ─── Live Event Log ─── ]
[ (last 5 events, auto-updating) ]
[ task_start | P01 | Mode B | T01 ]
[ target_shown | ... ]
[ ... ]
```

### Target Dropdown
- Populated from `targets.json`
- Shows: `T01 — pool_03.jpg (pool, high-match-count)`
- Disabled if no targets available

### Interactions

| Action | Result |
|---|---|
| "Start task" | Validates fields; generates `sessionId`; logs `task_start`; navigates to `/study?pid=<>&mode=<>&target=<>&session=<>` |
| "Show target" | Available during active task; navigates to target reveal in study window |
| "End task" | Confirmation dialog → logs `task_end { outcome: "moderator_end" }`; shows S11 |
| "Export CSV" | Opens `/api/admin/export.csv` with PIN in header |

---

## 10. S10 — Target Reveal

**Route:** `/study?pid=<>&mode=<>&target=<>&session=<>`

### Flow
```
Phase 1 — Reveal (5 seconds):
  Full-screen target photo
  Countdown timer overlay (5 → 4 → 3 → 2 → 1)
  Logs: target_shown

Phase 2 — Transition:
  Photo fades out
  Logs: target_hidden { durationMs: 5000 }

Phase 3 — "Now find it":
  Screen: "Now find this photo from memory."
  Subtitle: "You have 3 minutes."
  [Find it →] button

  Tapping "Find it" → navigates to /search?mode=<mode>&session=<id>
  3-minute countdown starts
```

### Timer
- 3-minute timer starts when `/search` opens (NOT at Phase 3)
- Timer state persisted in React context / URL param (start timestamp)
- When timer expires: redirect to S11 regardless of current screen
- Timer shown as progress bar or countdown in corner during task

### Safeguards
- "Find it" button only active after Phase 2 completes
- Target photo NOT shown again after Phase 2

---

## 11. S11 — Task End Survey

**Route:** `/study/end?session=<id>&outcome=<found|gave_up|timeout>`

### Layout
```
[ Title: "Task complete" / "Time's up" / "OK, we'll move on" ]
[ Outcome line: "You found the photo!" / "You gave up" / "3 minutes are up" ]

[ Question 1: "How easy was it to find the photo?" ]
[ 1 ── 2 ── 3 ── 4 ── 5 ]
[ Very hard         Very easy ]

[ Question 2: "How confident are you that you could describe it next time?" ]
[ 1 ── 2 ── 3 ── 4 ── 5 ]
[ Not at all        Very confident ]

[ Optional: "Anything else? (optional)" ]
[ textarea ]

[ [Submit] button → back to /moderator ]
```

### Interactions

| Action | Result |
|---|---|
| Select rating (1–5) | Rating stored in component state |
| Tap "Submit" | Logs `survey_answered { easy, confidence, comment }`; logs `task_end { outcome, seconds }`; navigates to `/moderator` |
| Tap "Submit" without ratings | Both ratings required; show inline validation |

---

## 12. S12 — About & Credits

**Route:** `/about`

### Layout
```
[ Title: "About" ]
[ Purpose: "Prototype for a product-management case study." ]
[ Disclaimer: "Not affiliated with Google. Photos from Pexels." ]

[ ─── Photo Credits ─── ]
[ Table or list: file | photographer | Pexels link ]
[ (auto-generated from credits.csv) ]

[ ─── Licence ─── ]
[ "Photos used under the Pexels Licence." ]
[ Link: https://www.pexels.com/license/ ]
```

---

## 13. Full Flow Diagrams

### Mode A — Complete Flow

```
S1 (home)
  └── tap Search → S2 (empty search)
        └── type query → S3 (typing)
              └── press Enter → S6 (results)
                    ├── tap photo → S7 (viewer, no study buttons)
                    └── 0 results → S8 → tap "Try again" → S2
```

### Mode B — Complete Study Flow

```
S9 (moderator console, PIN)
  └── Start task → S10 (target reveal, 5s)
        └── "Find it" → S2 (search, 3-min timer starts)
              └── type "pool" → S3
                    └── 500ms pause → S4 (coach panel)
                          ├── tap chips → re-rank
                          ├── "Search anyway" → S6 (plain results)
                          ├── "Not these" → S3 (reset)
                          └── "Build my search" → S5 (prompt review)
                                └── tap "Search" → S6 (composed results)
                                      └── tap photo → S7 (with study buttons)
                                            ├── "This is the photo" → S11 (survey) → S9
                                            └── "Not it" → back to S6
Timer expires anywhere → S11 (survey) → S9
```

---

## 14. Animation & Transition Spec

| Element | Animation | Duration | Easing |
|---|---|---|---|
| Coach panel: enter | `translateY(100%) → translateY(0)` | 250 ms | `ease-out` |
| Coach panel: exit | `translateY(0) → translateY(100%)` | 200 ms | `ease-in` |
| Question re-rank | `opacity: 1 → 0 → 1` with reorder | 300 ms total | `ease` |
| Chip selection | `background-color` transition | 150 ms | `ease` |
| Target reveal fade | `opacity: 1 → 0` | 500 ms | `ease` |
| Page transitions | Instant (no animation) | — | — |
| Toast appear | `opacity: 0 → 1`, `translateY(8px → 0)` | 200 ms | `ease-out` |
| Toast disappear | `opacity: 1 → 0` | 150 ms | `ease-in` |

---

## 15. Toast & Feedback System

### Toast Spec
- Position: top-centre of the 390 px frame
- Max-width: 320 px
- Background: `#202124` (dark), white text
- `border-radius: 8px`, `padding: 12px 16px`
- Duration: 2500 ms auto-dismiss
- One toast at a time (new toast replaces old)

### Toast Messages

| Trigger | Message |
|---|---|
| Tap placeholder nav tab | "Not part of this prototype" |
| Tap People/Places/Things in S2 | "Not part of this test" |
| Textarea empty on submit | "Please enter a search term" |
| Groq fallback used | *(no toast; debug label only)* |
| DB offline | *(no toast; event queued silently)* |
| Wrong moderator PIN | Inline form error: "Incorrect PIN" |

---

*End of UX_FLOWS.md*
