// src/types/index.ts — Canonical Type Definitions

export type CueType = "who" | "when" | "where" | "what" | "occasion" | "look";

export type Mode = "A" | "B" | "C";

export type Layer = "generic_fallback" | "dynamic_adaptive";

export type Composer = "groq" | "fallback";

export type Bucket = "few" | "some" | "many";

export interface ClothingItem {
  colour: string; // from base palette
  item: string;   // e.g. "swimsuit", "jacket", "shorts"
}

export interface PhotoTag {
  // Descriptive
  one_line: string;
  setting: string;
  indoor_outdoor: "indoor" | "outdoor" | "unknown";
  activity: string;

  // Occasion
  occasion_guess: string;
  occasion_basis: string;

  // People
  people_count: number;
  people_ages: Array<"child" | "teen" | "adult" | "older adult">;
  people_bucket: "1" | "2" | "3-5" | "6+";
  group_type: "solo" | "couple" | "family" | "friends" | "mixed" | "unknown";

  // Look
  clothing: ClothingItem[];
  objects: string[];

  // Time/Mood
  time_of_day: "morning" | "afternoon" | "evening" | "night" | "unknown";
  weather_or_season: string;
  mood: string;
  text_in_image: string;
}

export type Tags = Record<string, PhotoTag>;

export interface StudyTarget {
  id: string;                  // e.g. "T01", "T02"
  file: string;                // filename, e.g. "pool_03.jpg"
  theme: string;               // e.g. "pool"
  difficulty: "high-match-count" | "low-match-count" | "medium";
  distinctiveFeature: string;  // e.g. "red swimsuit, group of 5"
  pairsWith?: string;          // partner target ID
}

export type Targets = StudyTarget[];

export interface PhotoItem {
  id: string;     // filename without extension, e.g. "pool_01"
  file: string;   // "pool_01.jpg"
  theme: string;  // "pool"
  src: string;    // "/library/pool_01.jpg"
  tag?: PhotoTag;
}

export interface PhotoResult {
  id: string;              // "pool_01"
  file: string;            // "pool_01.jpg"
  score: number;           // float
  matchedFields: string[]; // e.g. ["setting", "group_type"]
}

export type PhotoMeta = PhotoItem & { tag: PhotoTag };

export interface SearchResponse {
  results: (PhotoItem & { score: number; matchedFields: string[]; explanation?: string })[];
  count: number;
  bucket: "few" | "some" | "many";
  query: string;
}

export interface QuestionOption {
  label: string;      // display text, e.g. "Friends"
  value: string;      // normalised value, e.g. "friends"
  isGuess?: boolean;  // true for occasion options (shows "?" suffix)
}

export interface Question {
  id: string;           // e.g. "q_who"
  cueType: CueType;
  field: string;        // tag field used, e.g. "group_type"
  text: string;         // prompt text
  layer: Layer;
  options: QuestionOption[];
  allowText: boolean;   // default true
  allowDontRemember: boolean; // default true
}

export interface Answer {
  questionId: string;
  cueType: CueType;
  value: string;
  source: "chip" | "typed";
}

export interface Cue {
  type: CueType;
  value: string;
}

export interface Anchor {
  person: boolean;
  time: boolean;
  location: boolean;
}

export interface VagueCheckResult {
  isVague: boolean;
  anchors: Anchor;
  preciseCount: number;
}

export type EventType =
  | "task_start"
  | "target_shown"
  | "target_hidden"
  | "query_typed"
  | "vague_check"
  | "coach_triggered"
  | "coach_shown"
  | "chip_tapped"
  | "chip_skipped"
  | "coach_reset"
  | "prompt_composed"
  | "prompt_edited"
  | "search_submitted"
  | "photo_opened"
  | "found"
  | "wrong_open"
  | "gave_up"
  | "timeout"
  | "task_end"
  | "survey_answered";

export interface LogEvent {
  ts: string;              // ISO 8601 UTC timestamp
  sessionId: string;
  participantId: string;
  mode: Mode;
  type: EventType | string;
  payload: Record<string, unknown>;
}

export interface CreditRow {
  file: string;
  theme: string;
  pexels_id: string | number;
  photographer: string;
  url: string;
}
