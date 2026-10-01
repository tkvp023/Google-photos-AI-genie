// src/lib/coachEngine.ts — Information-Gain Coach Question Selector & Filter
import { config } from "./config";
import { Answer, CueType, PhotoItem, Question, QuestionOption } from "@/types";

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
          const matchesGroup = tag.group_type.toLowerCase() === targetVal;
          const matchesAge = tag.people_ages.some((a) => a.toLowerCase() === targetVal);
          if (!matchesGroup && !matchesAge) return false;
          break;

        case "where":
          const matchesSetting = tag.setting.toLowerCase().includes(targetVal);
          const matchesInOut = tag.indoor_outdoor.toLowerCase() === targetVal;
          if (!matchesSetting && !matchesInOut) return false;
          break;

        case "what":
          if (!tag.activity.toLowerCase().includes(targetVal)) return false;
          break;

        case "occasion":
          const cleanOccasion = targetVal.replace(/\?$/, "");
          if (!tag.occasion_guess.toLowerCase().includes(cleanOccasion)) return false;
          break;

        case "look":
          const matchesClothing = tag.clothing.some(
            (c) => c.colour.toLowerCase().includes(targetVal) || c.item.toLowerCase().includes(targetVal)
          );
          const matchesObject = tag.objects.some((o) => o.toLowerCase().includes(targetVal));
          if (!matchesClothing && !matchesObject) return false;
          break;

        case "when":
          const matchesTime = tag.time_of_day.toLowerCase() === targetVal;
          const matchesWeather = tag.weather_or_season.toLowerCase().includes(targetVal);
          if (!matchesTime && !matchesWeather) return false;
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
      values = tag.clothing.map((c) => c.colour).filter((c) => c && c !== "unknown");
    } else if (field === "time_of_day") {
      if (tag.time_of_day && tag.time_of_day !== "unknown") values = [tag.time_of_day];
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
 */
export function computeBalanceScore(distribution: FieldDistribution, cueWeight: number): number {
  if (distribution.coverage < config.MIN_FIELD_COVERAGE) return 0;

  const entries = Object.entries(distribution.counts);
  const k = entries.length;
  if (k < 2) return 0;

  const totalSum = entries.reduce((acc, [, count]) => acc + count, 0);
  if (totalSum === 0) return 0;

  let entropy = 0;
  for (const [, count] of entries) {
    const p = count / totalSum;
    if (p > 0) {
      entropy -= p * Math.log(p);
    }
  }

  const maxEntropy = Math.log(k);
  const normalisedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;

  return distribution.coverage * normalisedEntropy * cueWeight;
}

/**
 * Returns generic Layer 1 fallback questions.
 */
export function genericFallbackQuestions(query: string, priorAnswers: Answer[]): Question[] {
  const qLower = (query || "").toLowerCase();
  const answeredCues = new Set(priorAnswers.map((a) => a.cueType));

  const questions: Question[] = [];

  if (!answeredCues.has("who") && !qLower.includes("friends") && !qLower.includes("family")) {
    questions.push({
      id: "q_who_generic",
      cueType: "who",
      field: "group_type",
      text: "Who was with you?",
      layer: "generic_fallback",
      options: [
        { label: "Friends", value: "friends" },
        { label: "Family", value: "family" },
        { label: "Just me", value: "solo" },
        { label: "Couple", value: "couple" },
      ],
      allowText: true,
      allowDontRemember: true,
    });
  }

  if (!answeredCues.has("where") && !qLower.includes("outdoor") && !qLower.includes("indoor")) {
    questions.push({
      id: "q_where_generic",
      cueType: "where",
      field: "indoor_outdoor",
      text: "Was this indoors or outdoors?",
      layer: "generic_fallback",
      options: [
        { label: "Outdoors", value: "outdoor" },
        { label: "Indoors", value: "indoor" },
      ],
      allowText: true,
      allowDontRemember: true,
    });
  }

  if (!answeredCues.has("occasion") && !qLower.includes("birthday") && !qLower.includes("party")) {
    questions.push({
      id: "q_occasion_generic",
      cueType: "occasion",
      field: "occasion_guess",
      text: "What was the occasion?",
      layer: "generic_fallback",
      options: [
        { label: "Birthday?", value: "birthday", isGuess: true },
        { label: "Vacation?", value: "vacation", isGuess: true },
        { label: "Celebration?", value: "celebration", isGuess: true },
        { label: "Casual?", value: "none", isGuess: true },
      ],
      allowText: true,
      allowDontRemember: true,
    });
  }

  return questions.slice(0, config.MAX_QUESTIONS);
}

/**
 * Selects up to 3 highest information-gain questions with distinct cue types.
 */
export function selectQuestions(
  candidates: PhotoItem[],
  query: string,
  priorAnswers: Answer[] = [],
  tagCoverage: number = 1.0
): Question[] {
  // CE-06: If all MAX_QUESTIONS (3) answered, stop coaching
  if (priorAnswers.length >= config.MAX_QUESTIONS) {
    return [];
  }

  // CE-05: If candidates < 4, return generic fallback
  if (candidates.length < 4) {
    return genericFallbackQuestions(query, priorAnswers);
  }

  // CE-12: If candidates reached COACH_STOP_AT (<= 8), stop coaching
  if (candidates.length <= config.COACH_STOP_AT) {
    return [];
  }

  // CE-11: If tag coverage < MIN_TAG_COVERAGE (0.9), use generic fallback
  if (tagCoverage < config.MIN_TAG_COVERAGE) {
    return genericFallbackQuestions(query, priorAnswers);
  }

  const qLower = (query || "").toLowerCase();
  const answeredCues = new Set(priorAnswers.map((a) => a.cueType));
  const cueWeights = config.CUE_WEIGHTS;

  // Potential fields to consider
  const fieldsConfig: Array<{ field: string; cueType: CueType; text: string; queryKeywords: string[] }> = [
    { field: "group_type", cueType: "who", text: "Who was with you?", queryKeywords: ["friends", "family", "couple", "solo", "kids"] },
    { field: "indoor_outdoor", cueType: "where", text: "Was this indoors or outdoors?", queryKeywords: ["indoor", "indoors", "outdoor", "outdoors", "outside", "inside"] },
    { field: "setting", cueType: "where", text: "Where was this taken?", queryKeywords: ["beach", "pool", "restaurant", "park", "mountain", "patio"] },
    { field: "activity", cueType: "what", text: "What was everyone doing?", queryKeywords: ["swimming", "eating", "dancing", "hiking", "playing"] },
    { field: "occasion_guess", cueType: "occasion", text: "What was the occasion?", queryKeywords: ["birthday", "party", "festival", "graduation", "reunion"] },
    { field: "clothing_color", cueType: "look", text: "What color was worn?", queryKeywords: ["red", "blue", "yellow", "black", "white", "orange", "swimsuit"] },
    { field: "time_of_day", cueType: "when", text: "What time of day was it?", queryKeywords: ["morning", "afternoon", "evening", "night"] },
  ];

  const candidateQuestions: QuestionCandidate[] = [];

  for (const item of fieldsConfig) {
    // CE-02 & CE-03: Skip if cue already answered or query already contains key anchor
    if (answeredCues.has(item.cueType)) continue;
    const queryHasAnchor = item.queryKeywords.some((kw) => qLower.includes(kw));
    if (queryHasAnchor) continue;

    const dist = computeFieldDistribution(candidates, item.field, item.cueType);
    const cueWeight = cueWeights[item.cueType] || 1.0;
    const score = computeBalanceScore(dist, cueWeight);

    // CE-04 & CE-08: If score is 0 (or coverage < 0.6 or 100% single value), skip
    if (score <= 0) continue;

    // Build options (up to MAX_OPTIONS)
    const sortedOptions = Object.entries(dist.counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, config.MAX_OPTIONS);

    const isOccasion = item.cueType === "occasion";
    const options: QuestionOption[] = sortedOptions.map(([val]) => {
      const label = val.charAt(0).toUpperCase() + val.slice(1);
      return {
        label: isOccasion ? `${label}?` : label, // CE-10: Occasion options have "?" suffix
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

  // Sort candidate questions descending by balance score (highest information gain first)
  candidateQuestions.sort((a, b) => b.balanceScore - a.balanceScore);

  // Select top questions ensuring distinct cue types (CE-01)
  const selected: Question[] = [];
  const selectedCues = new Set<CueType>();

  for (const cq of candidateQuestions) {
    if (!selectedCues.has(cq.question.cueType)) {
      selected.push(cq.question);
      selectedCues.add(cq.question.cueType);
      if (selected.length >= config.MAX_QUESTIONS) break;
    }
  }

  // If dynamic selection didn't yield enough, pad with generic fallback if needed
  if (selected.length === 0 && candidates.length > config.COACH_STOP_AT) {
    return genericFallbackQuestions(query, priorAnswers);
  }

  return selected;
}

/**
 * Determines whether the coach panel should trigger for the given query and state.
 */
export function shouldTrigger(
  mode: string,
  query: string,
  candidateCount: number,
  isVague: boolean,
  hasBeenDismissed: boolean = false
): boolean {
  if (mode !== "B") return false;
  if (hasBeenDismissed) return false;
  const q = (query || "").trim();
  if (q.length < 3) return false;
  if (!isVague) return false;
  if (candidateCount < config.COACH_MIN_MATCHES) return false;
  if (candidateCount < 4) return false;

  return true;
}
