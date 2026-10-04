// src/lib/vagueCheck.ts — Rule-based Query Specificity Classifier
import placesData from "../../data/places.json";
import { Anchor, VagueCheckResult } from "@/types";
import { config } from "./config";

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec"
];

const MONTH_REGEX_PART = MONTH_NAMES.join("|");

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Checks for a precise time anchor in the query:
 * Time precise = exact date, month+year, or a 4-digit year (counts at most once: 1 if present, 0 if not).
 */
export function checkTimeAnchor(query: string): { hasTime: boolean; count: number } {
  if (!query) return { hasTime: false, count: 0 };
  const lower = query.toLowerCase();

  // 1. Exact full date with day: e.g. "12 March 2021", "March 12, 2021", "2021-03-12"
  const exactDayMonthYear = new RegExp(
    `\\b(?:(?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_REGEX_PART})\\s+\\d{4})|(?:(?:${MONTH_REGEX_PART})\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4})|(?:\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}))\\b`,
    "i"
  );
  if (exactDayMonthYear.test(lower)) {
    return { hasTime: true, count: 1 };
  }

  // 2. Month + Year: e.g. "january 2022" or "jan 2022"
  const monthYear = new RegExp(
    `\\b(?:${MONTH_REGEX_PART})\\s+(?:19\\d{2}|20\\d{2})\\b`,
    "i"
  );
  if (monthYear.test(lower)) {
    return { hasTime: true, count: 1 };
  }

  // 3. Standalone 4-digit year: e.g. "2023", "2021"
  const standaloneYear = /\b(?:19\d{2}|20\d{2})\b/;
  if (standaloneYear.test(lower)) {
    return { hasTime: true, count: 1 };
  }

  return { hasTime: false, count: 0 };
}

/**
 * Checks for precise named people in query using the registered places/people database.
 * Matches with word boundaries. Words like "me", "friends", "family", "kids" are approximations, not named people.
 */
export function checkPersonAnchor(query: string, registeredPeople: string[] = []): boolean {
  if (!query || !registeredPeople || registeredPeople.length === 0) return false;
  for (const person of registeredPeople) {
    if (person && person.trim()) {
      const rx = new RegExp(`\\b${escapeRegex(person.trim())}\\b`, "i");
      if (rx.test(query)) {
        return true;
      }
    }
  }
  return false;
}

import synonymsData from "../../data/synonyms.json";

/**
 * Checks for precise named places using the registered namedPlaces, venues, and place synonyms.
 * Matches with word boundaries. Generic categories like "pool", "beach", "restaurant" are not named places.
 */
export function checkLocationAnchor(query: string, namedPlaces: string[] = []): boolean {
  if (!query) return false;
  const allPlaces = [...namedPlaces, ...(placesData.venues || [])];
  for (const place of allPlaces) {
    if (place && place.trim()) {
      const rx = new RegExp(`\\b${escapeRegex(place.trim())}\\b`, "i");
      if (rx.test(query)) {
        return true;
      }
    }
  }

  // Also check city synonyms (e.g. "pondy" -> "pondicherry", "blr" -> "bengaluru")
  const synRecord = synonymsData as Record<string, string>;
  for (const [alias, canonical] of Object.entries(synRecord)) {
    const isPlaceSynonym = allPlaces.some((p) => p.toLowerCase() === canonical.toLowerCase());
    if (isPlaceSynonym) {
      const rx = new RegExp(`\\b${escapeRegex(alias)}\\b`, "i");
      if (rx.test(query)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Main vagueCheck function executing the classifier:
 * A search is vague when it lacks a precise anchor in at least 2 of 3 filters (Person, Time, Location).
 * precise_count = (hasPerson ? 1 : 0) + (hasTime ? 1 : 0) + (hasLocation ? 1 : 0).
 * isVague = precise_count < VAGUE_MIN_PRECISE_FILTERS (config, default 2).
 */
export function vagueCheck(query: string): VagueCheckResult {
  const q = (query || "").trim();
  if (!q) {
    return {
      isVague: true,
      anchors: { person: false, time: false, location: false },
      preciseCount: 0,
    };
  }

  const timeResult = checkTimeAnchor(q);
  const hasPerson = checkPersonAnchor(q, placesData.people);
  const hasLocation = checkLocationAnchor(q, placesData.namedPlaces);

  const anchors: Anchor = {
    person: hasPerson,
    time: timeResult.hasTime,
    location: hasLocation,
  };

  // Each filter (person, time, location) counts at most once (max 3)
  const preciseCount =
    (hasPerson ? 1 : 0) +
    (timeResult.hasTime ? 1 : 0) +
    (hasLocation ? 1 : 0);

  const minFilters = config.VAGUE_MIN_PRECISE_FILTERS ?? 2;
  const isVague = preciseCount < minFilters;

  return {
    isVague,
    anchors,
    preciseCount,
  };
}
