# DEV_SETUP.md — Local Development Setup
## Pre-Search "Narrow It Down" Coach — Google Photos MVP

> **Audience:** Developer (Antigravity agent or any new contributor).  
> **Time to first run:** ~15 minutes (excluding photo download and tagging).

---

## Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | ≥ 18.x LTS | `node --version` |
| npm | ≥ 9.x | `npm --version` |
| Python | ≥ 3.10 | `python --version` |
| pip | latest | `pip --version` |
| Git | any modern | `git --version` |

### API Keys Required

| Key | Where to get | Used for |
|---|---|---|
| `PEXELS_API_KEY` | https://www.pexels.com/api/ (free) | Download script only |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey (free) | Tagging script only |
| `GEMINI_MODEL` | Verify current Flash vision model name in AI Studio | Tagging script only |
| `GROQ_API_KEY` | https://console.groq.com (free) | Runtime compose |
| `GROQ_MODEL` | Check Groq console for current Llama 3 model name | Runtime compose |
| `MODERATOR_PIN` | Choose any PIN, e.g. `1234` | Moderator console |

---

## Step 1 — Clone and Install

```bash
# Clone the repo
git clone <repo-url>
cd <project-folder>

# Install Node dependencies
npm install
```

---

## Step 2 — Environment Variables

```bash
# Copy the example env file
cp .env.example .env.local
```

Edit `.env.local` and fill in all values:

```env
# --- Offline scripts only (NEVER put these in Vercel) ---
PEXELS_API_KEY=your_pexels_key_here
GEMINI_API_KEY=your_gemini_key_here
GEMINI_MODEL=gemini-1.5-flash-latest       # verify current name in AI Studio

# --- Runtime (safe for Vercel server-side env) ---
GROQ_API_KEY=your_groq_key_here
GROQ_MODEL=llama3-8b-8192                  # verify current model in Groq console
MODERATOR_PIN=1234

# --- Database ---
DATABASE_URL=                              # leave blank for SQLite (local dev)
# For Supabase: postgresql://user:pass@host:5432/dbname
```

> ⚠️ **Never commit `.env.local`** — it is in `.gitignore` by default.

---

## Step 3 — Download Photos (one-time)

```bash
# Install Python dependencies
pip install requests

# Set env var for the script (Windows PowerShell)
$env:PEXELS_API_KEY="your_pexels_key"

# Run the download script
python scripts/download_pexels.py
```

**What it does:**
- Downloads ~14 photos per theme (10 themes) to `public/library/`
- Creates `data/credits.csv`

**After download:**
- Manually review the photos
- Delete: blurry, near-identical, off-theme, explicit/unsuitable
- Goal: keep ~100 total with variety within each theme

---

## Step 4 — Tag Photos (one-time, owner review gate)

### Step 4a — Tag 10 photos first

```bash
# Install Google AI library
pip install google-generativeai

# Set env vars
$env:GEMINI_API_KEY="your_gemini_key"
$env:GEMINI_MODEL="gemini-1.5-flash-latest"

# Tag first 10 photos only
python scripts/tag_library.py --limit 10 --output data/tags_sample.json
```

### Step 4b — Send `tags_sample.json` to Tharun for review

- Check: Do birthday photos say `"birthday"` with a real `occasion_basis`?
- Check: Does `clothing` have colours? (e.g. `"red swimsuit"` not just `"swimwear"`)
- Check: Are `unknown` values used when things aren't visible?
- If quality is poor: adjust `scripts/tag_prompt.txt` and re-run

### Step 4c — Tag all photos (after owner approval)

```bash
# Tag all remaining photos (merges with tags_sample.json)
python scripts/tag_library.py --output data/tags.json
```

**Output:** `data/tags.json` — commit this file.

---

## Step 5 — Set Up Database (local)

### Option A — SQLite (recommended for local dev)

No setup needed. Leave `DATABASE_URL` blank in `.env.local`.

The app uses SQLite automatically when `DATABASE_URL` is not set.
Database file created at: `data/events.db`

### Option B — Supabase (if you want to test production DB locally)

1. Create a free Supabase project at https://supabase.com
2. Run `src/db/schema.sql` in the Supabase SQL editor
3. Copy the connection string to `DATABASE_URL` in `.env.local`

---

## Step 6 — Run the Development Server

```bash
npm run dev
```

Open: http://localhost:3000

**Expected first view:** S1 — Photos home grid with ~100 photos.

### Dev Server Notes

- Hot reload enabled — changes to `src/` reload automatically
- `data/*.json` changes require server restart (`Ctrl+C`, then `npm run dev`)
- API routes restart automatically on change

---

## Step 7 — Create `data/targets.json` (owner action)

After reviewing the library, Tharun picks 10 target photos:

```json
[
  {
    "id": "T01",
    "file": "pool_03.jpg",
    "theme": "pool",
    "difficulty": "high-match-count",
    "distinctiveFeature": "red swimsuit, group of 5",
    "pairsWith": "T02"
  }
]
```

Commit this file. The moderator console reads it to populate the target dropdown.

---

## Development URLs

| URL | Description |
|---|---|
| `http://localhost:3000` | S1 — Photos home |
| `http://localhost:3000/search?mode=A` | S2 — Search, Mode A |
| `http://localhost:3000/search?mode=B` | S2 — Search, Mode B |
| `http://localhost:3000/moderator` | S9 — Moderator console (PIN required) |
| `http://localhost:3000/about` | S12 — About & Credits |
| `http://localhost:3000/admin` | Admin metrics dashboard (PIN required) |
| `http://localhost:3000/search?mode=B&debug=1` | Mode B with debug overlay |

---

## Running Tests

```bash
# Run all unit tests
npm test

# Run a specific module
npx jest vagueCheck
npx jest search
npx jest coachEngine
npx jest promptComposer
npx jest metrics

# Watch mode (re-runs on file change)
npm test -- --watch
```

---

## Project Scripts Reference

| Script | Command | Description |
|---|---|---|
| Dev server | `npm run dev` | Starts Next.js dev server |
| Build | `npm run build` | Production build (for validation only) |
| Tests | `npm test` | Run Jest unit tests |
| Download photos | `python scripts/download_pexels.py` | Download Pexels library |
| Tag 10 photos | `python scripts/tag_library.py --limit 10` | Sample tagging for review |
| Tag all photos | `python scripts/tag_library.py` | Full tagging run |
| Type check | `npm run type-check` | TypeScript check without building |
| Lint | `npm run lint` | ESLint check |

---

## Troubleshooting

### "Photos not showing on S1"

- Check that `/public/library/` has `.jpg` files
- Check that `data/tags.json` exists (even if empty `{}` initially)
- Check for TypeScript errors in `src/lib/dataLoader.ts`

### "Coach not appearing in Mode B"

- Verify `?mode=B` is in the URL
- Open browser DevTools → Network tab → look for `/api/coach/analyze` call
- Check response: `triggered` should be `true` for `"pool"`
- If `triggered: false`: check `candidateCount` — should be ≥ 12

### "Groq compose failing"

- Check `GROQ_API_KEY` is set in `.env.local`
- Check `GROQ_MODEL` — verify the model name exists in Groq console
- Fallback should still work (check `composer: "fallback"` in network response)

### "Database errors"

- For SQLite: check that `data/` directory is writable
- For Supabase: check `DATABASE_URL` format is correct
- Events should still log (localStorage queue) even if DB is down

### "Python script fails"

- Ensure correct Python version: `python --version` should show 3.10+
- Ensure dependencies installed: `pip install requests google-generativeai`
- Check API keys are set as environment variables

---

## File Change Impact Map

When you change... | You also need to...
---|---
`src/lib/config.ts` | Restart dev server; update `EVALS.md` if thresholds changed
`data/tags.json` | Restart dev server (loaded at startup)
`data/synonyms.json` | Restart dev server
`data/cue_lexicon.json` | Restart dev server
`src/app/api/*/route.ts` | Hot reload handles it (no restart)
`src/lib/vagueCheck.ts` | Re-run unit tests
`src/lib/search.ts` | Re-run unit tests
`src/lib/coachEngine.ts` | Re-run unit tests
`scripts/tag_prompt.txt` | Re-run tagging on 10 photos; send to owner for review
`PROMPTS_REFERENCE.md` | Update version number in that doc
Any `.env.local` change | Restart dev server

---

*End of DEV_SETUP.md*
