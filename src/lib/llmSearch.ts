// src/lib/llmSearch.ts — LLM-Powered Semantic Search & Re-Ranking
import { SearchResultItem } from "@/types";

interface LLMScoredItem {
  id: string;
  score: number;
  reason: string;
}

const searchCache = new Map<string, SearchResultItem[]>();

/**
 * Re-ranks candidate photos using Groq or Gemini LLM semantic reasoning.
 * Strictly respects location, social context (who), activity, and visual cues.
 */
export async function rankPhotosWithLLM(
  query: string,
  candidates: SearchResultItem[],
  maxCandidatesToRank: number = 30
): Promise<SearchResultItem[]> {
  const normQuery = query.toLowerCase().trim();
  if (!normQuery || candidates.length === 0) return candidates;

  // Check cache
  if (searchCache.has(normQuery)) {
    return searchCache.get(normQuery)!;
  }

  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqModel = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
  const geminiModel = process.env.GEMINI_MODEL || "gemini-flash-latest";

  // If no API keys available, return original candidates
  if (!groqKey && !geminiKey) return candidates;

  const candidatePool = candidates.slice(0, Math.min(20, maxCandidatesToRank));

  // Prepare ultra-compact summaries for LLM to ensure <1s completion
  const photoSummaries = candidatePool.map((p) => {
    const meta = p.metadata;
    const tag = p.tag;
    const clothing = Array.isArray(tag?.clothing)
      ? tag?.clothing.map((c) => `${c.colour || ""} ${c.item || ""}`.trim()).filter(Boolean).join(", ")
      : "";

    return {
      id: p.id,
      theme: p.theme || "",
      city: meta?.place?.city || "",
      venue: meta?.place?.venue || "",
      desc: tag?.one_line || tag?.setting || "",
      who: tag?.group_type || meta?.people?.join(", ") || "",
      activity: tag?.activity || "",
      look: clothing,
    };
  });

  const prompt = `You are the Google Photos AI Semantic Search Ranker.
User query: "${query}"

Candidate photos:
${JSON.stringify(photoSummaries)}

INSTRUCTIONS:
1. Score each photo from 0 to 100 on semantic relevance to the query "${query}".
2. LOCATION RULE: If the query mentions a location (e.g. "Goa", "Candolim", "Bengaluru"), photos from that location get high scores (70-100). Photos from other locations get low scores (<30).
3. PEOPLE & ACTIVITY: Match social setting (friends/solo) and actions (swimming, dining, beach).
4. Provide a 4-8 word reason.

Return ONLY JSON:
{
  "ranked": [
    { "id": "photo_id", "score": 95, "reason": "Goa beach setting with friends" }
  ]
}`;

  let scoredItems: LLMScoredItem[] = [];

  // Try Groq first for sub-second response
  if (groqKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: groqModel,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 512,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed.ranked)) {
            scoredItems = parsed.ranked;
          }
        }
      }
    } catch (err) {
      console.warn("[llmSearch] Groq failed, falling back to Gemini:", err);
    }
  }

  // Fallback to Gemini if Groq did not return results
  if (scoredItems.length === 0 && geminiKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
            maxOutputTokens: 1024,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed.ranked)) {
            scoredItems = parsed.ranked;
          }
        }
      }
    } catch (err) {
      console.warn("[llmSearch] Gemini call failed:", err);
    }
  }

  // If LLM returned scores, re-order and decorate candidates
  if (scoredItems.length > 0) {
    const scoreMap = new Map<string, LLMScoredItem>();
    for (const item of scoredItems) {
      if (item && item.id) scoreMap.set(item.id, item);
    }

    const reRanked: SearchResultItem[] = [];
    const unranked: SearchResultItem[] = [];

    for (const c of candidates) {
      const llmMatch = scoreMap.get(c.id);
      if (llmMatch) {
        // High scores (>= 60) get Tier 1; moderate (35-59) get Tier 2; low (<35) get Tier 3
        const newTier: 1 | 2 | 3 = llmMatch.score >= 60 ? 1 : llmMatch.score >= 35 ? 2 : 3;
        reRanked.push({
          ...c,
          score: Math.round(llmMatch.score * 10) / 10,
          tier: newTier,
          explanation: llmMatch.reason ? `AI Match: ${llmMatch.reason}` : c.explanation,
        });
      } else {
        unranked.push(c);
      }
    }

    // Sort re-ranked items by score descending
    reRanked.sort((a, b) => b.score - a.score);

    // Filter out photos that have near-zero semantic relevance (<20) if we have strong matches
    const strongMatches = reRanked.filter((r) => r.score >= 40);
    const finalResults = strongMatches.length > 0
      ? [...reRanked.filter((r) => r.score >= 25), ...unranked.filter((u) => (u.tier || 3) === 1)]
      : [...reRanked, ...unranked];

    searchCache.set(normQuery, finalResults);
    return finalResults;
  }

  return candidates;
}
