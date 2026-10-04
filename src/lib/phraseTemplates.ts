// src/lib/phraseTemplates.ts — Deterministic Phrase Templates for Coach Interaction
import { CueType } from "@/types";
import placesJson from "../../data/places.json";

const KNOWN_NAMED_PLACES = new Set([
  ...(placesJson.namedPlaces || []).map((p: string) => p.toLowerCase()),
  ...(placesJson.venues || []).map((v: string) => v.toLowerCase()),
]);

/**
 * Returns deterministic phrase for a chip based on cueType and value.
 * - who: "with <value>" (e.g. "with friends", "with family"); solo -> "alone"
 * - occasion: occasion word without '?' (e.g. "birthday")
 * - look: "<colour> <item>" (e.g. "red swimsuit") or "outdoors"/"indoors"
 * - what: activity word (e.g. "swimming")
 * - when: time_of_day or season word (e.g. "evening")
 * - where: setting or indoors/outdoors word (e.g. "outdoors", "indoors", "pool"), or "in <City>" for named places
 */
export function getChipPhrase(cueType: CueType, rawValue: string): string {
  if (!rawValue) return "";
  let val = rawValue.trim().toLowerCase().replace(/\?+$/, "");

  if (cueType === "who") {
    if (val === "solo" || val === "alone" || val === "just me") {
      return "alone";
    }
    if (val === "friends" || val === "family") {
      return `with ${val}`;
    }
    if (val.startsWith("with ")) {
      return val;
    }
    const cap = val.charAt(0).toUpperCase() + val.slice(1);
    return `with ${cap}`;
  }

  if (cueType === "where") {
    if (val === "outdoor") return "outdoors";
    if (val === "indoor") return "indoors";
    if (val === "outdoors" || val === "indoors") return val;
    if (val.startsWith("in ")) return val;
    if (KNOWN_NAMED_PLACES.has(val)) {
      const cap = val.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      return `in ${cap}`;
    }
    return val;
  }

  if (cueType === "when") {
    return val;
  }

  if (cueType === "look") {
    if (val === "outdoor") return "outdoors";
    if (val === "indoor") return "indoors";
  }

  if (cueType === "mood") {
    return val;
  }

  return val;
}

/**
 * Checks if a phrase is selected in the text using whole-phrase match (case-insensitive).
 */
export function isPhraseSelected(text: string, phrase: string): boolean {
  if (!text || !phrase) return false;
  const p = phrase.trim().toLowerCase();
  if (!p) return false;

  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match whole-phrase surrounded by boundaries: commas, start/end of string, or word boundaries
  const regex = new RegExp(`(?:^|[^a-zA-Z0-9])${escaped}(?:$|[^a-zA-Z0-9])`, "i");
  return regex.test(text);
}

/**
 * Cleans up extra commas, spaces, and trailing/leading separators.
 */
export function cleanSeparators(text: string): string {
  if (!text) return "";
  let s = text.trim();

  // Split by comma, trim each segment, remove empty segments
  const segments = s
    .split(",")
    .map((seg) => seg.trim().replace(/\s{2,}/g, " "))
    .filter(Boolean);

  return segments.join(", ");
}

/**
 * Appends a phrase to the end of the text separated by ", ".
 * Avoids duplicate phrases.
 */
export function appendChipPhrase(currentText: string, phrase: string): string {
  const p = phrase.trim();
  if (!p) return currentText;
  if (!currentText || !currentText.trim()) return p;

  if (isPhraseSelected(currentText, p)) {
    return currentText;
  }

  const cleaned = cleanSeparators(currentText);
  if (!cleaned) return p;
  return `${cleaned}, ${p}`;
}

/**
 * Removes exactly the given phrase from text and cleans up separators.
 */
export function removeChipPhrase(currentText: string, phrase: string): string {
  if (!currentText || !phrase) return currentText;
  const p = phrase.trim();
  if (!p) return currentText;

  // Split by comma to inspect segments
  const segments = currentText
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Check if any segment equals the phrase (case-insensitive)
  const pLower = p.toLowerCase();
  const filtered = segments.filter((seg) => seg.toLowerCase() !== pLower);

  if (filtered.length !== segments.length) {
    return filtered.join(", ");
  }

  // Fallback: replace within text if not exact segment
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(^|[,\\s]+)${escaped}(?=[,\\s]|$)`, "gi");
  const replaced = currentText.replace(regex, ", ");
  return cleanSeparators(replaced);
}

/**
 * Replaces any existing phrase from the same question with the new phrase,
 * or appends the new phrase to the end if none was selected.
 */
export function replaceOrAppendChipPhrase(
  currentText: string,
  newPhrase: string,
  existingQuestionPhrases: string[]
): string {
  const pNew = newPhrase.trim();
  if (!pNew) return currentText;

  // Find if an existing phrase from this question is currently in text
  const otherPhrases = existingQuestionPhrases
    .map((p) => p.trim())
    .filter((p) => p.toLowerCase() !== pNew.toLowerCase());

  let replaced = false;
  let text = currentText;

  // Split into segments to replace cleanly
  const segments = text.split(",").map((s) => s.trim()).filter(Boolean);
  const updatedSegments = segments.map((seg) => {
    const segLower = seg.toLowerCase();
    const matchedOther = otherPhrases.find((op) => op.toLowerCase() === segLower);
    if (matchedOther && !replaced) {
      replaced = true;
      return pNew;
    }
    return seg;
  });

  if (replaced) {
    // Deduplicate in case new phrase was already there
    const seen = new Set<string>();
    const finalSegs: string[] = [];
    for (const s of updatedSegments) {
      const lower = s.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        finalSegs.push(s);
      }
    }
    return finalSegs.join(", ");
  }

  // Also check substring match if not segmented by commas
  for (const op of otherPhrases) {
    if (isPhraseSelected(text, op)) {
      const escaped = op.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "i");
      text = text.replace(regex, pNew);
      return cleanSeparators(text);
    }
  }

  // None of the other phrases were present: append to end
  return appendChipPhrase(currentText, pNew);
}
