import { config } from "./config";
import { Answer, CueType, PhotoItem, Question, QuestionOption } from "@/types";
import placesData from "../../data/places.json";
import { checkLocationAnchor, checkPersonAnchor, checkTimeAnchor } from "./vagueCheck";
import { parseTimeQuery } from "./timeParser";
import { categorizeTokens } from "./unmatchedTerms";
import { search } from "./search";

export interface FieldDistribution {
  field: string;
  cueType: CueType;
  counts: Record<string, number>;
  totalValid: number;
  coverage: number;
}

export interface QuestionCandidate {
  question: Question;
  balanceScore: number;
  distribution: FieldDistribution;
}

/**
 * Applies user-tapped answers as in-memory filter on candidate photos.
 */
export function filterCandidates(photos: PhotoItem[], answers: Answer[]): PhotoItem[] {
  if (!answers || answers.length === 0) return photos;

  return photos.filter((p) => {
    const tag = p.tag;
    if (!tag) return false;

    for (const ans of answers) {
      if (!ans.value || ans.value === "dont_remember") continue;
      const targetVal = ans.value.toLowerCase().trim();

      switch (ans.cueType) {
        case "who":
          const matchesGroup = (tag.group_type || "").toLowerCase() === targetVal;
          const matchesAge = Array.isArray(tag.people_ages) && tag.people_ages.some((a) => (a || "").toLowerCase() === targetVal);
          const matchesPerson = Array.isArray(p.metadata?.people) && p.metadata.people.some((name) => name.toLowerCase() === targetVal || targetVal.includes(name.toLowerCase()));
          if (!matchesGroup && !matchesAge && !matchesPerson) return false;
          break;

        case "where":
          const matchesSetting = (tag.setting || "").toLowerCase().includes(targetVal);
          const matchesInOut = (tag.indoor_outdoor || "").toLowerCase() === targetVal;
          const matchesCity = (p.metadata?.place?.city || "").toLowerCase().includes(targetVal) || targetVal.includes((p.metadata?.place?.city || "").toLowerCase());
          const matchesVenue = (p.metadata?.place?.venue || "").toLowerCase().includes(targetVal);
          if (!matchesSetting && !matchesInOut && !matchesCity && !matchesVenue) return false;
          break;

        case "what":
          if (!(tag.activity || "").toLowerCase().includes(targetVal)) return false;
          break;

        case "occasion":
          const cleanOccasion = targetVal.replace(/\?$/, "");
          if (!(tag.occasion_guess || "").toLowerCase().includes(cleanOccasion)) return false;
          break;

        case "look":
          const matchesClothing = Array.isArray(tag.clothing) && tag.clothing.some(
            (c) => (c?.colour || "").toLowerCase().includes(targetVal) || (c?.item || "").toLowerCase().includes(targetVal)
          );
          const matchesObject = Array.isArray(tag.objects) && tag.objects.some((o) => (o || "").toLowerCase().includes(targetVal));
          if (!matchesClothing && !matchesObject) return false;
          break;

        case "when":
          const matchesTime = (tag.time_of_day || "").toLowerCase() === targetVal;
          const matchesWeather = (tag.weather_or_season || "").toLowerCase().includes(targetVal);
          let matchesYearOrSeason = false;
          if (p.metadata?.year) {
            const yr = p.metadata.year;
            const diff = 2026 - yr;
            if (targetVal === "this year" && diff === 0) matchesYearOrSeason = true;
            else if (targetVal === "last year" && diff === 1) matchesYearOrSeason = true;
            else if ((targetVal === "two years ago" || targetVal === "2 years ago") && diff === 2) matchesYearOrSeason = true;
            else if (targetVal.includes(String(yr))) matchesYearOrSeason = true;
          }
          if (p.metadata?.season && targetVal.toLowerCase().includes(p.metadata.season.toLowerCase())) {
            matchesYearOrSeason = true;
          }
          if (!matchesTime && !matchesWeather && !matchesYearOrSeason) return false;
          break;

        case "mood":
          if (!(tag.mood || "").toLowerCase().includes(targetVal)) return false;
          break;
      }
    }
    return true;
  });
}

/**
 * Computes frequency distribution of a field across current candidates.
 */
export function computeFieldDistribution(
  candidates: PhotoItem[],
  field: string,
  cueType: CueType
): FieldDistribution {
  const counts: Record<string, number> = {};
  let totalValid = 0;

  for (const photo of candidates) {
    const tag = photo.tag;
    if (!tag) continue;

    let values: string[] = [];

    if (field === "group_type") {
      if (tag.group_type && tag.group_type !== "unknown") values = [tag.group_type];
    } else if (field === "cast_people" || field === "people") {
      if (photo.metadata?.people && photo.metadata.people.length > 0) {
        values = [...photo.metadata.people];
      } else if (tag.group_type && tag.group_type !== "unknown") {
        values = [tag.group_type];
      }
    } else if (field === "place_city" || field === "city") {
      if (photo.metadata?.place?.city) {
        values = [photo.metadata.place.city];
      } else if (tag.setting && tag.setting !== "unknown") {
        values = [tag.setting];
      }
    } else if (field === "time_period") {
      if (photo.metadata?.year) {
        const yr = photo.metadata.year;
        const diff = 2026 - yr;
        if (diff === 0) values = ["this year"];
        else if (diff === 1) values = ["last year"];
        else if (diff === 2) values = ["two years ago"];
        else if (diff === 3) values = ["3 years ago"];
        else values = ["earlier"];
      } else if (tag.time_of_day && tag.time_of_day !== "unknown") {
        values = [tag.time_of_day];
      }
    } else if (field === "season_year") {
      if (photo.metadata?.season && photo.metadata?.year) {
        values = [`${photo.metadata.season} ${photo.metadata.year}`];
      }
    } else if (field === "indoor_outdoor") {
      if (tag.indoor_outdoor && tag.indoor_outdoor !== "unknown") values = [tag.indoor_outdoor];
    } else if (field === "setting") {
      if (tag.setting && tag.setting !== "unknown") values = [tag.setting];
    } else if (field === "activity") {
      if (tag.activity && tag.activity !== "unknown" && tag.activity !== "none") {
        values = tag.activity.split(/,\s*/);
      }
    } else if (field === "occasion_guess") {
      if (tag.occasion_guess && tag.occasion_guess !== "none" && tag.occasion_guess !== "unknown") {
        values = [tag.occasion_guess];
      }
    } else if (field === "clothing_color") {
      values = Array.isArray(tag.clothing)
        ? (tag.clothing.map((c) => c?.colour).filter((c) => c && c !== "unknown") as string[])
        : [];
    } else if (field === "time_of_day") {
      if (tag.time_of_day && tag.time_of_day !== "unknown") values = [tag.time_of_day];
    } else if (field === "mood") {
      if (tag.mood && tag.mood !== "unknown" && tag.mood !== "none" && tag.mood !== "neutral") {
        values = [tag.mood];
      }
    }

    if (values.length > 0) {
      totalValid++;
      for (const val of values) {
        const clean = val.toLowerCase().trim();
        counts[clean] = (counts[clean] || 0) + 1;
      }
    }
  }

  const coverage = candidates.length > 0 ? totalValid / candidates.length : 0;
  return { field, cueType, counts, totalValid, coverage };
}

/**
 * Computes normalised entropy balance score for a field distribution.
 * Higher score = more evenly distributed values across candidates.
 * Applies recallability weight from RECALLABILITY_WEIGHTS config.
 * Many-valued metadata fields (names, cities, exact years) are penalised by
 * dividing their raw entropy by the number of distinct values — this prevents
 * long-tail distributions (15 different city names) from dominating short,
 * memorable memory-cue fields (5 colours).
 */
const RECALLABILITY_WEIGHTS: Record<string, number> = {
  // Memory cue fields (high recallability)
  look: 1.0,          // clothing_color
  what: 1.0,          // activity
  occasion: 1.0,      // occasion_guess
  who_group: 1.0,     // group_type
  mood: 0.8,          // mood
  where_setting: 0.7, // indoor_outdoor / setting
  when_time: 0.7,     // time_of_day / season
  // Metadata fields (low recallability — hard to recall without contextual cue)
  city: 0.3,          // place_city
  who_name: 0.2,      // cast_people (specific names)
  year: 0.3,          // time_period / season_year
};

// Classify field → recallability weight from config
function fieldRecallWeight(field: string): number {
  if (field === "clothing_color") return config.RECALLABILITY_WEIGHTS.look;
  if (field === "activity") return config.RECALLABILITY_WEIGHTS.what;
  if (field === "occasion_guess") return config.RECALLABILITY_WEIGHTS.occasion;
  if (field === "group_type") return config.RECALLABILITY_WEIGHTS.who_group;
  if (field === "mood") return config.RECALLABILITY_WEIGHTS.mood;
  if (field === "indoor_outdoor" || field === "setting") return config.RECALLABILITY_WEIGHTS.where_setting;
  if (field === "time_of_day" || field === "season_year") return config.RECALLABILITY_WEIGHTS.when_season_or_time_of_day;
  if (field === "place_city" || field === "city") return config.RECALLABILITY_WEIGHTS.city_venue;
  if (field === "cast_people" || field === "people") return config.RECALLABILITY_WEIGHTS.who_name;
  if (field === "time_period") return config.RECALLABILITY_WEIGHTS.year_relative;
  return 0.5;
}

// Is this field a metadata field (city, cast name, year)?
function isMetadataField(field: string): boolean {
  return field === "place_city" || field === "cast_people" || field === "time_period" || field === "season_year";
}

/**
 * Computes balance score for a field distribution:
 * score(field) = coverage x normalised entropy over the top 4 values x recallability x cue weight.
 * Many-valued fields (names, cities, years) cannot win on entropy alone.
 */
export function computeBalanceScore(distribution: FieldDistribution, _legacyCueWeight?: number): number {
  if (distribution.coverage < config.MIN_FIELD_COVERAGE) return 0;

  // Take top 4 values by count
  const sortedEntries = Object.entries(distribution.counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const k = sortedEntries.length;
  if (k < 2) return 0;

  const totalSum = sortedEntries.reduce((acc, [, count]) => acc + count, 0);
  if (totalSum === 0) return 0;

  let entropy = 0;
  for (const [, count] of sortedEntries) {
    const p = count / totalSum;
    if (p > 0) {
      entropy -= p * Math.log(p);
    }
  }

  const maxEntropy = Math.log(k);
  const normalisedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;

  const recallWeight = fieldRecallWeight(distribution.field);
  const cueWeight = (config.CUE_WEIGHTS as Record<string, number>)[distribution.cueType] ?? 1.0;

  return distribution.coverage * normalisedEntropy * recallWeight * cueWeight;
}

/**
 * Returns generic Layer 1 fallback questions using candidate photos' actual tag values.
 * Never pads with metadata rows. Uses real candidate data for options wherever possible.
 */
export function genericFallbackQuestions(query: string, priorAnswers: Answer[], candidates: PhotoItem[] = []): Question[] {
  const qLower = (query || "").toLowerCase();
  const answeredCues = new Set(priorAnswers.map((a) => a.cueType));
  const questions: Question[] = [];

  if (candidates.length === 0) {
    if (!answeredCues.has("what")) {
      questions.push({
        id: "q_what_generic",
        cueType: "what",
        field: "activity",
        text: "What was everyone doing?",
        layer: "generic_fallback",
        options: [
          { label: "Walking", value: "walking" },
          { label: "Eating", value: "eating" },
          { label: "Playing", value: "playing" },
          { label: "Relaxing", value: "relaxing" },
        ],
        allowText: true,
        allowDontRemember: true,
      });
    }
    if (!answeredCues.has("look") && questions.length < config.MAX_QUESTIONS) {
      questions.push({
        id: "q_look_generic",
        cueType: "look",
        field: "clothing_color",
        text: "What did people wear?",
        layer: "generic_fallback",
        options: [
          { label: "Blue", value: "blue" },
          { label: "Black", value: "black" },
          { label: "White", value: "white" },
          { label: "Red", value: "red" },
        ],
        allowText: true,
        allowDontRemember: true,
      });
    }
    if (!answeredCues.has("mood") && questions.length < 2) {
      questions.push({
        id: "q_mood_generic",
        cueType: "mood",
        field: "mood",
        text: "What was the vibe?",
        layer: "generic_fallback",
        options: [
          { label: "Cheerful", value: "cheerful" },
          { label: "Calm", value: "calm" },
          { label: "Playful", value: "playful" },
          { label: "Energetic", value: "energetic" },
        ],
        allowText: true,
        allowDontRemember: true,
      });
    }
    return questions.slice(0, config.MAX_QUESTIONS);
  }

  // When candidates exist, ONLY include options that actually exist in candidates!
  // 1. group_type
  if (!answeredCues.has("who") && !qLower.includes("friends") && !qLower.includes("family")) {
    const groupCounts: Record<string, number> = {};
    for (const p of candidates) {
      const g = p.tag?.group_type;
      if (g && g !== "unknown") groupCounts[g.toLowerCase()] = (groupCounts[g.toLowerCase()] || 0) + 1;
    }
    const topGroups = Object.entries(groupCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([v]) => v);
    if (topGroups.length >= 2) {
      questions.push({
        id: "q_who_generic",
        cueType: "who",
        field: "group_type",
        text: "Who was with you?",
        layer: "generic_fallback",
        options: topGroups.map((v) => ({ label: v.charAt(0).toUpperCase() + v.slice(1), value: v })),
        allowText: true,
        allowDontRemember: true,
      });
    }
  }

  // 2. activity
  if (!answeredCues.has("what")) {
    const actCounts: Record<string, number> = {};
    for (const p of candidates) {
      const a = p.tag?.activity;
      if (a && a !== "unknown" && a !== "none") {
        const first = a.split(/,\s*/)[0].trim().toLowerCase();
        if (first) actCounts[first] = (actCounts[first] || 0) + 1;
      }
    }
    const topActs = Object.entries(actCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([v]) => v);
    if (topActs.length >= 2) {
      questions.push({
        id: "q_what_generic",
        cueType: "what",
        field: "activity",
        text: "What was everyone doing?",
        layer: "generic_fallback",
        options: topActs.map((v) => ({ label: v.charAt(0).toUpperCase() + v.slice(1), value: v })),
        allowText: true,
        allowDontRemember: true,
      });
    }
  }

  // 3. clothing_color
  if (!answeredCues.has("look") && questions.length < config.MAX_QUESTIONS) {
    const colorCounts: Record<string, number> = {};
    for (const p of candidates) {
      if (Array.isArray(p.tag?.clothing)) {
        for (const c of p.tag.clothing) {
          if (c?.colour && c.colour !== "unknown") {
            colorCounts[c.colour.toLowerCase()] = (colorCounts[c.colour.toLowerCase()] || 0) + 1;
          }
        }
      }
    }
    const topColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([v]) => v);
    if (topColors.length >= 2) {
      questions.push({
        id: "q_look_generic",
        cueType: "look",
        field: "clothing_color",
        text: "What did people wear?",
        layer: "generic_fallback",
        options: topColors.map((v) => ({ label: v.charAt(0).toUpperCase() + v.slice(1), value: v })),
        allowText: true,
        allowDontRemember: true,
      });
    }
  }

  // 4. mood
  if (!answeredCues.has("mood") && questions.length < config.MAX_QUESTIONS) {
    const moodCounts: Record<string, number> = {};
    for (const p of candidates) {
      const m = p.tag?.mood;
      if (m && m !== "unknown" && m !== "none") {
        moodCounts[m.toLowerCase()] = (moodCounts[m.toLowerCase()] || 0) + 1;
      }
    }
    const topMoods = Object.entries(moodCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([v]) => v);
    if (topMoods.length >= 2) {
      questions.push({
        id: "q_mood_generic",
        cueType: "mood",
        field: "mood",
        text: "What was the vibe?",
        layer: "generic_fallback",
        options: topMoods.map((v) => ({ label: v.charAt(0).toUpperCase() + v.slice(1), value: v })),
        allowText: true,
        allowDontRemember: true,
      });
    }
  }

  // 5. occasion_guess
  if (!answeredCues.has("occasion") && questions.length < config.MAX_QUESTIONS) {
    const occCounts: Record<string, number> = {};
    for (const p of candidates) {
      const o = p.tag?.occasion_guess;
      if (o && o !== "unknown" && o !== "none") {
        occCounts[o.toLowerCase()] = (occCounts[o.toLowerCase()] || 0) + 1;
      }
    }
    const topOccs = Object.entries(occCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([v]) => v);
    if (topOccs.length >= 2) {
      questions.push({
        id: "q_occasion_generic",
        cueType: "occasion",
        field: "occasion_guess",
        text: "What was the occasion?",
        layer: "generic_fallback",
        options: topOccs.map((v) => ({ label: `${v.charAt(0).toUpperCase() + v.slice(1)}?`, value: v, isGuess: true })),
        allowText: true,
        allowDontRemember: true,
      });
    }
  }

  return questions.slice(0, config.MAX_QUESTIONS);
}

/**
 * Selects up to 3 highest-recallability questions with distinct cue types.
 *
 * Rule C enforcement:
 *  - At least 2 memory-cue rows (look, what, occasion, who_group, mood)
 *  - At most 1 metadata row (city, cast_name, year)
 *  - NO cast-name row unless the typed query contains a cast name
 *  - Never ask a cue the typed text already answers
 *  - 2–5 distinct values per row; each option must cover >= 10% of candidates;
 *    every option must exist in the candidates' tags/metadata
 */
export function selectQuestions(
  candidates: PhotoItem[],
  query: string,
  priorAnswers: Answer[] = [],
  tagCoverage: number = 1.0,
  ignoreStopThreshold: boolean = false
): Question[] {
  // CE-06: If all MAX_QUESTIONS (3) answered, stop coaching
  if (priorAnswers.length >= config.MAX_QUESTIONS) {
    return [];
  }

  // CE-05: If candidates < 4, return generic fallback (with real candidate options)
  if (candidates.length < 4) {
    return genericFallbackQuestions(query, priorAnswers, candidates);
  }

  // CE-12: If candidates reached COACH_STOP_AT (<= 8) after narrowing, stop coaching (unless ignoreStopThreshold is true for explicit help)
  if (!ignoreStopThreshold && priorAnswers.length > 0 && candidates.length <= config.COACH_STOP_AT) {
    return [];
  }

  // CE-11: If tag coverage < MIN_TAG_COVERAGE (0.9), use generic fallback
  if (tagCoverage < config.MIN_TAG_COVERAGE) {
    return genericFallbackQuestions(query, priorAnswers, candidates);
  }

  const qLower = (query || "").toLowerCase();
  const answeredCues = new Set(priorAnswers.map((a) => a.cueType));

  // Detect if any person name appears in the typed query
  const queryContainsCastName = placesData.people.some((name) => qLower.includes(name.toLowerCase()));

  // Potential fields: memory cues first, then metadata (where/when)
  // Memory cue fields
  const memoryFieldsConfig: Array<{ field: string; cueType: CueType; text: string; queryKeywords: string[] }> = [
    { field: "activity", cueType: "what", text: "What was everyone doing?", queryKeywords: ["swimming", "eating", "dancing", "hiking", "playing"] },
    { field: "occasion_guess", cueType: "occasion", text: "What was the occasion?", queryKeywords: ["birthday", "party", "festival", "graduation", "reunion"] },
    { field: "clothing_color", cueType: "look", text: "What color was worn?", queryKeywords: ["red", "blue", "yellow", "black", "white", "orange", "swimsuit"] },
    { field: "group_type", cueType: "who", text: "Who was with you?", queryKeywords: ["friends", "family", "couple", "solo", "kids", "alone"] },
    { field: "mood", cueType: "mood", text: "What was the vibe?", queryKeywords: ["happy", "cheerful", "playful", "calm", "energetic", "lively", "relaxed", "vibe", "mood"] },
    { field: "time_of_day", cueType: "when", text: "What time of day was it?", queryKeywords: ["morning", "afternoon", "evening", "night"] },
    { field: "indoor_outdoor", cueType: "where", text: "Was this indoors or outdoors?", queryKeywords: ["outdoor", "indoor", "inside", "outside"] },
  ];

  // Metadata fields (low recallability — restricted by Rule C)
  const metaFieldsConfig: Array<{ field: string; cueType: CueType; text: string; queryKeywords: string[] }> = [
    // cast_people: ONLY allowed if typed text contains a cast name
    ...(queryContainsCastName ? [
      { field: "cast_people", cueType: "who" as CueType, text: "Who was with you?", queryKeywords: [...placesData.people.map((p) => p.toLowerCase())] },
    ] : []),
    { field: "place_city", cueType: "where" as CueType, text: "Where was this taken?", queryKeywords: [...placesData.namedPlaces.map((p) => p.toLowerCase())] },
    { field: "time_period", cueType: "when" as CueType, text: "When was this taken?", queryKeywords: ["morning", "afternoon", "evening", "night", "summer", "monsoon", "winter", "year", "ago", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"] },
  ];

  const allFieldsConfig = [...memoryFieldsConfig, ...metaFieldsConfig];

  const candidateQuestions: QuestionCandidate[] = [];
  const n = candidates.length;

  for (const item of allFieldsConfig) {
    // CE-02 & CE-03: Skip if cue already answered or query already contains key anchor
    if (answeredCues.has(item.cueType)) continue;

    let queryHasAnchor = item.queryKeywords.some((kw) => qLower.includes(kw));
    if (item.cueType === "where" && (checkLocationAnchor(query, placesData.namedPlaces) || checkLocationAnchor(query, placesData.venues))) {
      queryHasAnchor = true;
    }
    if (item.cueType === "who" && !queryContainsCastName && item.field === "group_type" &&
        (qLower.includes("friends") || qLower.includes("family") || qLower.includes("alone") || qLower.includes("couple"))) {
      queryHasAnchor = true;
    }
    if (item.cueType === "who" && queryContainsCastName && checkPersonAnchor(query, placesData.people)) {
      queryHasAnchor = true;
    }
    if (item.cueType === "when" && (checkTimeAnchor(query).hasTime || parseTimeQuery(query) !== null)) {
      queryHasAnchor = true;
    }

    if (queryHasAnchor) continue;

    const dist = computeFieldDistribution(candidates, item.field, item.cueType);
    const score = computeBalanceScore(dist, 1.0); // recallability is baked into computeBalanceScore now

    if (score <= 0) continue;

    // Build options — ONLY include values that actually appear in candidate photos
    // and cover >= 10% of the candidate pool (at least candidates.length / 10)
    const minCoverage = Math.max(1, Math.floor(n * 0.10));
    const eligibleOptions = Object.entries(dist.counts)
      .filter(([, count]) => count >= minCoverage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, config.MAX_OPTIONS);

    if (eligibleOptions.length < 2) continue;

    const isOccasion = item.cueType === "occasion";
    const options: QuestionOption[] = eligibleOptions.map(([val]) => {
      let label = val.charAt(0).toUpperCase() + val.slice(1);
      if (val === "this year") label = "This year";
      else if (val === "last year") label = "Last year";
      else if (val === "two years ago") label = "2 years ago";
      else if (val === "3 years ago") label = "3 years ago";
      else if (val === "earlier") label = "Earlier";
      else if (/^(summer|monsoon|winter|post-monsoon)\s+\d{4}$/i.test(val)) {
        label = val.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      } else if (item.cueType === "where" || item.cueType === "who") {
        label = val.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      }
      return {
        label: isOccasion ? `${label}?` : label,
        value: val,
        isGuess: isOccasion,
      };
    });

    if (options.length < 2) continue;

    candidateQuestions.push({
      question: {
        id: `q_${item.field}`,
        cueType: item.cueType,
        field: item.field,
        text: item.text,
        layer: "dynamic_adaptive",
        options,
        allowText: true,
        allowDontRemember: true,
      },
      balanceScore: score,
      distribution: dist,
    });
  }

  // Sort by balance score (highest information-gain + recallability first)
  candidateQuestions.sort((a, b) => b.balanceScore - a.balanceScore);

  // Rule C selection: ensure >= 2 memory cue rows, <= 1 metadata row
  const MEMORY_CUE_FIELDS = new Set(["activity", "occasion_guess", "clothing_color", "group_type", "mood"]);
  const isMemoryField = (field: string) => MEMORY_CUE_FIELDS.has(field);

  const selected: Question[] = [];
  const selectedCues = new Set<CueType>();

  const memoryCandidates = candidateQuestions.filter((cq) => isMemoryField(cq.question.field));
  const metaCandidates = candidateQuestions.filter((cq) => !isMemoryField(cq.question.field));

  // 1. Pick memory cues first
  for (const mc of memoryCandidates) {
    if (selected.length >= 2 && metaCandidates.length > 0) break;
    if (selected.length >= config.MAX_QUESTIONS) break;
    if (selectedCues.has(mc.question.cueType)) continue;
    selected.push(mc.question);
    selectedCues.add(mc.question.cueType);
  }

  // 2. Pad memory cues from fallback if < 2
  if (selected.length < 2) {
    const fallback = genericFallbackQuestions(query, priorAnswers, candidates);
    for (const fq of fallback) {
      if (selected.length >= 2) break;
      if (selectedCues.has(fq.cueType)) continue;
      if (!isMemoryField(fq.field)) continue;
      selected.push(fq);
      selectedCues.add(fq.cueType);
    }
  }

  // 3. Add at most 1 metadata row if space remains
  for (const mc of metaCandidates) {
    if (selected.length >= config.MAX_QUESTIONS) break;
    if (selectedCues.has(mc.question.cueType)) continue;
    selected.push(mc.question);
    selectedCues.add(mc.question.cueType);
    break;
  }

  // 4. If space remains, add remaining memory candidates
  for (const mc of memoryCandidates) {
    if (selected.length >= config.MAX_QUESTIONS) break;
    if (selectedCues.has(mc.question.cueType)) continue;
    selected.push(mc.question);
    selectedCues.add(mc.question.cueType);
  }

  // Final safety: if still 0 questions found but candidates > threshold, use fallback
  if (selected.length === 0 && candidates.length > config.COACH_STOP_AT) {
    return genericFallbackQuestions(query, priorAnswers, candidates);
  }

  return selected;
}

export interface TriggerEvaluation {
  shouldTrigger: boolean;
  blockedReason: string;
  candidateCount: number;
  candidatePhotos: PhotoItem[];
  tokens: string[];
  recognisedTokens: string[];
  unrecognisedTokens: string[];
  noMatchState: "zero" | "partial" | "none";
  countStrong?: number;
  countTotal?: number;
  ambiguousCount?: number;
  topScore?: number;
}

/**
 * Step 4: Simple, reliable Genie trigger evaluation.
 * Evaluates conditions strictly in order:
 * 1 genie_enabled
 * 2 content_word (token of 3+ letters after stopwords and self-words me/my/i/we/our)
 * 3 still_typing (500 ms debounce handled by caller/hook)
 * 4 already_shown (not already shown or dismissed for this query; reopen only if text changes by 2+ words)
 * 5 not_vague (vague = fewer than 2 precise anchors among Person, Time, Location)
 * 6 no_matches (no content token matches any photo -> show NO chips, caption "No photos fit this description.")
 * 7 few_candidates (candidates < 6).
 */
export function evaluateTrigger(params: {
  query: string;
  isVague: boolean;
  genieOff?: boolean;
  hasBeenDismissed?: boolean;
  alreadyShown?: boolean;
  mode?: string;
  countStrong?: number;
  countTotal?: number;
  ambiguousCount?: number;
  topScore?: number;
  triggerMode?: "simple" | "strict";
}): TriggerEvaluation {
  const { query, isVague, genieOff, hasBeenDismissed, alreadyShown, mode } = params;

  // 1. genie_enabled (ONE hidden switch ?genie=off or config.GENIE_ENABLED=false)
  if (mode === "A" || genieOff || !config.GENIE_ENABLED) {
    return {
      shouldTrigger: false,
      blockedReason: "genie_disabled",
      candidateCount: 0,
      candidatePhotos: [],
      tokens: [],
      recognisedTokens: [],
      unrecognisedTokens: [],
      noMatchState: "none",
    };
  }

  // 2. content_word (a token of 3+ letters after stopwords and self-words me/my/i/we/our)
  const cat = categorizeTokens(query);
  if (cat.contentTokens.length === 0) {
    return {
      shouldTrigger: false,
      blockedReason: "query_too_short",
      candidateCount: 0,
      candidatePhotos: [],
      tokens: cat.contentTokens,
      recognisedTokens: [],
      unrecognisedTokens: [],
      noMatchState: "none",
    };
  }

  // 3. still_typing (handled by 500ms debounce before calling evaluateTrigger)

  // 4. already_shown (not already shown or dismissed for this query)
  if (hasBeenDismissed || alreadyShown) {
    return {
      shouldTrigger: false,
      blockedReason: "already_shown",
      candidateCount: 0,
      candidatePhotos: [],
      tokens: cat.contentTokens,
      recognisedTokens: cat.recognisedTokens,
      unrecognisedTokens: cat.unrecognisedTokens,
      noMatchState: "none",
    };
  }

  // 5. not_vague (vague = fewer than 2 precise anchors among Person, Time, Location)
  if (!isVague) {
    return {
      shouldTrigger: false,
      blockedReason: "not_vague",
      candidateCount: 0,
      candidatePhotos: [],
      tokens: cat.contentTokens,
      recognisedTokens: cat.recognisedTokens,
      unrecognisedTokens: cat.unrecognisedTokens,
      noMatchState: "none",
    };
  }

  // 6. no_matches (no content token matches any photo: show NO chips and caption "No photos fit this description.")
  if (cat.recognisedTokens.length === 0) {
    return {
      shouldTrigger: false,
      blockedReason: "no_matches",
      candidateCount: 0,
      candidatePhotos: [],
      tokens: cat.contentTokens,
      recognisedTokens: [],
      unrecognisedTokens: cat.unrecognisedTokens,
      noMatchState: "zero",
    };
  }

  // 7. few_candidates (candidates < 6)
  // Candidates = photos matching ALL recognised content tokens (tier 1), else tier 1 + tier 2.
  const recognisedQuery = cat.recognisedTokens.join(" ");
  const searchRes = search(recognisedQuery);
  const tier1 = searchRes.results.filter((p) => p.tier === 1);
  const tier2 = searchRes.results.filter((p) => p.tier === 2);
  const candidatePhotos = (tier1.length >= config.COACH_MIN_CANDIDATES ? tier1 : tier1.concat(tier2)) as PhotoItem[];
  const candidateCount = candidatePhotos.length;

  if (candidateCount < config.COACH_MIN_CANDIDATES) {
    return {
      shouldTrigger: false,
      blockedReason: "not_enough_candidates",
      candidateCount,
      candidatePhotos,
      tokens: cat.contentTokens,
      recognisedTokens: cat.recognisedTokens,
      unrecognisedTokens: cat.unrecognisedTokens,
      noMatchState: cat.unrecognisedTokens.length > 0 ? "partial" : "none",
      countStrong: searchRes.count_strong,
      countTotal: searchRes.count_total,
      ambiguousCount: searchRes.ambiguous_count,
      topScore: searchRes.top_score,
    };
  }

  return {
    shouldTrigger: true,
    blockedReason: "",
    candidateCount,
    candidatePhotos,
    tokens: cat.contentTokens,
    recognisedTokens: cat.recognisedTokens,
    unrecognisedTokens: cat.unrecognisedTokens,
    noMatchState: cat.unrecognisedTokens.length > 0 ? "partial" : "none",
    countStrong: searchRes.count_strong,
    countTotal: searchRes.count_total,
    ambiguousCount: searchRes.ambiguous_count,
    topScore: searchRes.top_score,
  };
}

/**
 * Backward-compatible helper determining whether the coach should trigger.
 */
export function shouldTrigger(
  mode: string,
  query: string,
  candidateCount: number,
  isVague: boolean,
  hasBeenDismissed: boolean = false,
  ambiguousCount?: number,
  topScore?: number
): boolean {
  return evaluateTrigger({
    mode,
    query,
    isVague,
    hasBeenDismissed,
  }).shouldTrigger;
}
