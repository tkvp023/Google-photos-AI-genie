// src/lib/config.ts — no magic numbers anywhere else

export const config = {
  COACH_DEBOUNCE_MS: 500,
  COACH_MIN_MATCHES: 10,
  COACH_STOP_AT: 8,
  MIN_TAG_COVERAGE: 0.9,
  MIN_SCORE: 2,
  MAX_QUESTIONS: 3,
  MAX_OPTIONS: 4,
  MIN_FIELD_COVERAGE: 0.6,
  TASK_TIME_LIMIT_SEC: 180,
  TARGET_SHOW_SEC: 5,
  GROQ_TEMPERATURE: 0.2,
  GROQ_MAX_TOKENS: 120,
  GROQ_TIMEOUT_MS: 3000,
  MATCH_BUCKETS: {
    few: 5,
    some: 20,
  },
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
  CUE_WEIGHTS: {
    occasion: 1.0,
    who: 1.0,
    look: 1.0,
    what: 0.9,
    where: 0.7,
    when: 0.6,
  },
} as const;

export type Config = typeof config;
