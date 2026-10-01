# Pre-Search "Narrow It Down" Coach (Google Photos Look-alike MVP)

An evaluative A/B testing prototype comparing unassisted baseline search (**Mode A**) with an interactive proactive coaching assistant (**Mode B**) on a curated 100-photo library.

Designed and engineered for a Google Photos product-management case study. Built with Next.js 16 (App Router), TypeScript, Tailwind CSS, Groq 120B (`openai/gpt-oss-120b`), and Gemini Vision models ($\ge 3.5\text{ Flash}$).

---

## 1. Quickstart & Local Setup

### Prerequisites
- **Node.js** $\ge 18.x$ LTS
- **npm** $\ge 9.x$
- **Python** $\ge 3.10$

### Installation & Launch
```bash
# 1. Clone repository and install dependencies
git clone https://github.com/<your-username>/gp2-solution.git
cd "Gp2 solution"
npm install

# 2. Configure environment variables
cp .env.example .env.local

# 3. Start local development server
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser or mobile viewport (recommended: Chrome DevTools device mode at 390px width).

---

## 2. Environment Variables

All variables are template-documented in `.env.example`. Create `.env.local` for local execution.

| Variable | Scope | Purpose | Example |
|---|---|---|---|
| `GROQ_API_KEY` | Runtime (Server) | Real-time prompt composition with Groq | `your_groq_api_key_here` |
| `GROQ_MODEL` | Runtime (Server) | Groq LLM model name | `openai/gpt-oss-120b` |
| `MODERATOR_PIN` | Runtime (Server) | PIN protection for `/moderator` console | `1234` |
| `TASK_TIME_LIMIT_SEC`| Runtime (Server) | Maximum search task countdown timer | `180` |
| `PIXABAY_API_KEY` | Offline Script | Photo library ingestion (100 images) | `your_pixabay_api_key_here` |
| `GEMINI_API_KEY` | Offline Script | Vision tagging pipeline ($\ge 3.5\text{ Flash}$) | `your_gemini_api_key_here` |
| `GEMINI_MODEL` | Offline Script | Gemini Flash model name | `gemini-3.6-flash` |
| `DATABASE_URL` | Runtime (Optional) | Optional Supabase / Postgres connection | `postgresql://...` |

> ⚠️ **Security Note:** `PIXABAY_API_KEY` and `GEMINI_API_KEY` are used **strictly offline** in preparation scripts. They are never shipped to client code or required in Vercel.

---

## 3. Core App Routes

| Route | Screen ID | Description |
|---|---|---|
| `/` | **S1** | Google Photos Home grid displaying 100 diversified library photos |
| `/search` | **S2, S3, S4, S5** | Search interface with Mode A plain search and Mode B AI Coach |
| `/results` | **S6, S8** | Scored search results grid with relevance scores and zero-results fallback |
| `/photo/[id]` | **S7** | Full-screen photo viewer with study verification ("This is the photo" / "Keep looking") |
| `/study` | **S10, S11** | Study mode screens: S10 Target Reveal (5s preview) and S11 Task End Survey |
| `/moderator` | **S9** | PIN-protected console to set participant ID, Mode A/B, select target, and monitor live events |
| `/admin` | Dashboard | Study metrics summary: success rate, average time to find, mode comparisons |
| `/about` | **S12** | Project disclaimer, licensing notes, and full photographer credits directory |
| `/api/admin/export.csv` | API | Downloads full study session metrics in standard RFC 4180 CSV format |

---

## 4. How to Run Offline Scripts

### 4.1 Re-downloading Photo Library
```bash
# Ingests 100 photos across 10 diverse themes into public/library/ and creates data/credits.csv
python scripts/download_pixabay.py
```

### 4.2 Re-tagging the Photo Library
```bash
# Runs Gemini Vision model rotation across all 100 photos into data/tags.json
python scripts/tag_library.py --output data/tags.json
```

### 4.3 Running Automated Test & Evaluation Suites
```bash
# Search retrieval tests (SR-01 to SR-14)
npx tsx scripts/test_search_evals.ts

# Vague query classifier tests (VC-01 to VC-10)
npx tsx scripts/test_vague_evals.ts

# Coach engine entropy & question selection tests (CE-01 to CE-12)
npx tsx scripts/test_coach_evals.ts

# Groq prompt composer & hallucination guard tests (PC-01 to PC-10)
npx tsx scripts/test_prompt_composer_evals.ts

# Full end-to-end Phase 4/5 integration checkpoint
python scripts/verify_phase4_checkpoint.py
```

---

## 5. Exporting Study Data

During user study testing, all interactions (query keystrokes, chip taps, prompt edits, photo opens, time-to-find, survey answers) are logged continuously.

To export the complete dataset:
1. Navigate to `/moderator` or `/admin` and click **"Export CSV"**, OR
2. Directly visit **`/api/admin/export.csv`** in any browser.

The output complies with RFC 4180 CSV formatting and includes:
- `session_id`, `participant_id`, `mode` (`A` or `B`), `target_id`
- `outcome` (`found`, `timeout`, `gave_up`)
- `time_to_find_sec`, `queries_count`, `chips_tapped_count`
- `prompt_edited` (`true` or `false`)
- `difficulty_rating` (1–5), `satisfaction_rating` (1–5), and qualitative `comment`

---

## 6. Assumptions Made

1. **Google Photos Look & Feel:** Mobile-first layout calibrated to a 390px centered container, Google Photos color tokens (`#1F6FEB` Google Blue, `#EEF0F3` pill surfaces, `#1F1F1F` high-contrast typography, and Material Symbols Outlined).
2. **Identical Search Backend:** Both Mode A (unassisted) and Mode B (coach-assisted) use the exact same multi-cue weighted search algorithm (`src/lib/search.ts`). The difference in outcome is driven entirely by query formulation and coaching intervention.
3. **Cheap Tag Lookup Assumption:** At Google scale, this prototype assumes Google Photos maintains a fast, lightweight metadata/tag index for candidate filtering, and that rich scene cues for older photos can be populated via background inference.
4. **Zero Magic Numbers:** All scoring weights, candidate thresholds, and timeout constants are centralized in `src/lib/config.ts`.
5. **Offline Vision & Low Latency:** Gemini vision is used strictly offline for pre-tagging to ensure $\le 200\text{ms}$ search responses and zero runtime dependence on multi-modal vision APIs.

---

## 7. Known Limitations (from Spec Section 15)

1. **Stand-in Search Engine:** The search engine is a multi-cue weighted lexical ranker, not Google's production multimodal ranking system. The study evaluates how the coach alters *what users search for and how quickly they narrow candidates down*, rather than Google's proprietary index.
2. **Curated Stock Photo Library:** The library contains 100 stock photographs from Pixabay and Pexels. These photos are cleaner, higher quality, and have fewer duplicates or low-light shots than messy personal consumer camera rolls.
3. **Candidate Set Preview at Scale:** Calculating candidate counts is instantaneous for 100 photos. At Google scale (billions of photos per user library), calculating live candidate sets requires indexed tag lookups and pre-computed faceted counts.
4. **AI-Inferred Scene Details:** Scene details beyond simple tags (inferred occasion, clothing item colors, activities) are generated by Gemini models and may contain inaccuracies. Occasion is always presented as a soft guess.
5. **Directional Sample Size:** The user study protocol targets 3 to 5 participants (2 tasks each: 1 Mode A, 1 Mode B). Findings are directional qualitative indicators rather than statistically powered conclusions.
6. **Query Formulation Cues:** If a downstream semantic search engine drops cues from multi-cue queries, an over-specified composed prompt could return zero results. The S5 Prompt Review step explicitly mitigates this by allowing users to edit the prompt and remove individual cue pills before executing the search.
7. **Privacy & Consent Boundaries:** In production, this coach is intended only for users who have opted into Gemini features in Google Photos. It reuses existing scene understanding with no external data transmission and can be toggled off at any time.

---

## 8. Deployment (Vercel)

To deploy to Vercel:
1. Push repository to GitHub:
   ```bash
   git push origin main
   ```
2. Import repository into [Vercel](https://vercel.com).
3. Set the following Environment Variables in the Vercel dashboard:
   - `GROQ_API_KEY`
   - `GROQ_MODEL=openai/gpt-oss-120b`
   - `MODERATOR_PIN=1234`
4. Deploy. The application runs as a serverless Next.js App Router project without any external vision or database dependencies required for evaluation.

---

## 9. About & Credits (S12)

All photo credits, photographer names, canonical links, and license statements are accessible within the application at **`/about`** and documented in **`data/credits.csv`**. Photos are utilized under the Pexels License and Pixabay License.
