# DEPLOYMENT_RUNBOOK.md — Production Deployment Guide
## Pre-Search "Narrow It Down" Coach — Google Photos MVP

> **Deadline:** Wednesday, 7 October 2026, 3:59 PM IST  
> **Target:** Vercel (Next.js) + Supabase (Postgres)  
> **Rule:** Never deploy without running the pre-deploy checklist. Never set `PEXELS_API_KEY` or `GEMINI_API_KEY` in Vercel.

---

## Architecture Reminder

```
Vercel (Next.js app + API routes)
  └── reads: /public/library/*.jpg (CDN)
  └── reads: /data/*.json (bundled)
  └── calls: Groq API (server-side)
  └── writes: Supabase Postgres (event log)

Supabase (free tier)
  └── events table
```

---

## Step 1 — Prepare the Codebase

Before first deploy, ensure all of the following are committed:

```bash
# Check these files exist and are committed
git status

# Required committed files:
public/library/*.jpg          # ~100 photos
data/tags.json                # from tag_library.py
data/targets.json             # from Tharun
data/credits.csv              # from download_pexels.py
data/synonyms.json
data/places.json
data/cue_lexicon.json
src/db/schema.sql
.env.example                  # with all key names, NO real values
```

```bash
# Verify no secrets are committed
git log -p -- .env.local      # should show nothing (file not tracked)
git grep "GEMINI_API_KEY=" -- '*.ts' '*.js' '*.json'  # should show nothing
git grep "GROQ_API_KEY="    -- '*.ts' '*.js' '*.json'  # should show nothing
```

---

## Step 2 — Set Up Supabase Database

1. Go to https://supabase.com → Sign in → New project
2. Name: `gp2-coach-mvp`
3. Region: closest to India (e.g. `ap-south-1` / Singapore)
4. Copy the **Connection string** (URI format): `postgresql://postgres:[password]@[host]:5432/postgres`

5. In Supabase **SQL Editor**, run `src/db/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS events (
  id             SERIAL PRIMARY KEY,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ts             TIMESTAMPTZ NOT NULL,
  session_id     TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  mode           CHAR(1) NOT NULL CHECK (mode IN ('A', 'B', 'C')),
  type           TEXT NOT NULL,
  payload        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_participant ON events(participant_id);
```

6. Verify: Run `SELECT * FROM events LIMIT 1;` → should return 0 rows with no error.

---

## Step 3 — Deploy to Vercel

### 3a — Push to GitHub

```bash
git add .
git commit -m "feat: initial MVP ready for deploy"
git push origin main
```

> Use a **private repo** (photos + data files should not be public).

### 3b — Import to Vercel

1. Go to https://vercel.com → New Project
2. Import from GitHub → select the repo
3. Framework: **Next.js** (auto-detected)
4. Root directory: `/` (project root)
5. Build command: `npm run build` (default)
6. Output directory: `.next` (default)
7. **Do NOT click Deploy yet** — set env vars first

### 3c — Set Environment Variables in Vercel

Go to: Project → Settings → Environment Variables

Add the following. All should be set for **Production** environment only:

| Name | Value | Environment |
|---|---|---|
| `GROQ_API_KEY` | your Groq API key | Production |
| `GROQ_MODEL` | e.g. `llama3-8b-8192` | Production |
| `MODERATOR_PIN` | your chosen PIN | Production |
| `DATABASE_URL` | Supabase connection string | Production |

**Do NOT add:**
- `PEXELS_API_KEY` ← offline script only
- `GEMINI_API_KEY` ← offline script only
- `GEMINI_MODEL` ← offline script only

### 3d — Deploy

Click **Deploy**. Wait for build to complete (~2–3 minutes).

If build fails: check the Vercel build log for TypeScript errors.

---

## Step 4 — Post-Deploy Verification

Run this checklist immediately after every deploy:

### 4a — Basic Load

```
[ ] https://<app>.vercel.app/           → S1 loads, photos visible
[ ] https://<app>.vercel.app/search?mode=A → search bar visible
[ ] https://<app>.vercel.app/search?mode=B → search bar visible
[ ] https://<app>.vercel.app/about      → credits page loads
[ ] https://<app>.vercel.app/moderator  → PIN form shown
```

### 4b — API Smoke Tests

Run from browser console or curl:

```bash
# Photos API
curl https://<app>.vercel.app/api/photos

# Search API
curl -X POST https://<app>.vercel.app/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"pool","sessionId":"test-001","mode":"A"}'

# Coach analyze
curl -X POST https://<app>.vercel.app/api/coach/analyze \
  -H "Content-Type: application/json" \
  -d '{"query":"pool","sessionId":"test-001"}'

# Coach compose (Mode B flow)
curl -X POST https://<app>.vercel.app/api/coach/compose \
  -H "Content-Type: application/json" \
  -d '{"query":"pool","answers":[{"questionId":"q_who","cueType":"who","value":"friends","source":"chip"}],"sessionId":"test-001"}'
```

Expected: all return 200 with valid JSON.

### 4c — Event Logging

```bash
# Log a test event
curl -X POST https://<app>.vercel.app/api/log \
  -H "Content-Type: application/json" \
  -d '{"ts":"2026-10-05T10:00:00Z","sessionId":"test-001","participantId":"P00","mode":"A","type":"task_start","payload":{"targetId":"T01"}}'

# Should return: {"ok":true}
```

Then in Supabase SQL editor:
```sql
SELECT * FROM events WHERE session_id = 'test-001';
-- Should show 1 row
```

### 4d — CSV Export

```bash
curl -H "Authorization: Bearer <MODERATOR_PIN>" \
  https://<app>.vercel.app/api/admin/export.csv
```

Expected: CSV file with headers.

### 4e — Security Check

```bash
# These should return 401
curl https://<app>.vercel.app/api/admin/export.csv
curl -H "Authorization: Bearer wrongpin" https://<app>.vercel.app/api/admin/export.csv

# Check browser Network tab: no API keys in request/response headers
```

### 4f — Phone Test

Open `https://<app>.vercel.app` on a real Android phone (Chrome):

```
[ ] S1 grid loads, all photos visible
[ ] Search bar usable, keyboard appears
[ ] Type "pool" in Mode B → coach appears within 1 second
[ ] Tap a chip → questions update
[ ] "Build my search" → prompt shown, editable
[ ] "Search" → results grid visible
[ ] Photo tap → viewer, buttons visible, ≥44px tap targets
[ ] "This is the photo" works
```

---

## Step 5 — Custom Domain (optional, if needed)

If Tharun wants a cleaner URL (e.g. `photos-coach.vercel.app` is the default but custom domain is optional):

1. Vercel → Project → Settings → Domains
2. Add domain → follow DNS instructions
3. Not required for the MVP deadline

---

## Redeployment Process

For every subsequent deploy:

```bash
git add .
git commit -m "fix: <description>"
git push origin main
# Vercel auto-deploys on push to main
```

**After each redeploy:**
- Run the smoke tests (Step 4b)
- Check events table still has previous data (data must persist)
- Do NOT reset the database unless explicitly needed

---

## Database Migrations

If the schema needs to change after first deploy:

**Rule: Additive only.** Never drop or rename a column. Only add new columns.

```sql
-- Example: adding a new column
ALTER TABLE events ADD COLUMN IF NOT EXISTS browser TEXT;
```

Run in Supabase SQL editor. No downtime needed.

---

## Rollback Procedure

If a deploy breaks the app:

1. Go to Vercel → Project → Deployments
2. Find the last working deployment
3. Click **"Promote to Production"** on that deployment
4. Investigate the broken deploy in a preview branch

---

## Emergency: DB Offline During Study

If Supabase goes down during user testing:

- Events automatically queue in `localStorage` on the participant's device
- Study can continue — no data lost
- When Supabase recovers, the next event POST will flush the queue
- If the browser tab is closed before recovery: events are lost from that session
- In this case: note the session manually in `study_protocol.md` and reconstruct from notes

---

## Vercel Free Tier Limits

| Resource | Free Tier | Estimated Usage |
|---|---|---|
| Bandwidth | 100 GB/month | ~100 photos × 300 KB × 100 loads = ~3 GB |
| Serverless function invocations | 100,000/month | Study sessions × ~50 events = ~250 |
| Function duration | 10s timeout | Groq call: 3s max — well within |

All well within free tier limits for this study.

---

## Supabase Free Tier Limits

| Resource | Free Tier | Estimated Usage |
|---|---|---|
| Database size | 500 MB | Events: ~5 sessions × ~20 events × 1 KB = ~100 KB |
| API requests | 500,000/month | Well within |
| Connection pool | 60 connections | Far more than needed |

---

## Deployed URL

> **Fill in after first successful deploy:**
> `https://______________________.vercel.app`

Add this to `README.md` and `implementation_plan.md`.

---

*End of DEPLOYMENT_RUNBOOK.md*
