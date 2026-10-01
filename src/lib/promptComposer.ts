// src/lib/promptComposer.ts — Query Composer with Groq LLM & Deterministic Fallback
import { config } from "./config";
import { Answer, Composer } from "@/types";

export interface ComposeResult {
  prompt: string;
  composer: Composer;
}

// In-memory cache for prompt composer results (PC-05)
const composerCache = new Map<string, ComposeResult>();

/**
 * Normalises answer values and removes duplicates and skipped items.
 */
export function sanitizeAnswers(answers: Answer[]): string[] {
  const seen = new Set<string>();
  const cleanValues: string[] = [];

  for (const ans of answers) {
    if (!ans.value) continue;
    const val = ans.value.trim();
    const lower = val.toLowerCase();

    // PC-10: Skip "dont_remember" or "don't remember"
    if (lower === "dont_remember" || lower === "don't remember" || lower === "skip") {
      continue;
    }

    // Strip trailing '?' from occasion guesses
    const stripped = val.replace(/\?$/, "");
    const strippedLower = stripped.toLowerCase();

    // PC-08: De-duplicate values
    if (!seen.has(strippedLower)) {
      seen.add(strippedLower);
      cleanValues.push(stripped);
    }
  }

  return cleanValues;
}

/**
 * Builds fallback prompt deterministically from query and answer values.
 */
export function buildFallbackPrompt(typedQuery: string, answerValues: string[]): string {
  const parts: string[] = [];
  const q = (typedQuery || "").trim();
  if (q) parts.push(q);

  const qLower = q.toLowerCase();
  for (const val of answerValues) {
    if (!qLower.includes(val.toLowerCase())) {
      parts.push(val);
    }
  }

  return parts.join(", ");
}

/**
 * Verifies that the composed prompt does not contain hallucinated words (PC-09).
 */
function isValidComposition(composed: string, allowedWords: Set<string>): boolean {
  if (!composed) return false;
  const tokens = composed.toLowerCase().replace(/[^a-z0-9\s]/gi, " ").split(/\s+/).filter(Boolean);
  const commonConnectors = new Set(["with", "in", "at", "and", "on", "the", "a", "an", "photos", "photo", "of"]);

  for (const token of tokens) {
    if (!allowedWords.has(token) && !commonConnectors.has(token)) {
      return false; // Found an invented/hallucinated detail
    }
  }
  return true;
}

/**
 * Composes a refined search query using Groq LLM with strict fallback on timeout or error.
 */
export async function composePrompt(
  typedQuery: string,
  answers: Answer[],
  options: { disableGroq?: boolean; forceTimeout?: boolean } = {}
): Promise<ComposeResult> {
  const q = (typedQuery || "").trim();
  const cleanAnswers = sanitizeAnswers(answers);

  // PC-06: Empty answers array -> prompt = typed text only
  if (cleanAnswers.length === 0) {
    return { prompt: q, composer: "fallback" };
  }

  // Check cache (PC-05)
  const cacheKey = `${q.toLowerCase()}::${[...cleanAnswers].sort().join("|").toLowerCase()}`;
  if (composerCache.has(cacheKey) && !options.disableGroq) {
    return composerCache.get(cacheKey)!;
  }

  const fallback = buildFallbackPrompt(q, cleanAnswers);

  // PC-02: If Groq disabled or no API key, return deterministic fallback
  const groqApiKey = process.env.GROQ_API_KEY;
  if (options.disableGroq || !groqApiKey) {
    const result: ComposeResult = { prompt: fallback, composer: "fallback" };
    composerCache.set(cacheKey, result);
    return result;
  }

  // Allowed vocabulary for PC-09 hallucination guard
  const allowedWords = new Set<string>();
  const vocabSource = `${q} ${cleanAnswers.join(" ")}`.toLowerCase().replace(/[^a-z0-9\s]/gi, " ");
  vocabSource.split(/\s+/).filter(Boolean).forEach((w) => allowedWords.add(w));

  // Build Groq request
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  const timeoutMs = options.forceTimeout ? 50 : config.GROQ_TIMEOUT_MS;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const systemPrompt = `You are a search query composer for a photo gallery.
Combine the user's initial query and their selected attributes into a concise search phrase.
CRITICAL RULES:
1. ONLY use words from the provided query and attributes.
2. DO NOT invent, hallucinate, or add details not in the input.
3. Respond ONLY with valid JSON: {"prompt": "combined search phrase"}`;

    const userPrompt = JSON.stringify({
      initial_query: q,
      selected_attributes: cleanAnswers,
    });

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: config.GROQ_TEMPERATURE,
        max_tokens: config.GROQ_MAX_TOKENS,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Groq HTTP error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty Groq content");

    let parsed: { prompt?: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      // PC-03: Invalid JSON -> fallback
      throw new Error("Invalid JSON from Groq");
    }

    const composedText = (parsed.prompt || "").trim();
    if (!composedText) throw new Error("Empty prompt in JSON");

    // PC-09: Verify no invented details
    if (!isValidComposition(composedText, allowedWords)) {
      throw new Error("Groq added unauthorized invented detail");
    }

    const result: ComposeResult = { prompt: composedText, composer: "groq" };
    composerCache.set(cacheKey, result);
    return result;
  } catch {
    // PC-03, PC-04: Graceful fallback on error or timeout
    clearTimeout(timeoutId);
    const result: ComposeResult = { prompt: fallback, composer: "fallback" };
    composerCache.set(cacheKey, result);
    return result;
  }
}
