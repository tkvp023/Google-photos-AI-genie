// src/types/index.ts — Canonical Type Definitions

export type CueType = "who" | "when" | "where" | "what" | "occasion" | "look" | "mood";

export type Mode = "A" | "B" | "C";

export type Layer = "generic_fallback" | "dynamic_adaptive";

export type Composer = "groq" | "fallback" | "template";

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

export interface SyntheticPhotoPlace {
  city: string;
  venue: string;
  country: string;
  lat: number;
  lng: number;
}

export interface SyntheticPhotoMeta {
  synthetic: boolean;
  event_id: string;
  event_title: string;
  taken_at: string;
  year: number;
  month: number;
  month_name: string;
  season: "summer" | "monsoon" | "post-monsoon" | "winter";
  place: SyntheticPhotoPlace;
  people: string[];
  device: string;
}

export interface StoryEvent {
  id: string;
  title: string;
  theme: string;
  date_start: string;
  date_end: string;
  city: string;
  venue: string;
  country: string;
  lat: number;
  lng: number;
  cast: string[];
  cast_relation_mix: "family" | "friends" | "mixed" | "solo";
  notes: string;
}

export interface PhotoItem {
  id: string;     // filename without extension, e.g. "pool_01"
  file: string;   // "pool_01.jpg"
  theme: string;  // "pool"
  src: string;    // "/library/pool_01.jpg"
  tag?: PhotoTag;
  metadata?: SyntheticPhotoMeta;
}

export interface PhotoResult {
  id: string;              // "pool_01"
  file: string;            // "pool_01.jpg"
  score: number;           // float
  matchedFields: string[]; // e.g. ["setting", "group_type"]
}

export type PhotoMeta = PhotoItem & { tag: PhotoTag };

export interface SearchResultItem extends PhotoItem {
  score: number;
  matchedFields: string[];
  explanation?: string;
  tier?: 1 | 2 | 3;
  matches?: Array<{ field: string; token: string; termType?: string; weight: number }>;
}

export interface SearchResponse {
  results: SearchResultItem[];
  count: number;
  count_strong?: number;
  count_total?: number;
  ambiguous_count?: number;
  top_score?: number;
  bucket: "few" | "some" | "many";
  query: string;
  unmatched_terms?: string[];
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

export interface CreditRow {
  file: string;
  theme: string;
  pexels_id: string | number;
  photographer: string;
  url: string;
}



