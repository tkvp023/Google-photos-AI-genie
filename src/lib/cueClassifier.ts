// src/lib/cueClassifier.ts — Unified Multi-Cue Lexicon Classifier
import { CueType } from "@/types";
import cueLexiconJson from "../../data/cue_lexicon.json";
import placesJson from "../../data/places.json";

export interface CueClassification {
  cueTypes: CueType[];
  cueCount: number;
  has2PlusCues: boolean;
}

const BASE_VOCABULARY: Record<CueType, string[]> = {
  who: [
    "friend", "friends", "family", "me", "us", "kids", "child", "children",
    "couple", "group", "alone", "solo", "partner", "sister", "brother",
    "mom", "dad", "parents", "baby", "toddler", "colleagues", "classmates",
    "duo", "trio", "crowd", "team", "adults", "teens", "people", "man", "woman",
    "boy", "girl", "hiker", "swimmer", "graduates", "students"
  ],
  when: [
    "morning", "afternoon", "evening", "night", "midnight", "dawn", "dusk",
    "summer", "winter", "spring", "autumn", "fall", "sunset", "sunrise",
    "yesterday", "last", "ago", "year", "month", "week", "holiday",
    "weekend", "daytime", "nighttime",
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
    "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec"
  ],
  where: [
    "pool", "beach", "restaurant", "park", "mountain", "home", "house",
    "office", "stadium", "café", "cafe", "outdoor", "indoor", "indoors",
    "outdoors", "garden", "forest", "lake", "river", "sea", "ocean",
    "hotel", "school", "campus", "street", "mall", "airport", "train",
    "patio", "trail", "road", "sand", "water", "cliff", "crater", "playground"
  ],
  what: [
    "swimming", "swim", "eating", "eat", "hiking", "hike", "dancing", "dance",
    "running", "run", "playing", "play", "drinking", "drink", "celebrating", "celebrate",
    "cooking", "cook", "laughing", "laugh", "jumping", "jump", "singing", "sing",
    "climbing", "climb", "cycling", "cycle", "walking", "walk", "sitting", "sit",
    "standing", "stand", "hugging", "hug", "dining", "dine", "splashing", "splash",
    "posing", "travel", "adventure"
  ],
  occasion: [
    "birthday", "graduation", "wedding", "festival", "party", "celebration",
    "trip", "holiday", "vacation", "reunion", "anniversary", "ceremony",
    "concert", "game", "match", "picnic", "barbecue", "bbq", "roadtrip", "road trip"
  ],
  look: [
    "red", "blue", "green", "yellow", "orange", "pink", "purple",
    "white", "black", "grey", "gray", "brown", "beige", "bright",
    "dark", "colourful", "colorful", "sunny", "rainy", "snowy",
    "swimsuit", "swimsuits", "dress", "dresses", "jacket", "jackets",
    "hat", "hats", "uniform", "uniforms", "swimwear", "shorts", "shirt",
    "shirts", "t-shirt", "sunglasses", "tie", "necktie", "hoodie", "cap",
    "golden", "neon", "silver"
  ],
  mood: [
    "cheerful", "playful", "energetic", "adventurous", "calm", "neutral",
    "lively", "celebratory", "formal", "relaxed", "peaceful", "happy",
    "cozy", "excited", "serene", "fun", "vibe", "mood", "joyful"
  ]
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Classifies a search text into cognitive cue types:
 * who, when, where, what, occasion, look, mood.
 * ONE shared function used for both Mode A and Mode B.
 */
export function classifyCues(text: string): CueClassification {
  if (!text || typeof text !== "string") {
    return { cueTypes: [], cueCount: 0, has2PlusCues: false };
  }

  const clean = text.trim();
  if (!clean) {
    return { cueTypes: [], cueCount: 0, has2PlusCues: false };
  }

  const registeredPeople: string[] = placesJson.people || [];
  const registeredPlaces: string[] = placesJson.namedPlaces || [];
  const dynamicLexicon: Partial<Record<CueType, string[]>> = cueLexiconJson as any;

  const matchedCueTypes = new Set<CueType>();

  const cueCategories: CueType[] = ["who", "when", "where", "what", "occasion", "look", "mood"];

  for (const cat of cueCategories) {
    const vocab = new Set<string>([
      ...(BASE_VOCABULARY[cat] || []),
      ...(dynamicLexicon[cat] || [])
    ]);

    if (cat === "who") {
      registeredPeople.forEach((p) => vocab.add(p.toLowerCase()));
    } else if (cat === "where") {
      registeredPlaces.forEach((pl) => vocab.add(pl.toLowerCase()));
    } else if (cat === "when") {
      // Check 4-digit year in text
      if (/\b(?:19\d{2}|20\d{2})\b/.test(clean)) {
        matchedCueTypes.add("when");
      }
    }

    for (const term of vocab) {
      if (!term) continue;
      const rx = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
      if (rx.test(clean)) {
        matchedCueTypes.add(cat);
        break; // Found this category, continue to next
      }
    }
  }

  const cueTypes = Array.from(matchedCueTypes);
  const cueCount = cueTypes.length;
  const has2PlusCues = cueCount >= 2;

  return {
    cueTypes,
    cueCount,
    has2PlusCues,
  };
}
