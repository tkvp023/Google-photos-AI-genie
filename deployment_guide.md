# Deployment Guide — Google Photos AI Genie MVP

> **Architecture:** Single stateless Next.js service with flexible deployment:
> - **Dual-Deploy (Recommended):** Frontend on **Vercel** + Backend on **Railway**
> - **All-in-One:** Entire app deployed on either Vercel or Railway alone.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | >= 18 |
| npm | >= 9 |
| Git | Latest |

---

## 1. Deploy Backend to Railway

Railway acts as the state-machine/API server for search, coach/Genie analysis, and photo metadata.

### Step 1: Push / Link Git Repository
1. Go to [railway.app](https://railway.app) and sign in.
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select your repository: `Google-photos-AI-genie` (branch: `main` or `tester-experience`).

### Step 2: Service Configuration
Railway automatically detects `railway.json` and Nixpacks:
- **Build Command:** `npm run build`
- **Start Command:** `npm run start` (binds to `0.0.0.0` and uses `$PORT`)
- **Healthcheck Path:** `/api/health`

### Step 3: Set Environment Variables on Railway
In Railway Dashboard → **Variables**:

| Variable | Value | Purpose |
|----------|-------|---------|
| `GENIE_ENABLED` | `true` | Enables Genie strip & suggestions |
| `GEMINI_API_KEY` | *(your key from Google AI Studio)* | Powers Gemini Question Planner & Query Analyzer |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model name (default: `gemini-2.5-flash`) |
| `PLANNER_ENABLED` | `true` | Activates Gemini LLM Question Planner (auto-enabled if key provided) |
| `GROQ_API_KEY` | *(optional)* | Fallback LLM provider if used |

### Step 4: Generate Domain
In Railway Dashboard → Service → **Settings** → **Networking** → Click **Generate Domain**.
Copy your public domain (e.g. `https://google-photos-backend.up.railway.app`).

### Verify Backend
```bash
curl https://your-app.up.railway.app/api/health
```
Response:
```json
{
  "ok": true,
  "version": "0.2.0",
  "tagCoverage": 1,
  "photoCount": 200
}
```

---

## 2. Deploy Frontend to Vercel

Vercel hosts the responsive phone chassis interface, tester callouts, and pages.

### Step 1: Import Project into Vercel
1. Go to [vercel.com](https://vercel.com) and sign in.
2. Click **Add New...** → **Project**.
3. Select your repository: `Google-photos-AI-genie` (branch: `main` or `tester-experience`).
4. **Framework Preset:** Next.js (detected automatically).
5. **Root Directory:** `./`

### Step 2: Connect Frontend to Railway Backend
In Vercel → **Environment Variables**, add:

| Variable | Value | Purpose |
|----------|-------|---------|
| `BACKEND_URL` | `https://your-app.up.railway.app` | Tells Vercel to route all `/api/*` requests to Railway |
| `GENIE_ENABLED` | `true` | Master Genie toggle |

> **How it works:** When `BACKEND_URL` is set, `next.config.ts` automatically proxies all `/api/*` traffic from Vercel to your Railway backend. There are **zero CORS issues** and no client bundle modifications needed!
> If `BACKEND_URL` is omitted, Vercel will run the API routes serverlessly on its own.

### Step 3: Deploy
Click **Deploy**. Within ~1 minute, your Vercel deployment will be live!

---

## 3. Architecture & Security Highlights

1. **CORS Preflight & Headers:**
   `src/proxy.ts` handles all CORS headers and `OPTIONS` preflight requests on Railway with `204 No Content` and standard headers (`Access-Control-Allow-Origin: *`, `GET, POST, OPTIONS`).

2. **Serverless Asset Bundling:**
   `next.config.ts` includes `outputFileTracingIncludes` so that `data/` and `public/library/` are automatically packaged into serverless functions on Vercel.

3. **Fallback Data Loading:**
   `src/lib/dataLoader.ts` contains a fallback mechanism: even if a serverless environment separates CDN assets from the function disk, all 200 photo records, metadata, and tags are loaded deterministically from memory/JSON.

---

## 4. Smoke Test Checklist

Once both are deployed, run these checks:

| Check | URL / Action | Expected Result |
|-------|--------------|-----------------|
| Railway Health | `https://your-railway.up.railway.app/api/health` | `{"ok":true,"photoCount":200}` |
| Vercel Health | `https://your-vercel.vercel.app/api/health` | `{"ok":true,"photoCount":200}` |
| Search API | `https://your-vercel.vercel.app/api/search?q=pool` | Returns 20+ photos |
| Coach API | POST `.../api/coach/analyze` with `{"query":"pool"}` | `{"triggered":true,...}` |
| Frontend UI | Open `https://your-vercel.vercel.app/` | Phone frame renders with 200-photo timeline |
| Guide Mode | Toggle Guide switch (top-left) | Callout boxes appear cleanly outside chassis |
