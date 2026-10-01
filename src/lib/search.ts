// src/lib/search.ts — Weighted Multi-Cue Lexical Search Engine
import { config } from "./config";
import { dataStore } from "./dataLoader";
import { CueType, PhotoItem, SearchResponse } from "@/types";

const STOPWORDS = new Set([
  "a", "an", "the", "in", "on", "at", "by", "for", "with", "about",
  "against", "between", "into", "through", "during", "before", "after",
  "above", "below", "to", "from", "up", "down", "of", "and", "or",
  "is", "are", "was", "were", "be", "been", "being", "have", "has",
  "had", "do", "does", "did", "my", "your", "his", "her", "its",
  "our", "their", "this", "that", "these", "those", "photo", "photos",
  "picture", "pictures", "image", "images", "some", "show", "find"
]);

export interface ScoredPhoto extends PhotoItem {
  score: number;
  matchedFields: string[];
  matchedCues: CueType[];
  explanation: string;
}

/**
 * Normalises a search query by removing punctuation and filtering English stopwords.
 */
export function normalise(query: string): string[] {
  if (!query || typeof query !== "string") return [];
  const clean = query.toLowerCase().replace(/[^a-z0-9\s]/gi, " ");
  const rawTokens = clean.split(/\s+/).filter(Boolean);
  return rawTokens.filter((t) => !STOPWORDS.has(t));
}

/**
 * Expands tokens using synonyms dictionary.
 */
export function applySynonyms(tokens: string[], synonyms: Record<string, string>): string[] {
  const result = new Set<string>();
  for (const t of tokens) {
    result.add(t);
    if (synonyms[t]) {
      const synTokens = synonyms[t].toLowerCase().split(/\s+/);
      for (const s of synTokens) {
        if (!STOPWORDS.has(s)) {
          result.add(s);
        }
      }
    }
  }
  return Array.from(result);
}

/**
 * Infers the cue type of a matched field or token.
 */
function inferCueType(field: string, token: string, cueLexicon: Partial<Record<CueType, string[]>>): CueType {
  if (field === "group_type" || field === "people_ages" || field === "people_count") return "who";
  if (field === "setting" || field === "indoor_outdoor") return "where";
  if (field === "activity") return "what";
  if (field === "occasion_guess" || field === "occasion_basis") return "occasion";
  if (field === "clothing" || field === "objects") return "look";
  if (field === "time_of_day" || field === "weather_or_season") return "when";

  // Check lexicon
  for (const [cue, words] of Object.entries(cueLexicon)) {
    if (words?.includes(token)) return cue as CueType;
  }

  return "what";
}

/**
 * Checks whether a token or phrase matches target text (exact token, substring, or plural stem).
 */
function textMatches(targetText: string, token: string): boolean {
  if (!targetText || !token) return false;
  const lower = targetText.toLowerCase();
  if (lower === token) return true;
  if (lower.includes(token)) return true;

  // Simple plural / stem check
  if (token.endsWith("s") && lower.includes(token.slice(0, -1))) return true;
  if (lower.endsWith("s") && lower.slice(0, -1).includes(token)) return true;
  if (token.endsWith("ing") && lower.includes(token.slice(0, -3))) return true;

  return false;
}

/**
 * Scores a photo against expanded query tokens using weighted field scoring and multi-cue bonus.
 */
export function scorePhoto(
  photo: PhotoItem,
  tokens: string[],
  synonyms: Record<string, string>,
  cueLexicon: Partial<Record<CueType, string[]>>
): ScoredPhoto {
  const tag = photo.tag;
  if (!tag) {
    return {
      ...photo,
      score: 0,
      matchedFields: [],
      matchedCues: [],
      explanation: "No tag",
    };
  }

  let totalScore = 0;
  const matchedFieldsSet = new Set<string>();
  const matchedCuesSet = new Set<CueType>();

  const fieldWeights = config.FIELD_WEIGHTS;
  const cueWeights = config.CUE_WEIGHTS;

  // Extract searchable strings per field
  const fieldsToCheck: Record<string, { weight: number; text: string }> = {
    theme: { weight: 2.5, text: photo.theme },
    setting: { weight: fieldWeights.setting, text: tag.setting },
    indoor_outdoor: { weight: 2.0, text: tag.indoor_outdoor },
    one_line: { weight: fieldWeights.one_line, text: tag.one_line },
    activity: { weight: fieldWeights.activity, text: tag.activity },
    occasion_guess: { weight: fieldWeights.occasion_guess, text: tag.occasion_guess },
    group_type: { weight: fieldWeights.group_type, text: tag.group_type },
    people_ages: { weight: fieldWeights.people_ages, text: tag.people_ages.join(" ") },
    weather_or_season: { weight: fieldWeights.weather_or_season, text: tag.weather_or_season },
    time_of_day: { weight: fieldWeights.time_of_day, text: tag.time_of_day },
    mood: { weight: fieldWeights.mood, text: tag.mood },
    text_in_image: { weight: fieldWeights.text_in_image, text: tag.text_in_image },
  };

  // Clothing items text
  const clothingStrings = tag.clothing.map((c) => `${c.colour} ${c.item}`).join(" ");
  fieldsToCheck["clothing"] = { weight: fieldWeights.clothing, text: clothingStrings };

  // Objects list text
  const objectsStrings = tag.objects.join(" ");
  fieldsToCheck["objects"] = { weight: fieldWeights.objects, text: objectsStrings };

  for (const token of tokens) {
    let tokenMatched = false;

    for (const [field, { weight, text }] of Object.entries(fieldsToCheck)) {
      if (textMatches(text, token)) {
        tokenMatched = true;
        matchedFieldsSet.add(field);
        const cue = inferCueType(field, token, cueLexicon);
        matchedCuesSet.add(cue);

        // Score contribution: weight * cueWeight
        const cueMultiplier = cueWeights[cue] || 1.0;
        totalScore += weight * cueMultiplier;
      }
    }

    // Direct check for clothing color / item combinations
    for (const c of tag.clothing) {
      if (textMatches(c.colour, token) || textMatches(c.item, token)) {
        matchedFieldsSet.add("clothing");
        matchedCuesSet.add("look");
      }
    }
  }

  // Multi-cue diversity bonus:
  // If query hits across multiple distinct cues (e.g. who + where + what), reward cross-cue specificity
  if (matchedCuesSet.size > 1) {
    const diversityBonus = (matchedCuesSet.size - 1) * 2.0;
    totalScore += diversityBonus;
  }

  const matchedFields = Array.from(matchedFieldsSet);
  const matchedCues = Array.from(matchedCuesSet);

  const explanation =
    matchedFields.length > 0
      ? `Matched ${matchedFields.slice(0, 3).join(", ")} (${matchedCues.join("+")})`
      : "No matches";

  return {
    ...photo,
    score: Math.round(totalScore * 10) / 10,
    matchedFields,
    matchedCues,
    explanation,
  };
}

/**
 * Main search function executing the complete lexical search pipeline.
 */
export function search(rawQuery: string): SearchResponse {
  const tokens = normalise(rawQuery);

  if (tokens.length === 0) {
    return {
      results: [],
      count: 0,
      bucket: "few",
      query: rawQuery || "",
    };
  }

  const synonyms = dataStore.getSynonyms();
  const cueLexicon = dataStore.getCueLexicon();
  const expandedTokens = applySynonyms(tokens, synonyms);
  const photos = dataStore.getPhotos();

  const scored: ScoredPhoto[] = [];

  for (const photo of photos) {
    const scoredPhoto = scorePhoto(photo, expandedTokens, synonyms, cueLexicon);
    if (scoredPhoto.score >= config.MIN_SCORE) {
      scored.push(scoredPhoto);
    }
  }

  // Sort descending by score, tie-break by file name
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.file.localeCompare(b.file);
  });

  const count = scored.length;
  let bucket: "few" | "some" | "many" = "few";
  if (count <= config.MATCH_BUCKETS.few) {
    bucket = "few";
  } else if (count <= config.MATCH_BUCKETS.some) {
    bucket = "some";
  } else {
    bucket = "many";
  }

  const results = scored.map((p) => ({
    id: p.id,
    file: p.file,
    theme: p.theme,
    src: p.src,
    tag: p.tag,
    score: p.score,
    matchedFields: p.matchedFields,
    explanation: p.explanation,
  }));

  return {
    results,
    count,
    bucket,
    query: rawQuery,
  };
}
