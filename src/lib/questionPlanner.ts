// src/lib/questionPlanner.ts — Gemini-powered Question Planner for Mode B Coach
// SERVER-SIDE ONLY.  Never import in client components.
// GEMINI_API_KEY and GEMINI_MODEL are read from env at call time (never NEXT_PUBLIC_*).
//
// Contract:
//  - Called at most once per coach trigger (after ALL shouldTrigger conditions pass).
//  - Never called per-keystroke, never in Mode A.
//  - Returns up to MAX_QUESTIONS Question objects with options sourced from candidate data.
//  - Falls back to deterministic engine on timeout, parse error, API error, or cap breach.
//  - Caches results by hash(normalised_text + sorted_candidate_ids).
//  - Logs: planner_source, planner_latency_ms, planner_fallback_reason, planner_same_fields_as_deterministic.

import { config } from "./config";
import { PhotoItem, Question, QuestionOption, CueType, Answer } from "@/types";
import { computeFieldDistribution } from "./coachEngine";
import { classifyCues } from "./cueClassifier";

export interface AllowedField {
  field: string;
  cueType: CueType;
  coverage: number;
  top_values: { value: string; count: number }[];
}

export interface PlannerResult {
  questions: Question[];
  planner_source: "gemini" | "deterministic";
  planner_latency_ms: number;
  planner_fallback_reason: "timeout" | "error" | "invalid" | "cap" | "disabled" | "";
  planner_same_fields_as_deterministic: boolean;
}

export interface GeminiQuestionPlan {
  questions: Array<{ field: string; cueType: string; text: string }>;
  unmatched_terms: string[];
}

// ─── In-memory cache & rate-limit counter ─────────────────────────────────────

const plannerCache = new Map<string, Question[]>();
// Track total calls within this server process instance
let totalPlannerCalls = 0;

function hashKey(text: string, candidateIds: string[]): string {
  const normText = text.toLowerCase().replace(/\s+/g, " ").trim();
  const sortedIds = [...candidateIds].sort().join(",");
  return `${normText}|${sortedIds}`;
}

// ─── Build allowed_fields list from current candidates ───────────────────────

const FIELDS_CONFIG: Array<{ field: string; cueType: CueType }> = [
  { field: "time_period", cueType: "when" },
  { field: "season_year", cueType: "when" },
  { field: "place_city", cueType: "where" },
  { field: "setting", cueType: "where" },
  { field: "indoor_outdoor", cueType: "where" },
  { field: "cast_people", cueType: "who" },
  { field: "group_type", cueType: "who" },
  { field: "activity", cueType: "what" },
  { field: "occasion_guess", cueType: "occasion" },
  { field: "clothing_color", cueType: "look" },
  { field: "time_of_day", cueType: "when" },
];

function buildAllowedFields(candidates: PhotoItem[], maxTopValues = 6): AllowedField[] {
  const result: AllowedField[] = [];
  for (const fc of FIELDS_CONFIG) {
    const dist = computeFieldDistribution(candidates, fc.field, fc.cueType);
    if (dist.coverage < config.MIN_FIELD_COVERAGE) continue;
    if (Object.keys(dist.counts).length < 2) continue;

    const top_values = Object.entries(dist.counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxTopValues)
      .map(([value, count]) => ({ value, count }));

    result.push({
      field: fc.field,
      cueType: fc.cueType,
      coverage: Math.round(dist.coverage * 100) / 100,
      top_values,
    });
  }
  return result;
}

// ─── Build options for a question from candidate data ────────────────────────

function buildOptionsFromField(
  candidates: PhotoItem[],
  field: string,
  cueType: CueType
): QuestionOption[] {
  const dist = computeFieldDistribution(candidates, field, cueType);
  const sortedEntries = Object.entries(dist.counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, config.MAX_OPTIONS);

  const isOccasion = cueType === "occasion";
  return sortedEntries.map(([val]) => {
    let label = val.charAt(0).toUpperCase() + val.slice(1);
    if (val === "this year") label = "This year";
    else if (val === "last year") label = "Last year";
    else if (val === "two years ago") label = "2 years ago";
    else if (val === "3 years ago") label = "3 years ago";
    else if (val === "earlier") label = "Earlier";
    else if (/^(summer|monsoon|winter|post-monsoon)\s+\d{4}$/i.test(val)) {
      label = val.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    } else if (cueType === "where" || cueType === "who") {
      label = val.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
    return {
      label: isOccasion ? `${label}?` : label,
      value: val,
      isGuess: isOccasion,
    };
  });
}

// ─── Validate Gemini plan against constraints ────────────────────────────────

function validateGeminiPlan(
  plan: GeminiQuestionPlan,
  allowedFields: AllowedField[],
  cuesAlreadyInText: CueType[],
  typedText: string
): { valid: boolean; reason: string } {
  if (!plan || !Array.isArray(plan.questions)) {
    return { valid: false, reason: "no questions array" };
  }
  if (plan.questions.length === 0) {
    return { valid: false, reason: "empty questions" };
  }
  if (plan.questions.length > config.MAX_QUESTIONS) {
    return { valid: false, reason: `too many questions: ${plan.questions.length}` };
  }

  const allowedFieldMap = new Map(allowedFields.map((af) => [af.field, af]));
  const cuesSeen = new Set<string>();

  for (const q of plan.questions) {
    if (!q.field || !q.cueType || !q.text) {
      return { valid: false, reason: "missing field/cueType/text" };
    }

    // field must be in allowed_fields
    if (!allowedFieldMap.has(q.field)) {
      return { valid: false, reason: `field not in allowed_fields: ${q.field}` };
    }

    // cueType must match the allowed field's cue type
    const af = allowedFields.find((x) => x.field === q.field);
    if (af && af.cueType !== (q.cueType as CueType)) {
      return { valid: false, reason: `cueType mismatch for field ${q.field}: got ${q.cueType}, expected ${af.cueType}` };
    }

    // cueTypes must be distinct
    if (cuesSeen.has(q.cueType)) {
      return { valid: false, reason: `duplicate cueType: ${q.cueType}` };
    }
    cuesSeen.add(q.cueType);

    // cueType must not already be in text
    if (cuesAlreadyInText.includes(q.cueType as CueType)) {
      return { valid: false, reason: `cue already in text: ${q.cueType}` };
    }

    // text validation: 3-18 words, ends with '?'
    const wordCount = q.text.trim().split(/\s+/).length;
    if (wordCount < 3 || wordCount > 18) {
      return { valid: false, reason: `question text word count out of range (${wordCount}): "${q.text}"` };
    }
    if (!q.text.trim().endsWith("?")) {
      return { valid: false, reason: `question text doesn't end with '?': "${q.text}"` };
    }
  }

  return { valid: true, reason: "" };
}

// ─── Build Question[] from validated Gemini plan ────────────────────────────

function geminiPlanToQuestions(
  plan: GeminiQuestionPlan,
  candidates: PhotoItem[]
): Question[] {
  const questions: Question[] = [];

  for (const gq of plan.questions) {
    const cueType = gq.cueType as CueType;
    const options = buildOptionsFromField(candidates, gq.field, cueType);
    if (options.length < 2) continue; // skip if data doesn't support this field

    questions.push({
      id: `q_gemini_${gq.field}`,
      cueType,
      field: gq.field,
      text: gq.text,
      layer: "dynamic_adaptive",
      options,
      allowText: true,
      allowDontRemember: true,
    });
  }

  return questions;
}

// ─── Main planner function ────────────────────────────────────────────────────

/**
 * Calls Gemini to order and word coach questions for a given query and candidate set.
 * Falls back to the deterministic plan (already computed by coachEngine) on any failure.
 *
 * @param typedText          The user's typed search text
 * @param candidates         Current candidate photo set
 * @param deterministicQs    Questions produced by the deterministic engine (used as fallback)
 * @param priorAnswers       Already-answered cue types (to skip)
 */
export async function planQuestions(
  typedText: string,
  candidates: PhotoItem[],
  deterministicQs: Question[],
  priorAnswers: Answer[] = []
): Promise<PlannerResult> {
  const startMs = Date.now();
  const deterministicFields = deterministicQs.map((q) => q.field);

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";

  // Disabled
  if (!apiKey || process.env.PLANNER_ENABLED === "false") {
    return {
      questions: deterministicQs,
      planner_source: "deterministic",
      planner_latency_ms: 0,
      planner_fallback_reason: "disabled",
      planner_same_fields_as_deterministic: true,
    };
  }

  // Rate-limit cap
  if (totalPlannerCalls >= config.PLANNER_MAX_CALLS_PER_SESSION) {
    return {
      questions: deterministicQs,
      planner_source: "deterministic",
      planner_latency_ms: Date.now() - startMs,
      planner_fallback_reason: "cap",
      planner_same_fields_as_deterministic: true,
    };
  }

  // Cache hit
  const cacheKey = hashKey(typedText, candidates.map((c) => c.id));
  if (plannerCache.has(cacheKey)) {
    const cached = plannerCache.get(cacheKey)!;
    const sameFields = deterministicFields.every((f) => cached.some((q) => q.field === f));
    return {
      questions: cached,
      planner_source: "gemini",
      planner_latency_ms: 0,
      planner_fallback_reason: "",
      planner_same_fields_as_deterministic: sameFields && cached.length === deterministicQs.length,
    };
  }

  // Build context for Gemini
  const allowedFields = buildAllowedFields(candidates);
  if (allowedFields.length === 0) {
    return {
      questions: deterministicQs,
      planner_source: "deterministic",
      planner_latency_ms: Date.now() - startMs,
      planner_fallback_reason: "error",
      planner_same_fields_as_deterministic: true,
    };
  }

  const cueClassification = classifyCues(typedText);
  const answeredCueTypes = priorAnswers.map((a) => a.cueType as CueType);
  const cuesAlreadyInText = [...new Set([...cueClassification.cueTypes, ...answeredCueTypes])];

  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqModel = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
  const geminiModel = process.env.GEMINI_MODEL || "gemini-flash-latest";

  const systemPrompt = `You help someone narrow down a vaguely remembered photo in Google Photos.
User typed: "${typedText}"
You are given a list of allowed photo attributes (fields) that split matching candidate photos.
Select up to 3 fields with distinct cueTypes (prioritizing who, look, what, where, occasion).
For each selected field, write a natural, friendly question (4-14 words, ending in '?') that naturally incorporates the user's query topic (e.g. if query is "pool", ask "Who was at the pool with you?" or "Was this an indoor or outdoor pool?").
Only select fields from the allowed_fields list.
Do not ask about cues that are already in cues_already_in_text: ${JSON.stringify(cuesAlreadyInText)}.

Return valid JSON:
{
  "questions": [
    { "field": "field_name", "cueType": "who", "text": "Who was at the pool with you?" }
  ],
  "unmatched_terms": []
}`;

  totalPlannerCalls++;

  let fallbackReason: "timeout" | "error" | "invalid" | "cap" | "disabled" | "" = "";
  let llmQuestions: Question[] | null = null;
  let providerUsed: "groq" | "gemini" | "deterministic" = "deterministic";

  // 1. Try Groq first for sub-500ms ultra-fast response
  if (groqKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: groqModel,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: JSON.stringify({
                typed_text: typedText,
                allowed_fields: allowedFields,
                cues_already_in_text: cuesAlreadyInText,
              }),
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
          max_tokens: 512,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const responseData = await response.json();
        const rawText = responseData.choices?.[0]?.message?.content || "";
        const plan = JSON.parse(rawText) as GeminiQuestionPlan;
        const validation = validateGeminiPlan(plan, allowedFields, cuesAlreadyInText, typedText);
        if (validation.valid) {
          const qs = geminiPlanToQuestions(plan, candidates);
          if (qs.length > 0) {
            llmQuestions = qs;
            providerUsed = "groq";
          }
        }
      }
    } catch (err) {
      console.warn("[QuestionPlanner] Groq call failed, trying Gemini:", err);
    }
  }

  // 2. Try Gemini if Groq did not yield questions
  if (!llmQuestions && geminiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.PLANNER_TIMEOUT_MS);

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: JSON.stringify({
                    typed_text: typedText,
                    allowed_fields: allowedFields,
                    cues_already_in_text: cuesAlreadyInText,
                  }),
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
            maxOutputTokens: 512,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const responseData = await response.json();
        const rawText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const plan = JSON.parse(rawText) as GeminiQuestionPlan;
        const validation = validateGeminiPlan(plan, allowedFields, cuesAlreadyInText, typedText);
        if (validation.valid) {
          const qs = geminiPlanToQuestions(plan, candidates);
          if (qs.length > 0) {
            llmQuestions = qs;
            providerUsed = "gemini";
          }
        }
      }
    } catch (err) {
      console.warn("[QuestionPlanner] Gemini call failed:", err);
    }
  }

  const latencyMs = Date.now() - startMs;

  if (llmQuestions && llmQuestions.length > 0) {
    plannerCache.set(cacheKey, llmQuestions);

    const sameFields =
      deterministicFields.length === llmQuestions.length &&
      deterministicFields.every((f) => llmQuestions!.some((q) => q.field === f));

    return {
      questions: llmQuestions,
      planner_source: providerUsed as "gemini" | "deterministic",
      planner_latency_ms: latencyMs,
      planner_fallback_reason: "",
      planner_same_fields_as_deterministic: sameFields,
    };
  }

  // Fallback to deterministic
  return {
    questions: deterministicQs,
    planner_source: "deterministic",
    planner_latency_ms: latencyMs,
    planner_fallback_reason: fallbackReason || "error",
    planner_same_fields_as_deterministic: true,
  };
}

/** Reset the per-process call counter (useful for tests). */
export function resetPlannerCallCount(): void {
  totalPlannerCalls = 0;
}

/** Expose allowed fields builder for tests. */
export { buildAllowedFields };
