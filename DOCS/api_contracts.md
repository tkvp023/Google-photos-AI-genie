# API_CONTRACTS.md — Full API Specification
## Pre-Search "Narrow It Down" Coach — Google Photos MVP

> **Rule:** Every API route must match this contract exactly. Deviations must be updated here first, then implemented.
> **Base URL (local):** `http://localhost:3000`  
> **Base URL (deployed):** `https://<app>.vercel.app`

---

## Shared Conventions

- All requests and responses are **JSON** (`Content-Type: application/json`) unless noted.
- All timestamps are **ISO 8601 UTC** strings: `"2026-10-03T08:30:00.000Z"`.
- All routes return `{ error: "<message>" }` on 4xx/5xx with an appropriate HTTP status code.
- `sessionId` is a **UUID v4** generated client-side at task start. Pass it on every call in a session.
- The client must never expose API keys. All external calls (Groq, Supabase) are server-side only.

---

## Types Reference

```typescript
type CueType = "who" | "occasion" | "look" | "what" | "where" | "when";
type Mode    = "A" | "B" | "C";
type Outcome = "found" | "gave_up" | "timeout" | "moderator_end";
type Bucket  = "few" | "some" | "many";
type Layer   = "library" | "generic" | "none";
type Composer = "groq" | "fallback";

interface PhotoResult {
  id: string;           // filename without extension, e.g. "pool_01"
  file: string;         // full filename, e.g. "pool_01.jpg"
  score: number;        // float, e.g. 6.5
  matchedFields: string[]; // e.g. ["setting", "group_type"]
}

interface Answer {
  questionId: string;   // e.g. "q_who"
  cueType: CueType;
  value: string;        // e.g. "friends"
  source: "chip" | "typed"; // how the answer was given
}

interface QuestionOption {
  label: string;        // display text, e.g. "Friends"
  value: string;        // normalised value, e.g. "friends"
  isGuess?: boolean;    // true for occasion options (show "?" suffix)
}

interface Question {
  id: string;           // e.g. "q_who"
  cueType: CueType;
  field: string;        // tag field used, e.g. "group_type"
  text: string;         // question text shown to user
  layer: Layer;
  options: QuestionOption[];
  allowText: boolean;   // always true
  allowDontRemember: boolean; // always true
}

interface Cue {
  type: CueType;
  value: string;
}

interface Anchor {
  person: boolean;
  time: boolean;
  location: boolean;
}
```

---

## 1. `GET /api/photos`

Returns the full library for rendering the Photos home grid.

### Request

```
GET /api/photos
```

No body, no auth required.

### Response `200`

```typescript
{
  photos: Array<{
    id: string;     // "pool_01"
    file: string;   // "pool_01.jpg"
    theme: string;  // "pool"
    src: string;    // "/library/pool_01.jpg"
  }>
}
```

### Error Responses

| Status | When | Body |
|---|---|---|
| `500` | `tags.json` failed to load | `{ error: "Library not available" }` |

### Notes

- Sorted by theme then filename (deterministic order).
- `src` is a relative URL to `/public/library/`.
- Does not include tag data (client doesn't need it).

---

## 2. `POST /api/search`

Runs the lexical search scorer and returns ranked results.

### Request

```typescript
{
  query: string;       // required; the search text
  sessionId: string;   // required; UUID v4
  mode: Mode;          // required; "A", "B", or "C"
}
```

### Response `200`

```typescript
{
  results: PhotoResult[];
  count: number;
  bucket: Bucket;
}
```

### Error Responses

| Status | When | Body |
|---|---|---|
| `400` | Missing `query` or `mode` | `{ error: "query and mode are required" }` |
| `400` | `mode` not in `["A","B","C"]` | `{ error: "Invalid mode" }` |
| `500` | Search function throws | `{ error: "Search failed" }` |

### Notes

- Empty or stopwords-only query returns `{ results: [], count: 0, bucket: "few" }`.
- Logs `search_submitted` event (fire-and-forget; never fails the request).
- `topIds` (top 5 result IDs) included in the logged event but not in the response.
- In debug mode, `matchedFields` and `score` are already in the response — no special flag needed on server.

---

## 3. `POST /api/coach/analyze`

Runs vague check + preview search + question selection. Called after debounce in Mode B only.

### Request

```typescript
{
  query: string;       // required; the typed text so far
  sessionId: string;   // required
}
```

### Response `200`

```typescript
{
  isVague: boolean;
  anchors: Anchor;
  preciseCount: number;       // 0, 1, or 2
  triggered: boolean;         // true if all coach trigger rules pass
  layer: Layer;               // "library" | "generic" | "none"
  bucket: Bucket;             // preview match count bucket
  candidateCount: number;     // raw count (not shown to user; debug only)
  questions: Question[];      // empty if triggered=false
}
```

### Error Responses

| Status | When | Body |
|---|---|---|
| `400` | Missing `query` | `{ error: "query is required" }` |
| `500` | Internal error | `{ error: "Analysis failed" }` |

### Notes

- Called ONLY from Mode B frontend. Mode A must never call this endpoint.
- Logs `vague_check` event always. Logs `coach_triggered` and `coach_shown` only if `triggered: true`.
- `candidateCount` is in the response for debug mode. Frontend shows it only with `?debug=1`.
- If `triggered: false`, `questions: []`.

---

## 4. `POST /api/coach/answer`

Updates candidate set and re-ranks questions after a chip tap. Called on every answer.

### Request

```typescript
{
  query: string;       // required; original typed text (unchanged)
  answers: Answer[];   // required; ALL answers so far (not just the new one)
  sessionId: string;   // required
}
```

### Response `200`

```typescript
{
  bucket: Bucket;              // updated preview bucket after applying answers
  candidateCount: number;      // for debug mode
  questions: Question[];       // re-ranked; already-answered cue types absent
}
```

### Error Responses

| Status | When | Body |
|---|---|---|
| `400` | Missing `query` or `answers` | `{ error: "query and answers are required" }` |
| `500` | Internal error | `{ error: "Re-rank failed" }` |

### Notes

- Logs `chip_tapped` for the new answer (client should send only the delta, but server processes all).
- Actually: the client logs `chip_tapped` directly via `/api/log`. This endpoint only re-ranks.
- If `questions: []`, client shows only "Build my search" button.
- No AI call. Pure in-memory computation. Should return in < 200ms.

---

## 5. `POST /api/coach/compose`

Composes the natural-language prompt via Groq (with deterministic fallback).

### Request

```typescript
{
  query: string;       // required; original typed text
  answers: Answer[];   // required; all tapped/typed answers (skipped excluded)
  sessionId: string;   // required
}
```

### Response `200`

```typescript
{
  prompt: string;      // the composed prompt text; ≤ 200 chars
  cues: Cue[];         // structured cues for the removable chips in S5
  composer: Composer;  // "groq" or "fallback"
  cached: boolean;     // true if served from in-memory cache
}
```

### Error Responses

| Status | When | Body |
|---|---|---|
| `400` | Missing `query` | `{ error: "query is required" }` |
| `429` | Rate limit exceeded | `{ error: "Too many requests" }` |
| `500` | Unexpected error | `{ error: "Compose failed" }` |

### Notes

- Groq failure/timeout → fallback; response is still `200` with `composer: "fallback"`.
- Rate limit: 10 requests/minute per IP (configurable). Returns `429` only if threshold exceeded.
- Logs `prompt_composed` event including `latencyMs`.
- Cache key: `sha256(query + JSON.stringify(answers.sort(...)))`.

---

## 6. `POST /api/log`

Appends an event to the persistent event log.

### Request

```typescript
{
  ts: string;              // ISO 8601 UTC timestamp
  sessionId: string;       // required
  participantId: string;   // required (anonymous, e.g. "P01")
  mode: Mode;              // required
  type: string;            // event type string (see list below)
  payload: object;         // event-specific payload; {} if none
}
```

**Valid `type` values:**
`task_start`, `target_shown`, `target_hidden`, `query_typed`, `vague_check`, `coach_triggered`, `coach_shown`, `chip_tapped`, `chip_skipped`, `coach_reset`, `prompt_composed`, `prompt_edited`, `search_submitted`, `photo_opened`, `found`, `wrong_open`, `gave_up`, `timeout`, `task_end`, `survey_answered`

### Response `200` (always)

```typescript
{ ok: true }
```

### Notes

- **Never returns an error to the client.** Even if the DB write fails, return `{ ok: true }`.
- Validates loosely — unknown event types are accepted and stored.
- DB failure: log the error server-side; the client's localStorage queue handles retry.

---

## 7. `GET /api/admin/export.csv`

Exports all events and derived metrics as CSV. Protected by PIN.

### Request

```
GET /api/admin/export.csv
Authorization: Bearer <MODERATOR_PIN>
```

### Response `200`

```
Content-Type: text/csv
Content-Disposition: attachment; filename="study_export_<date>.csv"
```

**CSV columns (one row per session):**

| Column | Description |
|---|---|
| `session_id` | UUID of the task session |
| `participant_id` | Anonymous ID (e.g. "P01") |
| `mode` | "A", "B", or "C" |
| `target_id` | Target photo ID (e.g. "T01") |
| `task_start_ts` | ISO timestamp |
| `task_end_ts` | ISO timestamp |
| `outcome` | "found", "gave_up", "timeout", "moderator_end" |
| `first_query_text` | Text of first submitted query |
| `first_query_cue_count` | Number of distinct cue types in first query |
| `first_query_result_count` | Number of results from first query |
| `time_to_find_sec` | Seconds from task_start to found (null if not found) |
| `coach_triggered` | true/false |
| `coach_layer` | "library", "generic", or null |
| `chips_tapped_count` | Number of chip taps |
| `prompt_edited` | true/false |
| `composer` | "groq", "fallback", or null |
| `wrong_opens_count` | Number of "Not it" taps |
| `survey_easy` | 1–5 scale |
| `survey_confidence` | 1–5 scale |
| `survey_comment` | Free text |

### Error Responses

| Status | When | Body |
|---|---|---|
| `401` | Missing or wrong PIN | `{ error: "Unauthorized" }` |
| `500` | DB read error | `{ error: "Export failed" }` |

---

## Error Response Shape

All error responses follow this shape:

```typescript
{
  error: string;          // human-readable error message
  code?: string;          // optional machine-readable code
}
```

---

## Rate Limiting

| Endpoint | Limit | Window |
|---|---|---|
| `/api/coach/compose` | 10 requests | per minute per IP |
| All others | No limit (library is ~100 photos; load is tiny) | — |

Implementation: simple in-memory token bucket in the compose route handler.

---

*End of API_CONTRACTS.md*
