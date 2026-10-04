// src/lib/promptComposer.ts — Query Composer with Groq LLM & Deterministic Fallback
import { config } from "./config";
import { Answer, Composer } from "@/types";

export interface ComposeResult {
  prompt: string;
  composer: Composer;
  composerReason: string;
  latencyMs: number;
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

    // Skip "dont_remember", "don't remember", or "skip"
    if (lower === "dont_remember" || lower === "don't remember" || lower === "skip") {
      continue;
    }

    // Strip trailing '?' from occasion guesses
    const stripped = val.replace(/\?$/, "");
    const strippedLower = stripped.toLowerCase();

    if (!seen.has(strippedLower)) {
      seen.add(strippedLower);
      cleanValues.push(stripped);
    }
  }

  return cleanValues;
}

/**
 * Simple English stemmer for comparing words across plural/singular and -ing forms.
 * E.g. "swimsuits" -> "swimsuit", "swimming" -> "swim", "friends" -> "friend".
 */
export function stemWord(w: string): string {
  let s = (w || "").toLowerCase().trim();
  if (!s || s.length <= 2) return s;

  // Plural: -ies -> -y (parties -> party)
  if (s.endsWith("ies") && s.length > 4) {
    return s.slice(0, -3) + "y";
  }

  // -ing forms
  if (s.endsWith("ing") && s.length > 5) {
    let base = s.slice(0, -3);
    // Double consonant: swimming -> swimm -> swim, running -> runn -> run
    if (base.length > 3 && base[base.length - 1] === base[base.length - 2]) {
      base = base.slice(0, -1);
    }
    // Silent e drop: dancing -> danc -> dance
    if (["danc", "hast", "rid", "bik"].includes(base)) {
      base += "e";
    }
    return base;
  }

  // Plural: -sses, -shes, -ches, -xes -> strip -es
  if (
    s.length > 4 &&
    (s.endsWith("sses") || s.endsWith("shes") || s.endsWith("ches") || s.endsWith("xes"))
  ) {
    return s.slice(0, -2);
  }

  // Regular plural: -s (excluding -ss like grass, glass)
  if (s.endsWith("s") && !s.endsWith("ss") && s.length > 3) {
    return s.slice(0, -1);
  }

  return s;
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

const COMMON_CONNECTORS = new Set([
  "with", "in", "at", "and", "on", "the", "a", "an", "photos", "photo", "of",
  "for", "to", "by", "from", "near", "or", "wearing", "during"
]);

/**
 * Verifies that the composed prompt does not contain hallucinated/invented words.
 * Compares words after simple stemming (plural/singular, -ing) so "swimsuits" matches "swimsuit".
 * Still strictly rejects any new detail words not present in the input.
 */
export function isValidComposition(composed: string, allowedWords: Set<string>): boolean {
  if (!composed || !composed.trim()) return false;
  const tokens = composed
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return false;

  const allowedStems = new Set<string>();
  for (const w of allowedWords) {
    const wLower = w.toLowerCase();
    allowedStems.add(wLower);
    allowedStems.add(stemWord(wLower));
  }

  for (const connector of COMMON_CONNECTORS) {
    allowedStems.add(connector);
    allowedStems.add(stemWord(connector));
  }

  for (const token of tokens) {
    const tokenLower = token.toLowerCase();
    const tokenStem = stemWord(tokenLower);

    const isDirectMatch = allowedWords.has(tokenLower) || COMMON_CONNECTORS.has(tokenLower);
    const isStemMatch = allowedStems.has(tokenLower) || allowedStems.has(tokenStem);

    if (!isDirectMatch && !isStemMatch) {
      // Reject any new detail word!
      return false;
    }
  }

  return true;
}

/**
 * Composes a refined search query using Groq LLM with strict fallback on timeout or error.
 * GEMINI_MODEL and GROQ_MODEL must come from env vars only.
 */
export async function composePrompt(
  typedQuery: string,
  answers: Answer[],
  options: { disableGroq?: boolean; forceTimeout?: boolean } = {}
): Promise<ComposeResult> {
  const startTime = Date.now();
  const q = (typedQuery || "").trim();
  const cleanAnswers = sanitizeAnswers(answers);

  // Empty answers array -> prompt = typed text only
  if (cleanAnswers.length === 0) {
    return {
      prompt: q,
      composer: "fallback",
      composerReason: "empty_answers",
      latencyMs: Date.now() - startTime,
    };
  }

  const cacheKey = `${q.toLowerCase()}::${[...cleanAnswers].sort().join("|").toLowerCase()}`;
  if (composerCache.has(cacheKey) && !options.disableGroq) {
    const cached = composerCache.get(cacheKey)!;
    return {
      ...cached,
      latencyMs: Date.now() - startTime,
    };
  }

  const fallback = buildFallbackPrompt(q, cleanAnswers);

  // If Groq disabled via options
  if (options.disableGroq) {
    const result: ComposeResult = {
      prompt: fallback,
      composer: "fallback",
      composerReason: "disabled_by_options",
      latencyMs: Date.now() - startTime,
    };
    composerCache.set(cacheKey, result);
    return result;
  }

  // Model must come from env vars only
  const model = process.env.GROQ_MODEL;
  if (!model) {
    const result: ComposeResult = {
      prompt: fallback,
      composer: "fallback",
      composerReason: "no_model_configured",
      latencyMs: Date.now() - startTime,
    };
    composerCache.set(cacheKey, result);
    return result;
  }

  // API key check
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    const result: ComposeResult = {
      prompt: fallback,
      composer: "fallback",
      composerReason: "no_api_key",
      latencyMs: Date.now() - startTime,
    };
    composerCache.set(cacheKey, result);
    return result;
  }

  // Build allowed vocabulary for hallucination guard
  const allowedWords = new Set<string>();
  const vocabSource = `${q} ${cleanAnswers.join(" ")}`.toLowerCase().replace(/[^a-z0-9\s]/gi, " ");
  vocabSource.split(/\s+/).filter(Boolean).forEach((w) => {
    allowedWords.add(w);
    allowedWords.add(stemWord(w));
  });

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

    if (response.status === 429) {
      const result: ComposeResult = {
        prompt: fallback,
        composer: "fallback",
        composerReason: "429",
        latencyMs: Date.now() - startTime,
      };
      composerCache.set(cacheKey, result);
      return result;
    }

    if (!response.ok) {
      const result: ComposeResult = {
        prompt: fallback,
        composer: "fallback",
        composerReason: `http_${response.status}`,
        latencyMs: Date.now() - startTime,
      };
      composerCache.set(cacheKey, result);
      return result;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      const result: ComposeResult = {
        prompt: fallback,
        composer: "fallback",
        composerReason: "invalid JSON",
        latencyMs: Date.now() - startTime,
      };
      composerCache.set(cacheKey, result);
      return result;
    }

    let parsed: { prompt?: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      const result: ComposeResult = {
        prompt: fallback,
        composer: "fallback",
        composerReason: "invalid JSON",
        latencyMs: Date.now() - startTime,
      };
      composerCache.set(cacheKey, result);
      return result;
    }

    const composedText = (parsed.prompt || "").trim();
    if (!composedText) {
      const result: ComposeResult = {
        prompt: fallback,
        composer: "fallback",
        composerReason: "invalid JSON",
        latencyMs: Date.now() - startTime,
      };
      composerCache.set(cacheKey, result);
      return result;
    }

    // Step 9: Verify no invented details (with stemming comparison)
    if (!isValidComposition(composedText, allowedWords)) {
      const result: ComposeResult = {
        prompt: fallback,
        composer: "fallback",
        composerReason: "guard rejected",
        latencyMs: Date.now() - startTime,
      };
      composerCache.set(cacheKey, result);
      return result;
    }

    const result: ComposeResult = {
      prompt: composedText,
      composer: "groq",
      composerReason: "success",
      latencyMs: Date.now() - startTime,
    };
    composerCache.set(cacheKey, result);
    return result;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const isTimeout =
      (err instanceof Error && err.name === "AbortError") || options.forceTimeout;
    const reason = isTimeout ? "timeout" : "invalid JSON";
    const result: ComposeResult = {
      prompt: fallback,
      composer: "fallback",
      composerReason: reason,
      latencyMs: Date.now() - startTime,
    };
    composerCache.set(cacheKey, result);
    return result;
  }
}
