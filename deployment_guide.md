# Deployment Guide — Google Photos AI Genie MVP

> **Architecture:** Single stateless Next.js service. No database, no persistent volume, no CORS proxy.
> All data is read-only at startup from `data/` and `public/library/`.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | >= 18 |
| npm | >= 9 |

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy example env and fill in values
cp .env.example .env.local
# Edit .env.local — only GEMINI_API_KEY / GROQ_API_KEY are needed for LLM features.
# Genie works fully deterministically even without them.

# 3. Start dev server
npm run dev
# Open http://localhost:3000
```

---

## Environment Variables

The app requires **zero** required env vars to run. All variables are optional:

| Variable | Where to Set | Purpose | Default |
|----------|-------------|---------|---------|
| `GENIE_ENABLED` | Server | Master on/off for Genie strip | `true` |
| `GEMINI_API_KEY` | Server | Offline tag generation (scripts only) | (none) |
| `GROQ_API_KEY` | Server | Optional LLM question planner | (none) |
| `GROQ_MODEL` | Server | LLM model name | `openai/gpt-oss-120b` |
| `PLANNER_ENABLED` | Server | Enable LLM question planner | `false` |

> **Never** set `NEXT_PUBLIC_*` prefixes on secrets — they leak to the browser bundle.

---

## Deploy to Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# One-command deploy
vercel --prod
```

**Vercel Project Settings → Environment Variables:**

| Key | Value |
|-----|-------|
| `GENIE_ENABLED` | `true` |
| `GROQ_API_KEY` | *(your key, marked secret)* |
| `GROQ_MODEL` | `openai/gpt-oss-120b` |

**Vercel automatically:**
- Bundles `data/` and `public/library/` at build time (read-only)
- Serves all routes as Serverless Functions
- Handles HTTPS and CDN

---

## Deploy to Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

railway login
railway init
railway up
```

**Railway Service → Variables:**

| Key | Value |
|-----|-------|
| `GENIE_ENABLED` | `true` |
| `GROQ_API_KEY` | *(your key)* |

**Start command:** `npm run start` (already in `package.json`)

> No volume needed — data is bundled with the image.

---

## Health Check

```
GET /api/health
```

Response (200 OK):
```json
{
  "ok": true,
  "version": "0.1.0",
  "photoCount": 200,
  "tagCoverage": 1.0
}
```

---

## Hidden Switches (No UI)

| Switch | Effect |
|--------|--------|
| `?genie=off` appended to any search URL | Disables Genie strip for that session |
| `GENIE_ENABLED=false` in env | Disables Genie globally for all users |
| `?debug=1` appended to `/search` or `/results` | Shows trigger diagnostics panel |

---

## Post-Deploy Smoke Test

```bash
# Replace with your deployed URL
BASE_URL=https://your-app.vercel.app

# Health check
curl $BASE_URL/api/health

# Search
curl "$BASE_URL/api/search?q=pool"

# Genie coach (should trigger for "pool")
curl -s -X POST "$BASE_URL/api/coach/analyze" \
  -H "Content-Type: application/json" \
  -d '{"query":"pool","genieOff":false}' | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('triggered:', d.triggered, 'questions:', d.questions?.length)"
```

Expected:
- `/api/health` → `{ "ok": true }`
- `/api/search?q=pool` → 20+ results
- `/api/coach/analyze` for `"pool"` → `triggered: true, questions: 3`

---

## Attribution (Legal)

All photos are from **Pixabay** (free for commercial use under Pixabay License).
A "Photos from Pixabay" credit is shown on all photo-bearing screens.
Dates, places and cast names shown are **synthetic** (AI-generated for demo purposes).
