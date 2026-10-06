// src/lib/queryUnderstanding.ts — Server-Side Query Understanding with Groq LLM & Vocab Validation
import fs from "fs";
import path from "path";
import { CueType } from "@/types";
import { parseTimeQuery } from "./timeParser";
import { unmatchedTerms } from "./unmatchedTerms";

export interface QueryUnderstandingResult {
  must: string[];
  should: string[];
  unmatched_words: string[];
  person: string | null;
  time: string | null;
  location: string | null;
  cue_types: CueType[];
  is_vague: boolean;
  llm_fallback?: boolean;
  latency_ms?: number;
  llm_called?: boolean;
  model?: string;
  error_text?: string;
}

interface VocabData {
  terms: string[];
  places: string[];
  people: string[];
}

let vocabData: VocabData | null = null;
let vocabSet: Set<string> | null = null;
let placesSet: Set<string> | null = null;
let peopleSet: Set<string> | null = null;

function loadVocab(): { terms: Set<string>; places: Set<string>; people: Set<string> } {
  if (!vocabSet) {
    try {
      const vocabPath = path.resolve(process.cwd(), "data/vocab.json");
      if (fs.existsSync(vocabPath)) {
        vocabData = JSON.parse(fs.readFileSync(vocabPath, "utf-8"));
      }
    } catch (err) {
      console.warn("[queryUnderstanding] Failed to load data/vocab.json:", err);
    }

    vocabSet = new Set((vocabData?.terms || []).map((t) => t.toLowerCase()));
    placesSet = new Set((vocabData?.places || []).map((p) => p.toLowerCase()));
    peopleSet = new Set((vocabData?.people || []).map((p) => p.toLowerCase()));
  }
  return { terms: vocabSet, places: placesSet!, people: peopleSet! };
}

const queryUnderstandingCache = new Map<string, QueryUnderstandingResult>();

const STOPWORDS = new Set([
  "a", "an", "the", "in", "on", "at", "by", "for", "with", "about",
  "against", "between", "into", "through", "during", "before", "after",
  "above", "below", "to", "from", "up", "down", "out", "of", "and", "or",
  "is", "are", "was", "were", "be", "been", "being", "have", "has",
  "had", "do", "does", "did", "my", "your", "his", "her", "its",
  "our", "their", "this", "that", "these", "those", "photo", "photos",
  "picture", "pictures", "image", "images", "some", "show", "find",
  "me", "i", "we", "us", "you", "he", "him", "she", "they", "them", "it",
  "inside", "outside", "happily", "sitting", "standing", "looking", "there", "here", "very"
]);

/**
 * Deterministic rule-based fallback when LLM is unavailable or times out.
 */
export function ruleBasedQueryUnderstanding(rawQuery: string): QueryUnderstandingResult {
  const normQuery = rawQuery.toLowerCase().trim();
  const { terms, places, people } = loadVocab();

  const parsedTime = parseTimeQuery(rawQuery);
  const timeStr = parsedTime ? parsedTime.rawMatchedPhrase : null;

  // Extract location
  let locationStr: string | null = null;
  for (const place of places) {
    if (normQuery.includes(place)) {
      locationStr = place;
      break;
    }
  }

  // Extract person
  let personStr: string | null = null;
  for (const person of people) {
    if (new RegExp(`\\b${person}\\b`, "i").test(normQuery)) {
      personStr = person;
      break;
    }
  }

  // Tokenize
  const rawWords = normQuery.replace(/[^a-z0-9\s]/gi, " ").split(/\s+/).filter(Boolean);
  const contentWords = rawWords.filter((w) => !STOPWORDS.has(w));

  const must: string[] = [];
  const should: string[] = [];
  const unmatched_words: string[] = [];
  const cues = new Set<CueType>();

  if (timeStr) cues.add("when");
  if (locationStr) cues.add("where");
  if (personStr) cues.add("who");

  for (const w of contentWords) {
    if (locationStr && locationStr.includes(w)) continue;
    if (personStr && personStr.includes(w)) continue;
    if (timeStr && timeStr.toLowerCase().includes(w)) continue;

    // Check vocab
    let foundInVocab = false;
    for (const v of terms) {
      if (v === w || v.startsWith(w) || w.startsWith(v)) {
        foundInVocab = true;
        break;
      }
    }

    if (w === "dinner") {
      must.push("restaurant", "dining", "eating");
      cues.add("where");
      cues.add("what");
      continue;
    }

    if (foundInVocab) {
      must.push(w);
      if (["pool", "beach", "park", "lake", "forest", "mountain", "snow", "outdoor", "indoor", "restaurant"].includes(w)) {
        cues.add("where");
      } else if (["swimming", "eating", "dining", "dinner", "playing", "party", "birthday", "hike", "hiking", "cooking"].includes(w)) {
        cues.add("what");
      } else if (["friends", "family", "kids", "children", "couple", "solo"].includes(w)) {
        cues.add("who");
      } else if (["red", "dress", "shirt", "sunglasses", "hat", "black", "white", "suit"].includes(w)) {
        cues.add("look");
      } else if (["happy", "cheerful", "fun", "celebration", "peaceful"].includes(w)) {
        cues.add("mood");
      }
    } else {
      unmatched_words.push(w);
    }
  }

  const anchorCount = (timeStr ? 1 : 0) + (locationStr ? 1 : 0) + (personStr ? 1 : 0);
  const isVague = anchorCount < 2;

  return {
    must,
    should,
    unmatched_words,
    person: personStr,
    time: timeStr,
    location: locationStr,
    cue_types: Array.from(cues),
    is_vague: isVague,
    llm_fallback: true,
  };
}

/**
 * Understands user query using Groq LLM (qwen/qwen3.8-27b) with strict vocab validation.
 */
export async function understandQuery(rawQuery: string): Promise<QueryUnderstandingResult> {
  const normQuery = rawQuery.toLowerCase().trim();
  if (!normQuery) {
    return {
      must: [],
      should: [],
      unmatched_words: [],
      person: null,
      time: null,
      location: null,
      cue_types: [],
      is_vague: true,
      llm_fallback: false,
    };
  }

  if (queryUnderstandingCache.has(normQuery)) {
    return queryUnderstandingCache.get(normQuery)!;
  }

  const { terms, places, people } = loadVocab();
  const startTime = Date.now();

  const groqKey = process.env.GROQ_API_KEY;
  const groqModel = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";

  let result: QueryUnderstandingResult | null = null;

  if (groqKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);

      const prompt = `You are a query understanding system for a photo library search engine.
User search query: "${rawQuery}"

Known People: [${Array.from(people).slice(0, 15).join(", ")}]
Known Places: [${Array.from(places).slice(0, 20).join(", ")}]

Output a strictly valid JSON object matching this schema:
{
  "must": ["core subject/action/setting keywords from the query that MUST be present"],
  "should": ["secondary/optional context keywords"],
  "unmatched_words": ["words that do not look like photo content (gibberish, unknown objects)"],
  "person": "matched person name or null",
  "time": "matched temporal expression or date (e.g. '12 March 2021', 'summer', 'last year') or null",
  "location": "matched city or place name or null",
  "cue_types": ["subset of: who, where, what, look, when, mood, occasion"],
  "is_vague": true if the query has fewer than 2 specific anchors among (person, time, location), else false
}

Rules:
1. For nonsense or unknown terms (e.g. "xyzq", "qwerty"), put them in unmatched_words and leave must/should empty.
2. For "dinner", ALWAYS map to "restaurant", "dining", and "eating" in the tag vocabulary.
3. For "friends", map to observed group_type "friends" only.
4. For pure content queries (e.g. "pasta", "dog", "beach", "red dress"), extract core keywords into "must".
5. Return ONLY the JSON object.`;

      let response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: groqModel,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.0,
          max_tokens: 120,
        }),
        signal: controller.signal,
      });

      if (response.status === 429) {
        const errBody = await response.text();
        const match = errBody.match(/try again in ([0-9.]+)s/i);
        const waitMs = match ? Math.ceil(parseFloat(match[1]) * 1000) + 1000 : 5000;
        await new Promise((r) => setTimeout(r, Math.min(waitMs, 20000)));
        response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: groqModel,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.0,
            max_tokens: 120,
          }),
        });
      }

      clearTimeout(timeout);

      if (!response.ok) {
        const errBody = await response.text();
        console.error(`[queryUnderstanding] Groq HTTP ${response.status} ${response.statusText}:`, errBody);
        result = ruleBasedQueryUnderstanding(rawQuery);
        result.llm_called = true;
        result.model = groqModel;
        result.error_text = `HTTP ${response.status}: ${errBody}`;
        result.latency_ms = Date.now() - startTime;
      } else {
        const json = await response.json();
        const content = json.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          const rawMust: string[] = Array.isArray(parsed.must) ? parsed.must : [];
          const rawShould: string[] = Array.isArray(parsed.should) ? parsed.should : [];
          const rawUnmatched: string[] = Array.isArray(parsed.unmatched_words) ? parsed.unmatched_words : [];

          // Validate against vocab.json
          const validatedMust: string[] = [];
          const validatedShould: string[] = [];
          const validatedUnmatched = new Set<string>(rawUnmatched.map((w) => String(w).toLowerCase()));

          for (const item of rawMust) {
            const low = String(item).toLowerCase().trim();
            if (!low || STOPWORDS.has(low)) continue;
            // Check vocab terms
            let matchesVocab = false;
            for (const v of terms) {
              if (v === low || v.includes(low) || low.includes(v)) {
                matchesVocab = true;
                break;
              }
            }
            if (matchesVocab || places.has(low) || people.has(low)) {
              validatedMust.push(low);
            } else {
              validatedUnmatched.add(low);
            }
          }

          for (const item of rawShould) {
            const low = String(item).toLowerCase().trim();
            if (!low || STOPWORDS.has(low)) continue;
            let matchesVocab = false;
            for (const v of terms) {
              if (v === low || v.includes(low) || low.includes(v)) {
                matchesVocab = true;
                break;
              }
            }
            if (matchesVocab || places.has(low) || people.has(low)) {
              validatedShould.push(low);
            } else {
              validatedUnmatched.add(low);
            }
          }

          // Check raw content words from query
          const rawTokens = normQuery.replace(/[^a-z0-9\s]/gi, " ").split(/\s+/).filter(Boolean);
          for (const tok of rawTokens) {
            if (STOPWORDS.has(tok)) continue;
            let inVocab = false;
            for (const v of terms) {
              if (v === tok || v.includes(tok) || tok.includes(v)) {
                inVocab = true;
                break;
              }
            }
            if (!inVocab && !places.has(tok) && !people.has(tok)) {
              // Not in vocab
              validatedUnmatched.add(tok);
            }
          }

          result = {
            must: validatedMust,
            should: validatedShould,
            unmatched_words: Array.from(validatedUnmatched),
            person: parsed.person || null,
            time: parsed.time || null,
            location: parsed.location || null,
            cue_types: Array.isArray(parsed.cue_types) ? parsed.cue_types : [],
            is_vague: Boolean(parsed.is_vague),
            llm_fallback: false,
            latency_ms: Date.now() - startTime,
            llm_called: true,
            model: groqModel,
          };
        }
      }
    } catch (err: any) {
      console.warn("[queryUnderstanding] LLM call failed or timed out:", err);
      result = ruleBasedQueryUnderstanding(rawQuery);
      result.llm_called = true;
      result.model = groqModel;
      result.error_text = err?.message || String(err);
      result.latency_ms = Date.now() - startTime;
    }
  }

  if (!result) {
    result = ruleBasedQueryUnderstanding(rawQuery);
    result.llm_called = false;
    result.latency_ms = Date.now() - startTime;
  }

  queryUnderstandingCache.set(normQuery, result);
  return result;
}
