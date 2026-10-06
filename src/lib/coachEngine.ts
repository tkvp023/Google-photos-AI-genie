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
          const matchesGroup = (tag.group_type || "").toLowerCase() === targetVal ||
            ((tag.group_type || "").toLowerCase() === "solo" && (targetVal === "just me" || targetVal === "alone"));
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
      const pCount = (tag.people_count !== undefined && tag.people_count !== null) ? tag.people_count : (photo.metadata?.people?.length ?? 0);
      if (pCount > 0 && tag.group_type && (tag.group_type as string) !== "unknown" && (tag.group_type as string) !== "none") {
        let g = tag.group_type.toLowerCase().trim();
        if (g === "kids" || g === "child") g = "children";
        values = [g];
      }
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
    } else if (field === "indoor_outdoor") {
      if (tag.indoor_outdoor && tag.indoor_outdoor !== "unknown") values = [tag.indoor_outdoor];
    } else if (field === "setting") {
      if (tag.setting && tag.setting !== "unknown") values = [tag.setting];
    } else if (field === "activity") {
      if (tag.activity && tag.activity !== "unknown" && tag.activity !== "none") {
        const rawActs = tag.activity.split(/,\s*/);
        for (let a of rawActs) {
          a = a.toLowerCase().trim();
          // Drop low-information options (standing, sitting, exiting pool, resting, looking, walking, holding)
          if (["standing", "sitting", "exiting pool", "resting", "looking", "walking", "holding", "posing"].includes(a)) {
            continue;
          }
          // Merge overlaps: e.g. "playing in the sand" / "playing in sand" -> "playing"
          if (a === "playing in the sand" || a === "playing in sand") {
            a = "playing";
          }
          values.push(a);
        }
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
  const minCov = distribution.cueType === "mood" ? 0.35 : config.MIN_FIELD_COVERAGE;
  if (distribution.coverage < minCov) return 0;

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
    if (!answeredCues.has("occasion") && questions.length < config.MAX_QUESTIONS) {
      questions.push({
        id: "q_occasion_generic",
        cueType: "occasion",
        field: "occasion_guess",
        text: "What was the occasion?",
        layer: "generic_fallback",
        options: [
          { label: "Birthday?", value: "birthday", isGuess: true },
          { label: "Party?", value: "party", isGuess: true },
          { label: "Trip?", value: "trip", isGuess: true },
          { label: "Festival?", value: "festival", isGuess: true },
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
      if ((p.tag?.people_count && p.tag.people_count > 0) || p.metadata?.people?.length) {
        let g = p.tag?.group_type?.toLowerCase().trim();
        if (g && g !== "unknown" && g !== "none") {
          if (g === "alone" || g === "me") g = "solo";
          else if (g === "kids" || g === "child") g = "children";
          groupCounts[g] = (groupCounts[g] || 0) + 1;
        }
      }
    }
    const topGroups = Object.entries(groupCounts)
      .filter(([val, count]) => count >= 2 && ["solo", "children", "friends", "family"].includes(val))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    if (topGroups.length >= 2) {
      questions.push({
        id: "q_who_generic",
        cueType: "who",
        field: "group_type",
        text: "Who was there?",
        layer: "generic_fallback",
        options: topGroups.map(([v, cnt]) => {
          let label = v.charAt(0).toUpperCase() + v.slice(1);
          if (v === "solo") label = "Just me";
          else if (v === "children") label = "Children";
          return { label, value: v, count: cnt };
        }),
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
        let act = a.split(/,\s*/)[0].trim().toLowerCase();
        if (["standing", "sitting", "exiting pool", "resting", "looking", "walking", "holding", "posing"].includes(act)) {
          continue;
        }
        if (act === "playing in the sand" || act === "playing in sand") act = "playing";
        if (act) actCounts[act] = (actCounts[act] || 0) + 1;
      }
    }
    const topActs = Object.entries(actCounts)
      .filter(([, cnt]) => cnt >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    if (topActs.length >= 2) {
      questions.push({
        id: "q_what_generic",
        cueType: "what",
        field: "activity",
        text: "What were you doing?",
        layer: "generic_fallback",
        options: topActs.map(([v, cnt]) => ({ label: v.charAt(0).toUpperCase() + v.slice(1), value: v, count: cnt })),
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
    const topColors = Object.entries(colorCounts)
      .filter(([, cnt]) => cnt >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    if (topColors.length >= 2) {
      questions.push({
        id: "q_look_generic",
        cueType: "look",
        field: "clothing_color",
        text: "What did it look like?",
        layer: "generic_fallback",
        options: topColors.map(([v, cnt]) => ({ label: v.charAt(0).toUpperCase() + v.slice(1), value: v, count: cnt })),
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
    const topMoods = Object.entries(moodCounts)
      .filter(([, cnt]) => cnt >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    if (topMoods.length >= 2) {
      questions.push({
        id: "q_mood_generic",
        cueType: "mood",
        field: "mood",
        text: "What was the vibe?",
        layer: "generic_fallback",
        options: topMoods.map(([v, cnt]) => ({ label: v.charAt(0).toUpperCase() + v.slice(1), value: v, count: cnt })),
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
    const topOccs = Object.entries(occCounts)
      .filter(([, cnt]) => cnt >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    if (topOccs.length >= 2) {
      questions.push({
        id: "q_occasion_generic",
        cueType: "occasion",
        field: "occasion_guess",
        text: "What was the occasion?",
        layer: "generic_fallback",
        options: topOccs.map(([v, cnt]) => ({ label: `${v.charAt(0).toUpperCase() + v.slice(1)}?`, value: v, isGuess: true, count: cnt })),
        allowText: true,
        allowDontRemember: true,
      });
    }
  }

  // 6. where (place_city or indoor_outdoor from candidates)
  if (!answeredCues.has("where") && questions.length < config.MAX_QUESTIONS) {
    const cityCounts: Record<string, number> = {};
    for (const p of candidates) {
      const city = p.metadata?.place?.city;
      if (city && city !== "unknown") {
        cityCounts[city.toLowerCase()] = (cityCounts[city.toLowerCase()] || 0) + 1;
      }
    }
    const topCities = Object.entries(cityCounts)
      .filter(([, cnt]) => cnt >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    if (topCities.length >= 2) {
      questions.push({
        id: "q_where_city_generic",
        cueType: "where",
        field: "place_city",
        text: "Where was it?",
        layer: "generic_fallback",
        options: topCities.map(([v, cnt]) => ({ label: v.charAt(0).toUpperCase() + v.slice(1), value: v, count: cnt })),
        allowText: true,
        allowDontRemember: true,
      });
    } else {
      const ioCounts: Record<string, number> = {};
      for (const p of candidates) {
        const io = p.tag?.indoor_outdoor;
        if (io && (io === "outdoor" || io === "indoor")) {
          ioCounts[io] = (ioCounts[io] || 0) + 1;
        }
      }
      const topIO = Object.entries(ioCounts)
        .filter(([, cnt]) => cnt >= 2)
        .sort((a, b) => b[1] - a[1]);
      if (topIO.length >= 2) {
        questions.push({
          id: "q_where_io_generic",
          cueType: "where",
          field: "indoor_outdoor",
          text: "Indoors or outdoors?",
          layer: "generic_fallback",
          options: topIO.map(([v, cnt]) => ({ label: v === "outdoor" ? "Outdoors" : "Indoors", value: v, count: cnt })),
          allowText: true,
          allowDontRemember: true,
        });
      }
    }
  }

  // 7. when (time_period or time_of_day from candidates)
  if (!answeredCues.has("when") && questions.length < config.MAX_QUESTIONS) {
    const periodCounts: Record<string, number> = {};
    for (const p of candidates) {
      if (p.metadata?.year) {
        const yr = p.metadata.year;
        const diff = 2026 - yr;
        let period = "earlier";
        if (diff === 0) period = "this year";
        else if (diff === 1) period = "last year";
        else if (diff === 2) period = "two years ago";
        else if (diff === 3) period = "3 years ago";
        periodCounts[period] = (periodCounts[period] || 0) + 1;
      }
    }
    const topPeriods = Object.entries(periodCounts)
      .filter(([, cnt]) => cnt >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    if (topPeriods.length >= 2) {
      questions.push({
        id: "q_when_period_generic",
        cueType: "when",
        field: "time_period",
        text: "When was this taken?",
        layer: "generic_fallback",
        options: topPeriods.map(([v, cnt]) => ({ label: v.charAt(0).toUpperCase() + v.slice(1), value: v, count: cnt })),
        allowText: true,
        allowDontRemember: true,
      });
    } else {
      const todCounts: Record<string, number> = {};
      for (const p of candidates) {
        const tod = p.tag?.time_of_day;
        if (tod && tod !== "unknown") {
          todCounts[tod.toLowerCase()] = (todCounts[tod.toLowerCase()] || 0) + 1;
        }
      }
      const topTOD = Object.entries(todCounts)
        .filter(([, cnt]) => cnt >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);
      if (topTOD.length >= 2) {
        questions.push({
          id: "q_when_tod_generic",
          cueType: "when",
          field: "time_of_day",
          text: "When was this taken?",
          layer: "generic_fallback",
          options: topTOD.map(([v, cnt]) => ({ label: v.charAt(0).toUpperCase() + v.slice(1), value: v, count: cnt })),
          allowText: true,
          allowDontRemember: true,
        });
      }
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
/**
 * Neutral question wording templates.
 */
function getNeutralQuestionText(field: string, baseText: string): string {
  if (field === "group_type" || field === "cast_people") {
    return "Who was there?";
  }
  if (field === "activity") {
    return "What were you doing?";
  }
  if (field === "indoor_outdoor") {
    return "Indoors or outdoors?";
  }
  if (field === "clothing_color") {
    return "What did it look like?";
  }
  if (field === "place_city" || field === "setting") {
    return "Where was it?";
  }
  if (field === "mood") {
    return "What was the vibe?";
  }
  if (field === "occasion_guess") {
    return "What was the occasion?";
  }
  if (field === "time_of_day" || field === "time_period" || field === "season_year") {
    return "When was this taken?";
  }
  return baseText;
}

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

  // CE-12: If candidates reached COACH_STOP_AT (<= 8), stop coaching (unless ignoreStopThreshold is true for explicit help)
  if (!ignoreStopThreshold && candidates.length <= config.COACH_STOP_AT) {
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
    { field: "activity", cueType: "what", text: "What were you doing?", queryKeywords: ["swimming", "eating", "dancing", "hiking", "playing"] },
    { field: "occasion_guess", cueType: "occasion", text: "What was the occasion?", queryKeywords: ["birthday", "party", "festival", "graduation", "reunion"] },
    { field: "clothing_color", cueType: "look", text: "What did it look like?", queryKeywords: ["red", "blue", "yellow", "black", "white", "orange", "swimsuit"] },
    { field: "group_type", cueType: "who", text: "Who was there?", queryKeywords: ["friends", "family", "couple", "solo", "kids", "alone"] },
    { field: "mood", cueType: "mood", text: "What was the vibe?", queryKeywords: ["happy", "cheerful", "playful", "calm", "energetic", "lively", "relaxed", "vibe", "mood"] },
    { field: "time_of_day", cueType: "when", text: "When was this taken?", queryKeywords: ["morning", "afternoon", "evening", "night"] },
    { field: "indoor_outdoor", cueType: "where", text: "Where was it?", queryKeywords: ["outdoor", "indoor", "inside", "outside"] },
  ];

  // Metadata fields (low recallability — restricted by Rule C)
  const metaFieldsConfig: Array<{ field: string; cueType: CueType; text: string; queryKeywords: string[] }> = [
    // cast_people: ONLY allowed if typed text contains a cast name
    ...(queryContainsCastName ? [
      { field: "cast_people", cueType: "who" as CueType, text: "Who was there?", queryKeywords: [...placesData.people.map((p) => p.toLowerCase())] },
    ] : []),
    { field: "place_city", cueType: "where" as CueType, text: "Where was it?", queryKeywords: [...placesData.namedPlaces.map((p) => p.toLowerCase())] },
    { field: "time_period", cueType: "when" as CueType, text: "When was this taken?", queryKeywords: ["morning", "afternoon", "evening", "night", "year", "ago", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"] },
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

    // Skip Who row if no candidate photo has people
    if (item.cueType === "who") {
      const anyCandidateHasPeople = candidates.some(
        (p) => (p.tag?.people_count && p.tag.people_count > 0) ||
               (p.tag?.group_type && p.tag.group_type !== "unknown") ||
               (p.metadata?.people && p.metadata.people.length > 0)
      );
      if (!anyCandidateHasPeople) continue;
    }

    const dist = computeFieldDistribution(candidates, item.field, item.cueType);
    const score = computeBalanceScore(dist, 1.0); // recallability is baked into computeBalanceScore now

    if (score <= 0) continue;

    // Build options — ONLY include values that actually appear in candidate photos
    // and cover >= 2 photos (drop any option behind only 1 photo)
    const minCoverage = Math.max(2, Math.floor(n * 0.10));
    const eligibleOptions = Object.entries(dist.counts)
      .filter(([, count]) => count >= 2 && count >= minCoverage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, config.MAX_OPTIONS);

    // Skip if nearly all valid candidates share one value (>85% identical)
    if (dist.totalValid > 0 && eligibleOptions.length > 0) {
      const topCount = eligibleOptions[0][1];
      if (topCount / dist.totalValid > 0.85) continue;
    }

    // Skip rows with <2 options
    const minOpts = 2;
    if (eligibleOptions.length < minOpts) continue;

    const isOccasion = item.cueType === "occasion";
    const options: QuestionOption[] = eligibleOptions.map(([val]) => {
      let label = val.charAt(0).toUpperCase() + val.slice(1);
      if (val === "just me" || val === "solo" || val === "alone") label = "Just me";
      else if (val === "children" || val === "kids") label = "Children";
      else if (val === "friends") label = "Friends";
      else if (val === "family") label = "Family";
      else if (val === "this year") label = "This year";
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
        count: dist.counts[val] || 0,
      };
    });

    const neutralText = getNeutralQuestionText(item.field, item.text);

    candidateQuestions.push({
      question: {
        id: `q_${item.field}`,
        cueType: item.cueType,
        field: item.field,
        text: neutralText,
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
  const MEMORY_CUE_FIELDS = new Set(["activity", "occasion_guess", "clothing_color", "group_type", "indoor_outdoor", "setting", "mood"]);
  const isMemoryField = (field: string) => MEMORY_CUE_FIELDS.has(field);

  const selected: Question[] = [];
  const selectedCues = new Set<CueType>();

  const memoryCandidates = candidateQuestions.filter((cq) => isMemoryField(cq.question.field));
  const metaCandidates = candidateQuestions.filter((cq) => !isMemoryField(cq.question.field));

  if (qLower.includes("birthday") || qLower.includes("party") || qLower.includes("celebration")) {
    memoryCandidates.sort((a, b) => {
      if (a.question.cueType === "mood") return -1;
      if (b.question.cueType === "mood") return 1;
      return b.balanceScore - a.balanceScore;
    });
  }

  // Prefer observed cues: sort candidateQuestions so memory cue fields come first
  candidateQuestions.sort((a, b) => {
    const aIsMem = isMemoryField(a.question.field);
    const bIsMem = isMemoryField(b.question.field);
    if (aIsMem && !bIsMem) return -1;
    if (!aIsMem && bIsMem) return 1;
    return b.balanceScore - a.balanceScore;
  });

  const isSyntheticField = (field: string) =>
    field === "place_city" || field === "time_period" || field === "season_year" || field === "cast_people";
  let syntheticCount = 0;

  // Select up to MAX_QUESTIONS with distinct cue types and at most ONE synthetic field
  for (const cq of candidateQuestions) {
    if (selected.length >= config.MAX_QUESTIONS) break;
    if (selectedCues.has(cq.question.cueType)) continue;

    if (isSyntheticField(cq.question.field)) {
      if (syntheticCount >= 1) continue; // Allow at most ONE row from synthetic fields (place OR time, not both)
      syntheticCount++;
    }

    selected.push(cq.question);
    selectedCues.add(cq.question.cueType);
  }

  // If fewer than MAX_QUESTIONS, pad from generic fallback
  if (selected.length < config.MAX_QUESTIONS) {
    const fallback = genericFallbackQuestions(query, priorAnswers, candidates);
    for (const fq of fallback) {
      if (selected.length >= config.MAX_QUESTIONS) break;
      if (selectedCues.has(fq.cueType)) continue;
      if (isSyntheticField(fq.field)) {
        if (syntheticCount >= 1) continue;
        syntheticCount++;
      }
      selected.push(fq);
      selectedCues.add(fq.cueType);
    }
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

  const triggerMode = params.triggerMode ?? config.COACH_TRIGGER_MODE;

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

  // If pre-computed countStrong was provided and > 0, we know matches exist
  const hasPrecomputedMatches = params.countStrong !== undefined && params.countStrong > 0;

  // Strict mode clear winner check if pre-computed ambiguousCount is provided
  const ambigCount = params.ambiguousCount;
  if (triggerMode === "strict" && ambigCount !== undefined && ambigCount < config.COACH_MIN_AMBIGUOUS) {
    return {
      shouldTrigger: false,
      blockedReason: "clear_winner",
      candidateCount: ambigCount,
      candidatePhotos: [],
      tokens: cat.contentTokens,
      recognisedTokens: cat.recognisedTokens,
      unrecognisedTokens: cat.unrecognisedTokens,
      noMatchState: "none",
      countStrong: params.countStrong,
      countTotal: params.countTotal,
      ambiguousCount: ambigCount,
      topScore: params.topScore,
    };
  }

  // 6. no_matches (no content token matches any photo: show NO chips and caption "No photos fit this description.")
  if (!hasPrecomputedMatches && cat.recognisedTokens.length === 0) {
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
  const recognisedQuery =
    cat.unrecognisedTokens.length > 0 && cat.recognisedTokens.length > 0
      ? cat.recognisedTokens.join(" ")
      : query;
  const searchRes = search(recognisedQuery);
  const tier1 = searchRes.results.filter((p) => p.tier === 1);
  // ONLY photos that pass the relevance cut-off (verified, strong Tier 1 matches)
  const candidatePhotos = tier1 as PhotoItem[];
  const candidateCount = candidatePhotos.length;
  const finalAmbiguousCount = params.ambiguousCount !== undefined ? params.ambiguousCount : searchRes.ambiguous_count;

  if (triggerMode === "strict" && finalAmbiguousCount !== undefined && finalAmbiguousCount < config.COACH_MIN_AMBIGUOUS) {
    return {
      shouldTrigger: false,
      blockedReason: "clear_winner",
      candidateCount,
      candidatePhotos,
      tokens: cat.contentTokens,
      recognisedTokens: cat.recognisedTokens,
      unrecognisedTokens: cat.unrecognisedTokens,
      noMatchState: "none",
      countStrong: searchRes.count_strong,
      countTotal: searchRes.count_total,
      ambiguousCount: finalAmbiguousCount,
      topScore: searchRes.top_score,
    };
  }

  if (candidateCount < config.COACH_MIN_CANDIDATES) {
    return {
      shouldTrigger: false,
      blockedReason: candidateCount === 0 ? "no_matches" : "not_enough_candidates",
      candidateCount,
      candidatePhotos,
      tokens: cat.contentTokens,
      recognisedTokens: cat.recognisedTokens,
      unrecognisedTokens: cat.unrecognisedTokens,
      noMatchState: candidateCount === 0 ? "zero" : (cat.unrecognisedTokens.length > 0 ? "partial" : "none"),
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
