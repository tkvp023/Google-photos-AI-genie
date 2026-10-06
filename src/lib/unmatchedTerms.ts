// src/lib/unmatchedTerms.ts — Deterministic unmatched content-word detector
// Finds tokens (>= 3 chars, non-stopword) that match NO photo in any searchable field
// after synonym and stem expansion.  Uses the same normalise/applySynonyms pipeline
// as search.ts so results are always consistent with actual search output.

import { dataStore } from "./dataLoader";
import { normalise, applySynonyms } from "./search";

// Stopwords that are never surfaced as "unmatched" even if they match nothing.
// Extends the search engine set with domain-specific connectors.
const EXTRA_STOPS = new Set([
  "photo", "photos", "picture", "pictures", "image", "images",
  "me", "my", "i", "us", "our",
  "some", "few", "lot", "lots", "many",
  "find", "show", "get", "look", "looking", "see",
  "thing", "things", "something", "any", "all", "one",
  "from", "old", "new", "nice", "good", "great", "best",
  "little", "big", "small", "large", "other", "another",
  "like", "with", "that", "this", "then", "than", "when",
  "was", "were", "been", "being", "have", "had",
  "just", "still", "already", "again", "really", "very",
  "got", "get", "back", "into", "out",
  "pic", "shot", "snap", "album",
]);

const MIN_TERM_LEN = 3;

/**
 * Returns content tokens from text that match ZERO photos after synonym+stem expansion.
 * Tokens are >= 3 chars, not in stopword set, and not a pure number.
 * Uses the same normalise → applySynonyms → textMatches pipeline as the search engine.
 * Deterministic — never calls Gemini.
 */
export function unmatchedTerms(text: string): string[] {
  if (!text || typeof text !== "string") return [];

  const rawTokens = normalise(text).filter(
    (t) => t.length >= MIN_TERM_LEN && !EXTRA_STOPS.has(t) && !/^\d+$/.test(t)
  );
  if (rawTokens.length === 0) return [];

  const synonyms = dataStore.getSynonyms();
  const photos = dataStore.getPhotos();

  const unmatched: string[] = [];

  for (const token of rawTokens) {
    // Expand this single token with synonyms (same as search engine does for the whole query)
    const expanded = applySynonyms([token], synonyms);

    // Check every photo's searchable fields for any of the expanded tokens
    let anyPhotoMatches = false;
    for (const photo of photos) {
      if (anyPhotoMatches) break;
      const tag = photo.tag;
      if (!tag) continue;

      const fieldsToCheck: string[] = [
        photo.theme || "",
        tag.setting || "",
        tag.indoor_outdoor || "",
        tag.one_line || "",
        tag.activity || "",
        tag.occasion_guess || "",
        tag.group_type || "",
        Array.isArray(tag.people_ages) ? tag.people_ages.join(" ") : "",
        tag.weather_or_season || "",
        tag.time_of_day || "",
        tag.mood || "",
        tag.text_in_image || "",
        Array.isArray(tag.clothing)
          ? tag.clothing.map((c) => `${c?.colour || ""} ${c?.item || ""}`).join(" ")
          : "",
        Array.isArray(tag.objects) ? tag.objects.join(" ") : "",
      ];

      if (photo.metadata) {
        if (photo.metadata.place?.city) fieldsToCheck.push(photo.metadata.place.city);
        if (photo.metadata.place?.venue) fieldsToCheck.push(photo.metadata.place.venue);
        if (Array.isArray(photo.metadata.people)) fieldsToCheck.push(...photo.metadata.people);
        if (photo.metadata.year) fieldsToCheck.push(String(photo.metadata.year));
        if (photo.metadata.month_name) fieldsToCheck.push(photo.metadata.month_name);
        if (photo.metadata.season) fieldsToCheck.push(photo.metadata.season);
      }

      for (const exp of expanded) {
        const expLower = exp.toLowerCase();
        for (const fieldText of fieldsToCheck) {
          const ft = fieldText.toLowerCase();
          if (
            ft === expLower ||
            ft.includes(expLower) ||
            (expLower.endsWith("s") && ft.includes(expLower.slice(0, -1))) ||
            (ft.endsWith("s") && ft.slice(0, -1).includes(expLower)) ||
            (expLower.endsWith("ing") && ft.includes(expLower.slice(0, -3)))
          ) {
            anyPhotoMatches = true;
            break;
          }
        }
        if (anyPhotoMatches) break;
      }
    }

    if (!anyPhotoMatches) {
      unmatched.push(token);
    }
  }

  return unmatched;
}

export interface TokenCategorization {
  contentTokens: string[];
  recognisedTokens: string[];
  unrecognisedTokens: string[];
}

/**
 * Categorizes query tokens into content tokens, recognised (matches >= 1 photo),
 * and unrecognised (matches 0 photos) tokens.
 */
export function categorizeTokens(text: string): TokenCategorization {
  if (!text || typeof text !== "string") {
    return { contentTokens: [], recognisedTokens: [], unrecognisedTokens: [] };
  }

  const rawTokens = normalise(text).filter(
    (t) => t.length >= MIN_TERM_LEN && !EXTRA_STOPS.has(t) && !/^\d+$/.test(t)
  );
  if (rawTokens.length === 0) {
    return { contentTokens: [], recognisedTokens: [], unrecognisedTokens: [] };
  }

  const unmatched = new Set(unmatchedTerms(text));
  const recognised = rawTokens.filter((t) => !unmatched.has(t));
  const unrecognised = rawTokens.filter((t) => unmatched.has(t));

  return {
    contentTokens: rawTokens,
    recognisedTokens: recognised,
    unrecognisedTokens: unrecognised,
  };
}
