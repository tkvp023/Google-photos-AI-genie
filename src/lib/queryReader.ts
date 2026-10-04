// src/lib/queryReader.ts — Optional Gemini Query Reader for Mode B
// SERVER-SIDE ONLY. Reads user query semantics and detects if underspecified.

import { config } from "./config";

export interface QueryReaderResult {
  theme: string | null;
  activities: string[];
  people_count: string | null;
  group_type: string | null;
  clothing_colours: string[];
  objects: string[];
  setting: string | null;
  underspecified: boolean;
}

// In-memory cache by normalised query string
const queryReaderCache = new Map<string, QueryReaderResult>();

function normaliseQueryKey(query: string): string {
  return query.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Parses user query into structured semantic components using Gemini.
 * Returns undefined on timeout (READER_TIMEOUT_MS), network error, or invalid payload.
 */
export async function readQuery(query: string): Promise<QueryReaderResult | undefined> {
  const normKey = normaliseQueryKey(query);
  if (!normKey) return undefined;

  // Check cache
  if (queryReaderCache.has(normKey)) {
    return queryReaderCache.get(normKey);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return undefined;

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const timeoutMs = config.READER_TIMEOUT_MS || 1500;

  const prompt = `You are a search query analyzer for a personal photo search engine.
Analyze this user query: "${query}"
Extract semantic cues and determine if the query is underspecified.

Rule for 'underspecified':
- TRUE if and only if NO specific activities, clothing, objects, or specific people/group members are mentioned, AND the query is only a general theme or setting (e.g. "pool", "beach", "dog", "photos from trip").
- FALSE if the query already contains specific narrowing attributes (e.g. "red swimsuit pool", "dinner with sarah", "friends laughing on hike", "kids playing in snow").

Return JSON only matching this schema:
{
  "theme": string or null,
  "activities": string[],
  "people_count": string or null,
  "group_type": string or null,
  "clothing_colours": string[],
  "objects": string[],
  "setting": string or null,
  "underspecified": boolean
}`;

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
      maxOutputTokens: 500,
    }
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      return undefined;
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!rawText) return undefined;

    let cleanJson = rawText;
    if (cleanJson.startsWith("```")) {
      const lines = cleanJson.split("\n");
      if (lines[0].startsWith("```")) lines.shift();
      if (lines.length && lines[lines.length - 1].startsWith("```")) lines.pop();
      cleanJson = lines.join("\n").trim();
    }

    const parsed = JSON.parse(cleanJson);

    const result: QueryReaderResult = {
      theme: typeof parsed.theme === "string" ? parsed.theme : null,
      activities: Array.isArray(parsed.activities) ? parsed.activities.map(String) : [],
      people_count: typeof parsed.people_count === "string" ? parsed.people_count : null,
      group_type: typeof parsed.group_type === "string" ? parsed.group_type : null,
      clothing_colours: Array.isArray(parsed.clothing_colours) ? parsed.clothing_colours.map(String) : [],
      objects: Array.isArray(parsed.objects) ? parsed.objects.map(String) : [],
      setting: typeof parsed.setting === "string" ? parsed.setting : null,
      underspecified: Boolean(parsed.underspecified),
    };

    queryReaderCache.set(normKey, result);
    return result;
  } catch {
    clearTimeout(timer);
    return undefined;
  }
}
