# Google Photos AI Genie — Public Demo

> **Problem:** People remember a photo as a *scene of details*, but the words they type ("pool", "me") match too many photos.
>
> **Genie:** While the user types a vague search, a small strip under the search bar shows up to 3 tappable question rows about details people remember — look, what, occasion, group type, mood. Each tap writes its words into the search bar. The bar is the single source of truth. Tapping again removes the words. The user submits with the normal Search button or Enter.

---

## What It Does

1. User opens Search and starts typing (e.g. *"pool"*)
2. After 500 ms the Genie evaluates the query:
   - Are there any content words? (Ignores "me", "my", "i", "we" and stopwords)
   - Does the query lack 2+ precise anchors (name + date, name + place, etc.)?
   - Do 6–∞ photos match? (If 0, shows "No photos fit this description." instead)
3. A chip strip appears under the search bar with 2–3 rows of tappable detail chips
4. Each chip tap appends a phrase to the query bar; tapping again removes it
5. Submitting the query (Enter or Search button) runs the full search

The Genie is **always on** for every user. No mode selector, no opt-in.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Styling | Vanilla CSS (no Tailwind) |
| Search | Deterministic in-memory (stem + synonym + tier matching) |
| Genie questions | Deterministic field-distribution scoring |
| Photos | 200 Pixabay images, tagged offline with Gemini |
| Metadata | Synthetic (dates, places, cast names are AI-generated) |
| Deploy | Vercel / Railway (stateless, no DB) |

---

## Genie Trigger Rules (7 Rules)

1. **genie_enabled** — `GENIE_ENABLED=false` or `?genie=off` → no strip
2. **content_word** — At least one token ≥ 3 letters after removing stopwords + self-words (me/my/i/we/our)
3. **still_typing** — 500 ms debounce after last keypress
4. **already_shown** — Strip reopens only if query changes by 2+ new words after dismiss
5. **not_vague** — Fewer than 2 precise anchors among Person / Time / Location
6. **no_matches** — 0 recognised content tokens → shows "No photos fit this description." (no chips)
7. **few_candidates** — Fewer than 6 candidate photos → no strip

---

## Question Selection

- 2–5 chip options per row; each option covers ≥ 10% of candidates
- ≥ 2 memory-cue rows (look, what, occasion, mood, who/group)
- ≤ 1 metadata row (place city, year)
- NO cast-name row unless the typed query already contains a cast name
- Never ask a cue already answered by the current text
- Score = `coverage × normalised_entropy(top 4 values) × recallability × cue_weight`

---

## Data

- **200 photos** downloaded from [Pixabay](https://pixabay.com) (free for commercial use)
- Tags generated offline using Gemini (activity, mood, occasion, group type, setting, clothing…)
- Dates, places, and cast names shown in the app are **synthetic** — AI-generated for demonstration purposes
- Synonyms in `data/synonyms.json` (e.g. "road trip" ↔ "roadtrip", "cake" ↔ "birthday cake")

---

## Quick Start

```bash
npm install
npm run dev
# Open http://localhost:3000
```

No environment variables required. Genie works deterministically with no API key.

Optional (for LLM question planner):
```
GROQ_API_KEY=your_key
PLANNER_ENABLED=true
```

---

## Developer Switches

| Switch | Effect |
|--------|--------|
| `?genie=off` | Disables Genie strip for that session |
| `?debug=1` | Shows trigger diagnostics panel (typed text, candidates, blocked reason, chip history) |
| `GENIE_ENABLED=false` | Disables Genie globally |

---

## Attribution

Photos from **Pixabay** — Pixabay License (free for commercial use, no attribution required but credited).
Dates, places and cast names shown in the demo are synthetic (not real EXIF data).

---

## Deployment

See [deployment_guide.md](deployment_guide.md) for Vercel and Railway instructions.

Health check endpoint: `GET /api/health` → `{ "ok": true, "photoCount": 200, "tagCoverage": 1.0 }`
