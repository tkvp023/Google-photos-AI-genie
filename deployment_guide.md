# DEPLOYMENT GUIDE — VERCEL & RAILWAY
## Google Photos Look-alike MVP ("Pre-Search Narrow It Down Coach")

> **Target Architecture:**
> - **Frontend:** [Vercel](https://vercel.com) (Next.js App Router, Static Assets & CDN, Client UI)
> - **Backend:** [Railway](https://railway.app) (Node.js Container, Search Engine, Groq LLM Composer, Persistent Event Storage, Healthchecks)
> - **Connection Strategy:** Zero-CORS Next.js Server Rewrite Proxy (Vercel proxies `/api/*` directly to Railway) + Universal CORS headers in `src/proxy.ts` for direct queries.

---

## 1. Architecture & How It Works

```
                   +---------------------------------------------+
                   |               Browser / Client              |
                   +---------------------------------------------+
                                     |
               +---------------------+---------------------+
               |                                           |
      (HTML / Static / UI)                           (API Requests)
               |                                           |
               v                                           v
    +-----------------------+                   +-----------------------+
    |   Vercel (Frontend)   |                   |   Vercel /api Proxy   |
    |  • App Pages (S1-S12) |                   |  (next.config rewrite)|
    |  • Responsive Design  |                   +-----------------------+
    |  • Edge CDN Assets    |                               |
    |  • /library/*.jpg     |                               | Proxies to
    +-----------------------+                               | BACKEND_URL
                                                            v
                                                +-----------------------+
                                                |   Railway (Backend)   |
                                                |  • /api/search        |
                                                |  • /api/coach/*       |
                                                |  • /api/log           |
                                                |  • /api/admin/export  |
                                                |  • /api/health        |
                                                |  • Groq LLM (S5)      |
                                                |  • data/events.json   |
                                                |  • Optional Volume    |
                                                +-----------------------+
```

### Key Advantages of This Architecture
1. **Zero CORS Issues:** When `BACKEND_URL` is set on Vercel, requests to `/api/*` are proxied server-to-server. The browser communicates with the same origin.
2. **Persistent Event Storage on Railway:** Unlike Vercel's serverless read-only filesystem, Railway containers run continuously and support persistent volume mounts (`DATA_DIR=/data`), guaranteeing study session logs (`events.json`) are preserved permanently across redeploys.
3. **Optimized Photo Delivery:** The 100 stock photographs in `public/library/` are cached and served globally by Vercel's Edge CDN.

---

## 2. Environment Variables Matrix

| Variable Name | Required On | Description | Example / Recommended Value |
|---|---|---|---|
| `BACKEND_URL` | **Vercel** | Public URL of your Railway backend service | `https://your-backend.up.railway.app` |
| `GROQ_API_KEY` | **Railway** | Groq API Key for S5 prompt composer | `gsk_...` |
| `GROQ_MODEL` | **Railway** | Groq LLM model identifier | `openai/gpt-oss-120b` |
| `MODERATOR_PIN` | **Railway** | PIN required for Moderator Console & CSV Export | `1234` |
| `TASK_TIME_LIMIT_SEC` | **Railway & Vercel** | Study task countdown duration (seconds) | `180` |
| `ALLOWED_ORIGIN` | **Railway** | CORS origin allowed for direct API queries | `*` or `https://your-frontend.vercel.app` |
| `DATA_DIR` | **Railway** *(Optional)* | Custom path if using a Railway Volume | `/data` (leave empty for `./data`) |
| `NEXT_OUTPUT_STANDALONE` | **Railway** *(Optional)* | Toggles standalone Next.js build | `false` (default) |
| `PIXABAY_API_KEY` | **None** *(Local only)* | Only for offline script `download_pixabay.py` | *Do NOT set in Vercel or Railway* |
| `GEMINI_API_KEY` | **None** *(Local only)* | Only for offline script `tag_library.py` | *Do NOT set in Vercel or Railway* |

---

## 3. Step 1: Deploy Backend to Railway

### 3.1 Create a Railway Project
1. Log in to [Railway](https://railway.app).
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select your repository: `Gp2-solution` (or your repository name).
4. Do not deploy yet; Railway will create the service.

### 3.2 Configure Railway Environment Variables
Navigate to your service → **Variables** tab, and add:

```env
GROQ_API_KEY=your_actual_groq_key_here
GROQ_MODEL=openai/gpt-oss-120b
MODERATOR_PIN=1234
TASK_TIME_LIMIT_SEC=180
ALLOWED_ORIGIN=*
```

### 3.3 (Optional) Attach a Persistent Volume for Study Logs
To retain `events.json` permanently across container restarts:
1. In your Railway service view, click **+ New** → **Volume**.
2. Mount Path: `/data`.
3. Go back to service **Variables**, add:
   ```env
   DATA_DIR=/data
   ```

### 3.4 Enable Public Networking (Generate Domain)
1. In your service settings, navigate to **Settings** → **Networking** → **Public Networking**.
2. Click **Generate Domain**.
3. Railway will assign a domain such as:
   ```
   https://gp2-backend-production.up.railway.app
   ```
4. Copy this URL — you will need it for Vercel in Step 2.

### 3.5 Verify Railway Health Check
Railway will automatically build using the included `railway.json` and start the server. Test your Railway URL:
```bash
curl https://<your-railway-domain>.up.railway.app/api/health
```
**Expected Response:**
```json
{"status":"healthy","service":"google-photos-mvp","uptime":12,"timestamp":"2026-10-01T...","env":"production"}
```

---

## 4. Step 2: Deploy Frontend to Vercel

### 4.1 Import Project to Vercel
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New...** → **Project**.
3. Select your GitHub repository.
4. Leave framework settings as **Next.js** (default).

### 4.2 Configure Vercel Environment Variables
Under the **Environment Variables** section before deploying, add:

```env
BACKEND_URL=https://<your-railway-domain>.up.railway.app
NEXT_PUBLIC_APP_NAME="Google Photos AI Coach"
MODERATOR_PIN=1234
TASK_TIME_LIMIT_SEC=180
```
> **Important:** Ensure `BACKEND_URL` uses `https://` and has no trailing slash.

### 4.3 Click Deploy
Vercel will build the frontend and deploy it to a domain such as:
```
https://gp2-frontend.vercel.app
```

---

## 5. Post-Deployment Verification & Smoke Tests

Run these checks against your production Vercel frontend URL (`https://your-frontend.vercel.app`):

### 1. Healthcheck via Vercel Proxy
```bash
curl -i https://your-frontend.vercel.app/api/health
```
- **Expected:** HTTP 200 OK with `{"status":"healthy",...}`

### 2. Lexical Search Endpoint
```bash
curl -i https://your-frontend.vercel.app/api/search?q=pool&mode=A
```
- **Expected:** HTTP 200 OK returning `count >= 1` and photo results.

### 3. Coach Specificity Analysis
```bash
curl -i -X POST https://your-frontend.vercel.app/api/coach/analyze \
  -H "Content-Type: application/json" \
  -d '{"query":"pool","mode":"B"}'
```
- **Expected:** HTTP 200 OK with `triggered: true`, `bucket: "some"` or `"many"`, and 3 questions.

### 4. Event Logging
```bash
curl -i -X POST https://your-frontend.vercel.app/api/log \
  -H "Content-Type: application/json" \
  -d '{"type":"test_deploy","sessionId":"prod_check","participantId":"P01","mode":"B","payload":{}}'
```
- **Expected:** HTTP 200 OK with `{"ok":true}`.

### 5. CSV Export Security & PIN Protection
```bash
# A. Unauthenticated request MUST fail
curl -i https://your-frontend.vercel.app/api/admin/export.csv
# Expected: HTTP 401 Unauthorized

# B. Authenticated request MUST succeed
curl -i "https://your-frontend.vercel.app/api/admin/export.csv?pin=1234"
# Expected: HTTP 200 OK with Content-Type: text/csv
```

### 6. Interactive Browser Verification
1. Visit `https://your-frontend.vercel.app/search?mode=B`.
2. Type `pool` → Verify the AI Search Coach card appears with narrowing chips within 500ms.
3. Tap **"Friends"** → Verify live count updates to `9 photos`.
4. Click **"Build my search"** → Verify Groq composes `pool friends` and opens Prompt Review.
5. Click **"Search"** → Verify photos grid displays matching pool photos.
6. Click any photo → Fullscreen viewer opens.
7. Visit `https://your-frontend.vercel.app/moderator` → Unlock with PIN `1234` → Launch task.
8. Visit `https://your-frontend.vercel.app/about` → Verify all 100 photographer attributions render.

---

## 6. Troubleshooting & FAQs

### Q1: The coach does not appear on Vercel frontend.
- **Check 1:** Ensure `BACKEND_URL` is configured in Vercel project environment variables and points to the live Railway domain.
- **Check 2:** Verify your mode is **Mode B** (`/search?mode=B`). By design (CI-01), the coach is strictly isolated and never appears in Mode A.
- **Check 3:** Check Railway service logs in Railway dashboard to see if requests are reaching the backend.

### Q2: Why does `export.csv` give 401 Unauthorized?
- The export route is protected. Provide the PIN either as a query parameter:
  `?pin=1234`
  or as an HTTP header:
  `Authorization: Bearer 1234`

### Q3: Railway backend returns 502 / Application Failed to Respond.
- Ensure the start command is `npm run start` (which executes `next start -H 0.0.0.0`). The `-H 0.0.0.0` flag allows container networking to bind to all interfaces.
- Check that the Railway healthcheck path is set to `/api/health`.

### Q4: Are photos saved in Railway or Vercel?
- All 100 library photos (`/public/library/*.jpg`) are bundled in the repository. Vercel serves them directly through its worldwide Edge CDN for instant loading.

### Q5: Can I run both frontend and backend on Railway?
- Yes. If you prefer a single-host deployment, Railway can run the entire app by itself. Simply deploy the repository to Railway without setting `BACKEND_URL` on Vercel. Both work seamlessly.
