// src/lib/config.ts — single source of truth for all thresholds and weights

export const config = {
  GENIE_ENABLED: process.env.GENIE_ENABLED !== "false",
  COACH_ENABLED: process.env.GENIE_ENABLED !== "false",
  COACH_DEBOUNCE_MS: 500,
  COACH_MIN_CANDIDATES: 6,
  COACH_STOP_AT: 4,
  COACH_MIN_STRONG: 4,
  COACH_MIN_AMBIGUOUS: 4,
  COACH_TRIGGER_MODE: "simple" as "simple" | "strict",
  COACH_NO_MATCH_MESSAGE: true,
  COACH_USE_READER: false,
  COACH_PROMPT_REVIEW: false,
  VAGUE_MIN_PRECISE_FILTERS: 2,
  MIN_SCORE: 1.5,
  MAX_QUESTIONS: 3,
  MAX_OPTIONS: 5,
  MIN_OPTION_COVERAGE: 0.10, // each option covers >= 10% of candidates
  MIN_FIELD_COVERAGE: 0.6,
  MIN_TAG_COVERAGE: 0.9,
  MATCH_MIN_SHARE: 0.5,
  AMBIGUITY_BAND: 0.8,
  MATCH_BUCKETS: {
    few: 5,
    some: 15,
  },
  SYNONYM_MAX_EXPANSION: 2,
  SYNONYM_WEIGHT: 0.5,
  PLANNER_ENABLED: false,
  PLANNER_MAX_CALLS_PER_SESSION: 10,
  PLANNER_TIMEOUT_MS: 1500,
  GROQ_TIMEOUT_MS: 2000,
  GROQ_TEMPERATURE: 0.2,
  GROQ_MAX_TOKENS: 256,
  READER_TIMEOUT_MS: 1500,

  // Recallability weights (Step 5)
  RECALLABILITY_WEIGHTS: {
    look: 1.0,
    what: 1.0,
    occasion: 1.0,
    who_group: 1.0,
    mood: 0.8,
    where_setting: 0.7,
    when_season_or_time_of_day: 0.7,
    city_venue: 0.3,
    who_name: 0.2,
    year_relative: 0.3,
  },

  // Cue weights (Step 5)
  CUE_WEIGHTS: {
    look: 1.0,
    what: 1.0,
    occasion: 1.0,
    who: 1.0,
    mood: 0.8,
    where: 0.7,
    when: 0.7,
  },

  // Search scoring field weights
  FIELD_WEIGHTS: {
    setting: 3,
    one_line: 2,
    activity: 2,
    occasion_guess: 2,
    objects: 2,
    clothing: 2,
    group_type: 1.5,
    people_ages: 1.5,
    mood: 1,
    weather_or_season: 1,
    text_in_image: 1,
    time_of_day: 1,
  },
} as const;

export type Config = typeof config;
