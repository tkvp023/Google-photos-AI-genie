import { config } from "./config";
import { dataStore } from "./dataLoader";
import { CueType, PhotoItem, SearchResponse, SearchResultItem } from "@/types";
import { parseTimeQuery, scoreTimeMatch, ParsedTimeFilter } from "./timeParser";
import { unmatchedTerms } from "./unmatchedTerms";

const STOPWORDS = new Set([
  "a", "an", "the", "in", "on", "at", "by", "for", "with", "about",
  "against", "between", "into", "through", "during", "before", "after",
  "above", "below", "to", "from", "up", "down", "out", "of", "and", "or",
  "is", "are", "was", "were", "be", "been", "being", "have", "has",
  "had", "do", "does", "did", "my", "your", "his", "her", "its",
  "our", "their", "this", "that", "these", "those", "photo", "photos",
  "picture", "pictures", "image", "images", "some", "show", "find",
  // Pronouns
  "me", "i", "we", "us", "you", "he", "him", "she", "they", "them", "it",
  "myself", "yourself", "yours", "ours", "theirs", "mine"
]);

export interface ScoredPhoto extends PhotoItem {
  score: number;
  matchedFields: string[];
  matchedCues: CueType[];
  explanation: string;
  tier: 1 | 2 | 3;
  termsMatchedCount: number;
  matches?: Array<{ field: string; token: string; termType?: string; weight: number }>;
}

export interface TermVariant {
  token: string;
  stem: string;
  isSynonym: boolean;
}

/**
 * Normalises a word to its base stem (handles plurals, gerunds, past tense).
 */
export function stemWord(w: string): string {
  let s = (w || "").toLowerCase().trim();
  if (s.length <= 3) return s;

  if (s.endsWith("ing") && s.length > 4) {
    s = s.slice(0, -3);
    // e.g. swimming -> swim, running -> run
    if (s.length > 2 && s[s.length - 1] === s[s.length - 2]) {
      s = s.slice(0, -1);
    }
    return s;
  }
  if (s.endsWith("ies") && s.length > 4) {
    return s.slice(0, -3) + "y";
  }
  if (s.endsWith("es") && s.length > 4) {
    return s.slice(0, -2);
  }
  if (s.endsWith("s") && !s.endsWith("ss") && s.length > 3) {
    return s.slice(0, -1);
  }
  if (s.endsWith("ed") && s.length > 4) {
    s = s.slice(0, -2);
    if (s.length > 2 && s[s.length - 1] === s[s.length - 2]) {
      s = s.slice(0, -1);
    }
    return s;
  }
  return s;
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
 * Generates variants (exact term + limited synonyms) for a single content term.
 */
export function getTermVariants(term: string, synonyms: Record<string, string>): TermVariant[] {
  const baseStem = stemWord(term);
  const variants: TermVariant[] = [
    { token: term, stem: baseStem, isSynonym: false },
  ];

  const synStr = synonyms[term];
  if (synStr) {
    const rawWords = synStr.toLowerCase().split(/\s+/).filter(Boolean);
    const added = new Set<string>([term, baseStem]);
    let count = 0;
    for (const w of rawWords) {
      if (count >= config.SYNONYM_MAX_EXPANSION) break;
      if (STOPWORDS.has(w)) continue;
      const wStem = stemWord(w);
      if (added.has(w) || added.has(wStem)) continue;
      added.add(w);
      added.add(wStem);
      variants.push({ token: w, stem: wStem, isSynonym: true });
      count++;
    }
  }

  return variants;
}

/**
 * Checks whole-word match with stemming against a target text.
 * No substring false positives (e.g. "me" in "women" will NOT match).
 */
export function textMatchesWord(targetText: string, token: string, tokenStem: string): boolean {
  if (!targetText || !token) return false;
  const lower = targetText.toLowerCase();

  // Multi-word token phrase check (e.g. "road trip")
  if (token.includes(" ")) {
    const tokenWords = token.split(/\s+/).filter(Boolean);
    const targetWords = lower.replace(/[^a-z0-9]/g, " ").split(/\s+/).filter(Boolean);
    if (targetWords.length < tokenWords.length) return false;
    for (let i = 0; i <= targetWords.length - tokenWords.length; i++) {
      let matched = true;
      for (let j = 0; j < tokenWords.length; j++) {
        const tw = targetWords[i + j];
        const kw = tokenWords[j];
        if (tw !== kw && stemWord(tw) !== stemWord(kw)) {
          matched = false;
          break;
        }
      }
      if (matched) return true;
    }
    return false;
  }

  // Single word: whole-word matching with stemming
  const words = lower.replace(/[^a-z0-9]/g, " ").split(/\s+/).filter(Boolean);
  for (const w of words) {
    if (w === token) return true;
    const wStem = stemWord(w);
    if (wStem === tokenStem || wStem === token || w === tokenStem) return true;
  }
  return false;
}

/**
 * Infers the cue type of a matched field or token.
 */
function inferCueType(field: string, token: string, cueLexicon: Partial<Record<CueType, string[]>>): CueType {
  if (field === "group_type" || field === "people_ages" || field === "people_count" || field === "people") return "who";
  if (field === "setting" || field === "indoor_outdoor" || field === "place_city" || field === "place_venue") return "where";
  if (field === "activity") return "what";
  if (field === "occasion_guess" || field === "occasion_basis" || field === "event_title") return "occasion";
  if (field === "clothing" || field === "objects") return "look";
  if (
    field === "time_of_day" ||
    field === "weather_or_season" ||
    field === "time" ||
    field === "year" ||
    field === "month_name" ||
    field === "season"
  ) {
    return "when";
  }

  // Check lexicon
  for (const [cue, words] of Object.entries(cueLexicon)) {
    if (words?.includes(token)) return cue as CueType;
  }

  return "what";
}

/**
 * Scores a photo against the content terms and their variants.
 * Tiers:
 *   tier 1 = matches ALL content terms
 *   tier 2 = matches >= MATCH_MIN_SHARE (0.6) of content terms
 *   tier 3 = matches at least 1 term (< 0.6)
 */
export function scorePhotoWithTiers(
  photo: PhotoItem,
  termVariantsList: TermVariant[][],
  cueLexicon: Partial<Record<CueType, string[]>>,
  parsedTime?: ParsedTimeFilter | null
): ScoredPhoto {
  const tag = photo.tag;
  if (!tag) {
    return {
      ...photo,
      score: 0,
      matchedFields: [],
      matchedCues: [],
      explanation: "No tag",
      tier: 3,
      termsMatchedCount: 0,
    };
  }

  const fieldWeights = config.FIELD_WEIGHTS;
  const cueWeights = config.CUE_WEIGHTS;

  const peopleAgesList = Array.isArray(tag.people_ages) ? tag.people_ages : [];
  const clothingList = Array.isArray(tag.clothing) ? tag.clothing : [];
  const objectsList = Array.isArray(tag.objects) ? tag.objects : [];

  const clothingStrings = clothingList.map((c) => `${c?.colour || ""} ${c?.item || ""}`).join(" ");
  const objectsStrings = objectsList.join(" ");

  const fieldsToCheck: Record<string, { weight: number; text: string }> = {
    theme: { weight: 2.5, text: photo.theme || "" },
    setting: { weight: fieldWeights.setting, text: tag.setting || "" },
    indoor_outdoor: { weight: 2.0, text: tag.indoor_outdoor || "" },
    one_line: { weight: fieldWeights.one_line, text: tag.one_line || "" },
    activity: { weight: fieldWeights.activity, text: tag.activity || "" },
    occasion_guess: { weight: fieldWeights.occasion_guess, text: tag.occasion_guess || "" },
    group_type: { weight: fieldWeights.group_type, text: tag.group_type || "" },
    people_ages: { weight: fieldWeights.people_ages, text: peopleAgesList.join(" ") },
    weather_or_season: { weight: fieldWeights.weather_or_season, text: tag.weather_or_season || "" },
    time_of_day: { weight: fieldWeights.time_of_day, text: tag.time_of_day || "" },
    mood: { weight: fieldWeights.mood, text: tag.mood || "" },
    text_in_image: { weight: fieldWeights.text_in_image, text: tag.text_in_image || "" },
    clothing: { weight: fieldWeights.clothing, text: clothingStrings },
    objects: { weight: fieldWeights.objects, text: objectsStrings },
  };

  // Step 3 metadata fields: place.city (3), place.venue (3), people (3), event_title (2), year (2), month_name (1.5), season (1.5)
  if (photo.metadata) {
    if (photo.metadata.place?.city) {
      fieldsToCheck.place_city = { weight: 3.0, text: photo.metadata.place.city };
    }
    if (photo.metadata.place?.venue) {
      fieldsToCheck.place_venue = { weight: 3.0, text: photo.metadata.place.venue };
    }
    if (Array.isArray(photo.metadata.people) && photo.metadata.people.length > 0) {
      fieldsToCheck.people = { weight: 3.0, text: photo.metadata.people.join(" ") };
    }
    if (photo.metadata.event_title) {
      fieldsToCheck.event_title = { weight: 2.0, text: photo.metadata.event_title };
    }
    if (!parsedTime) {
      if (photo.metadata.year) {
        fieldsToCheck.year = { weight: 2.0, text: String(photo.metadata.year) };
      }
      if (photo.metadata.month_name) {
        fieldsToCheck.month_name = { weight: 1.5, text: photo.metadata.month_name };
      }
      if (photo.metadata.season) {
        fieldsToCheck.season = { weight: 1.5, text: photo.metadata.season };
      }
    }
  }

  let totalScore = 0;
  const matchedFieldsSet = new Set<string>();
  const matchedCuesSet = new Set<CueType>();

  let termsMatchedCount = 0;
  let hasAnyDirectMatch = false;
  const matchesList: Array<{ field: string; token: string; termType?: string; weight: number }> = [];

  for (const variants of termVariantsList) {
    let termMatched = false;
    let termDirectMatch = false;

    for (const [field, { weight, text }] of Object.entries(fieldsToCheck)) {
      // Find matching variant on this field, prioritizing direct (non-synonym) variant
      let bestVariant: TermVariant | null = null;
      for (const v of variants) {
        if (textMatchesWord(text, v.token, v.stem)) {
          if (!v.isSynonym) {
            bestVariant = v;
            break;
          } else if (!bestVariant) {
            bestVariant = v;
          }
        }
      }

      if (bestVariant) {
        termMatched = true;
        if (!bestVariant.isSynonym) {
          termDirectMatch = true;
          hasAnyDirectMatch = true;
        }

        matchedFieldsSet.add(field);
        const cue = inferCueType(field, bestVariant.token, cueLexicon);
        matchedCuesSet.add(cue);

        const cueMultiplier = cueWeights[cue] || 1.0;
        const synMultiplier = bestVariant.isSynonym ? config.SYNONYM_WEIGHT : 1.0;
        const matchWeight = Math.round(weight * cueMultiplier * synMultiplier * 10) / 10;
        totalScore += matchWeight;

        matchesList.push({
          field,
          token: bestVariant.token,
          termType: bestVariant.isSynonym ? "synonym" : "direct",
          weight: matchWeight,
        });
      }
    }

    if (termMatched) {
      termsMatchedCount++;
    }
  }

  // Temporal range scoring if parsedTime is present
  if (parsedTime) {
    const matchResult = scoreTimeMatch(
      parsedTime,
      photo.metadata?.year,
      photo.metadata?.month,
      photo.metadata?.season
    );
    const timeMultiplier = matchResult.scoreMultiplier;
    if (timeMultiplier > 0) {
      termsMatchedCount++;
      if (timeMultiplier === 1.0) {
        hasAnyDirectMatch = true;
      }
      matchedFieldsSet.add("time");
      matchedCuesSet.add("when");

      const cueMultiplier = cueWeights["when"] || 1.0;
      const baseWeight = parsedTime.targetSeason && parsedTime.targetYear ? 2.5 : 2.0;
      const timeScore = Math.round(baseWeight * timeMultiplier * cueMultiplier * 10) / 10;
      totalScore += timeScore;

      matchesList.push({
        field: "time",
        token: parsedTime.rawMatchedPhrase,
        termType: timeMultiplier === 1.0 ? "direct" : "soft",
        weight: timeScore,
      });
    }
  }

  // Multi-cue diversity bonus (only applies when query contains multiple distinct terms)
  const totalTerms = termVariantsList.length + (parsedTime ? 1 : 0);
  if (matchedCuesSet.size > 1 && totalTerms > 1) {
    const diversityBonus = (matchedCuesSet.size - 1) * 2.0;
    totalScore += diversityBonus;
  }

  let tier: 1 | 2 | 3 = 3;
  if (totalTerms > 0) {
    if (termsMatchedCount === totalTerms) {
      tier = 1;
    } else if (termsMatchedCount / totalTerms >= config.MATCH_MIN_SHARE) {
      tier = 2;
    } else {
      tier = 3;
    }
  }

  const matchedFields = Array.from(matchedFieldsSet);
  const matchedCues = Array.from(matchedCuesSet);

  let explanation =
    matchedFields.length > 0
      ? `Matched ${matchedFields.slice(0, 3).join(", ")} (${matchedCues.join("+")})`
      : "No matches";

  if (tier === 3) {
    explanation = `[Weak match] ${explanation}`;
  }

  return {
    ...photo,
    score: Math.round(totalScore * 10) / 10,
    matchedFields,
    matchedCues,
    explanation,
    tier,
    termsMatchedCount,
    matches: matchesList,
  };
}

/**
 * Main search function executing the complete lexical search pipeline.
 * Tiered results:
 *   Tier 1 = Photos matching ALL content terms
 *   Tier 2 = Photos matching >= MATCH_MIN_SHARE (0.6) of content terms
 *   Tier 3 = Any single term (weak)
 * Strong matches = Tier 1 (strictly monotonic: more words never increase count_strong).
 */
export function search(rawQuery: string): SearchResponse {
  if (!rawQuery || typeof rawQuery !== "string" || !rawQuery.trim()) {
    return {
      results: [],
      count: 0,
      count_strong: 0,
      count_total: 0,
      ambiguous_count: 0,
      top_score: 0,
      bucket: "few",
      query: rawQuery || "",
      unmatched_terms: [],
    };
  }

  const parsedTime = parseTimeQuery(rawQuery);
  let textWithoutTime = rawQuery;
  if (parsedTime) {
    const escaped = parsedTime.rawMatchedPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    textWithoutTime = rawQuery.replace(new RegExp(`\\b${escaped}\\b`, "i"), " ");
  }

  const rawTerms = normalise(textWithoutTime);
  const contentTerms = Array.from(new Set(rawTerms));
  const totalTerms = contentTerms.length + (parsedTime ? 1 : 0);

  if (totalTerms === 0) {
    return {
      results: [],
      count: 0,
      count_strong: 0,
      count_total: 0,
      ambiguous_count: 0,
      top_score: 0,
      bucket: "few",
      query: rawQuery || "",
      unmatched_terms: [],
    };
  }

  const synonyms = dataStore.getSynonyms();
  const cueLexicon = dataStore.getCueLexicon();
  const photos = dataStore.getPhotos();

  // Build variants per content term
  const termVariantsList: TermVariant[][] = contentTerms.map((t) =>
    getTermVariants(t, synonyms)
  );

  const scored: ScoredPhoto[] = [];

  for (const photo of photos) {
    const sp = scorePhotoWithTiers(photo, termVariantsList, cueLexicon, parsedTime);
    // Photos that match ALL terms (Tier 1) are always included to preserve strict monotonicity.
    // Partial matches (Tier 2/3) must meet MIN_SCORE.
    if (sp.tier === 1 || (sp.termsMatchedCount > 0 && sp.score >= config.MIN_SCORE)) {
      if (sp.tier === 1 && sp.score < config.MIN_SCORE) {
        sp.score = config.MIN_SCORE;
      }
      scored.push(sp);
    }
  }

  // Sort by Tier first (1, then 2, then 3), then Score descending, then file ascending
  scored.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (b.score !== a.score) return b.score - a.score;
    return a.file.localeCompare(b.file);
  });

  const tier1 = scored.filter((p) => p.tier === 1);
  const tier2 = scored.filter((p) => p.tier === 2);
  // Strong matches: Tier 1 (photos matching ALL content terms). Monotonic: adding words never increases count_strong.
  const count_strong = tier1.length;
  const count_total = scored.length;

  const top_score = tier1[0]?.score || tier2[0]?.score || 0;
  const ambiguousMatches = (tier1.length > 0 ? tier1 : tier2).filter(
    (p) => p.score >= config.AMBIGUITY_BAND * top_score
  );
  const ambiguous_count = ambiguousMatches.length;

  let bucket: "few" | "some" | "many" = "few";
  if (count_strong <= config.MATCH_BUCKETS.few) {
    bucket = "few";
  } else if (count_strong <= config.MATCH_BUCKETS.some) {
    bucket = "some";
  } else {
    bucket = "many";
  }

  const results: SearchResultItem[] = scored.map((p) => ({
    id: p.id,
    file: p.file,
    theme: p.theme,
    src: p.src,
    tag: p.tag,
    metadata: p.metadata,
    score: p.score,
    matchedFields: p.matchedFields,
    explanation: p.explanation,
    tier: p.tier,
    matches: p.matches,
  }));

  const unmatched = unmatchedTerms(rawQuery);

  return {
    results,
    count: count_total,
    count_strong,
    count_total,
    ambiguous_count,
    top_score,
    bucket,
    query: rawQuery,
    unmatched_terms: unmatched,
  };
}

// Backward-compatible scorePhoto wrapper for any legacy call
export function scorePhoto(
  photo: PhotoItem,
  tokens: string[],
  synonyms: Record<string, string>,
  cueLexicon: Partial<Record<CueType, string[]>>
): ScoredPhoto {
  const termVariantsList = tokens.map((t) => getTermVariants(t, synonyms));
  return scorePhotoWithTiers(photo, termVariantsList, cueLexicon);
}

// Backward-compatible applySynonyms
export function applySynonyms(tokens: string[], synonyms: Record<string, string>): string[] {
  const result = new Set<string>();
  for (const t of tokens) {
    result.add(t);
    const variants = getTermVariants(t, synonyms);
    for (const v of variants) {
      result.add(v.token);
    }
  }
  return Array.from(result);
}
