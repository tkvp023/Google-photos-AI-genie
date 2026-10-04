# Deployment & Configuration Guide — Google Photos AI Genie MVP

> **Architecture:** Single stateless Next.js service with flexible deployment:
> - **Dual-Deploy (Recommended):** Frontend on **Vercel** + Backend on **Railway**
> - **All-in-One:** Entire app deployed on either Vercel or Railway alone.

---

## 1. How the Genie AI Engine Works

When a user types a vague query (e.g., `"pool"`, `"beach"`, `"trip"`), the backend decides whether and what questions to ask:

1. **Candidate Retrieval & Entropy Analysis:**
   - The engine retrieves matching candidates from the 200 curated library photos.
   - If broad intent is detected (candidates ≥ 6 and vague query with < 2 anchors), Genie triggers.
2. **Gemini Question Planner (`src/lib/questionPlanner.ts`):**
   - When `GEMINI_API_KEY` is provided, Gemini is invoked with an internal cognitive preprompt:
     > *"You help someone narrow down a vaguely remembered photo. You are given the text they typed and a list of photo details (fields) that would split the matching photos. Choose up to 3 fields, one per cueType, ordered by how natural they are to ask given the user's text, and write one short question per field..."*
   - Gemini evaluates the typed text against candidate attributes (Who, Where, What, When, Mood) and formats natural, human-friendly questions.
3. **Zero-Downtime Deterministic Fallback:**
   - If Gemini is disabled, times out (>1500ms), or reaches rate limits, the system seamlessly falls back to our local Shannon-entropy engine (`selectQuestions`).
   - The user always receives instant (< 5ms) memory cue chips without interruption or error.

---

## 2. Deploy Backend to Railway

Railway acts as the API server for lexical search, photo metadata, and the Gemini Coach engine.

### Step 1: Link Your GitHub Repository
1. Go to [railway.app](https://railway.app) and sign in.
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select `Google-photos-AI-genie` (branch: `main`).

### Step 2: Build & Start Configuration
Railway automatically detects `railway.json` and Nixpacks:
- **Build Command:** `npm run build`
- **Start Command:** `npm run start` (binds to `0.0.0.0` and uses Railway's dynamic `$PORT`)
- **Healthcheck Path:** `/api/health`

### Step 3: Set Environment Variables on Railway
In Railway Dashboard → Your Project → **Variables**, configure:

| Variable | Recommended Value | Purpose |
|----------|-------------------|---------|
| `GEMINI_API_KEY` | `AIzaSy...` *(from Google AI Studio)* | **Required for Gemini:** Powers question planning and query analysis |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Fast, low-latency model for real-time question generation |
| `PLANNER_ENABLED` | `true` | Activates Gemini Question Planner (auto-enabled if `GEMINI_API_KEY` is present) |
| `GENIE_ENABLED` | `true` | Master toggle for the entire Genie coach feature |
| `GROQ_API_KEY` | *(optional)* | Fallback LLM provider if used |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Fallback model name |

### Step 4: Generate a Public Domain
1. In Railway → Your Service → **Settings** → **Networking**.
2. Click **Generate Domain**.
3. Copy the URL (e.g., `https://google-photos-backend.up.railway.app`).

### Step 5: Test the Backend
Run in your terminal:
```bash
# 1. Healthcheck
curl https://your-backend.up.railway.app/api/health
# Expected: {"ok":true, "version":"0.2.0", "tagCoverage":1, "photoCount":200}

# 2. Test Gemini Question Planner
curl -s -X POST https://your-backend.up.railway.app/api/coach/analyze \
  -H "Content-Type: application/json" \
  -d '{"query":"pool"}' | grep -o '"planner_source":"[^"]*"'
# Expected: "planner_source":"gemini" (or "deterministic" if key is omitted)
```

---

## 3. Deploy Frontend to Vercel

Vercel serves the phone chassis, the normal/guide mode toggle, and callout overlays with global edge caching.

### Step 1: Import Project into Vercel
1. Go to [vercel.com](https://vercel.com) and sign in.
2. Click **Add New...** → **Project**.
3. Select `Google-photos-AI-genie` (branch: `main`).
4. **Framework Preset:** Next.js (detected automatically).
5. **Root Directory:** `./`

### Step 2: Connect Frontend to Railway
In Vercel → **Environment Variables**, add:

| Variable | Value | Purpose |
|----------|-------|---------|
| `BACKEND_URL` | `https://your-backend.up.railway.app` | Tells Vercel to route all `/api/*` requests to Railway |
| `GENIE_ENABLED` | `true` | Master Genie toggle |

> **Why this is zero-CORS:** `next.config.ts` includes an automatic server-side rewrite. When the browser makes a request to `/api/coach/analyze` on Vercel, Vercel proxies it to Railway server-to-server. No CORS errors, no mixed content warnings, and no client rebuild required!
> If `BACKEND_URL` is left empty, Vercel will run the API routes serverlessly on its own.

### Step 3: Deploy
Click **Deploy**. Your Vercel deployment will be live in ~1 minute.

---

## 4. Architecture & Resilience Features

1. **Next.js 16 Proxy ([`src/proxy.ts`](file:///c:/Users/THARUN/Videos/Gp2%20solution/src/proxy.ts)):**
   - Intercepts all `/api/*` routes.
   - Handles CORS preflight `OPTIONS` requests (`204 No Content`) with `Access-Control-Allow-Origin: *`.
   - Appends CORS headers to all responses so Railway can be called directly by any client.

2. **Serverless Asset Bundling ([`next.config.ts`](file:///c:/Users/THARUN/Videos/Gp2%20solution/next.config.ts)):**
   - Configured with `outputFileTracingIncludes` so `./data/**/*` and `./public/library/**/*` are bundled into serverless functions on Vercel.

3. **In-Memory Fallback ([`src/lib/dataLoader.ts`](file:///c:/Users/THARUN/Videos/Gp2%20solution/src/lib/dataLoader.ts)):**
   - If a cloud environment isolates static CDN assets, the data store automatically falls back to populating the photo catalog and metadata from `tags.json`.

---

## 5. End-to-End Verification Checklist

Once both platforms are deployed, verify the entire flow:

| Test | URL / Action | Expected Result |
|---|---|---|
| **Railway Health** | `https://your-backend.up.railway.app/api/health` | `{"ok":true, "photoCount":200}` |
| **Vercel Health** | `https://your-frontend.vercel.app/api/health` | `{"ok":true, "photoCount":200}` (proxied from Railway) |
| **Search API** | `https://your-frontend.vercel.app/api/search?q=pool` | Returns 20+ tagged pool photos |
| **Gemini Planner** | POST `.../api/coach/analyze` with `{"query":"pool"}` | `{"triggered":true, "planner_source":"gemini", ...}` |
| **Pixel Chassis UI** | Open `https://your-frontend.vercel.app/` | Phone frame renders with timeline and navigation |
| **Guide Mode** | Click toggle switch (top-left) | Explanatory callouts appear outside phone chassis |
| **Genie Strip** | Type `"pool"` in search bar | Genie strip appears above keyboard with Who, Where, Vibe chips |
