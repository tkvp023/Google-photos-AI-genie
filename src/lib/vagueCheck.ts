// src/lib/vagueCheck.ts — Rule-based Query Specificity Classifier
import { dataStore } from "./dataLoader";
import { Anchor, VagueCheckResult } from "@/types";

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec"
];

const MONTH_REGEX_PART = MONTH_NAMES.join("|");

/**
 * Checks for a precise time anchor in the query:
 * - Exact date (e.g. "12 March 2021" or "March 12 2021") -> precision count: 2
 * - Month + Year (e.g. "january 2022") -> precision count: 1
 * - Year only (e.g. "2023") -> precision count: 1
 */
export function checkTimeAnchor(query: string): { hasTime: boolean; count: number } {
  if (!query) return { hasTime: false, count: 0 };
  const lower = query.toLowerCase();

  // 1. Exact full date with day: e.g. "12 March 2021" or "March 12, 2021" or "2021-03-12"
  const exactDayMonthYear = new RegExp(
    `\\b(?:(?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_REGEX_PART})\\s+\\d{4})|(?:(?:${MONTH_REGEX_PART})\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4})|(?:\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}))\\b`,
    "i"
  );
  if (exactDayMonthYear.test(lower)) {
    return { hasTime: true, count: 2 };
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
 * Note: words like "me", "friends", "family", "kids" are approximations, not named people.
 */
export function checkPersonAnchor(query: string, registeredPeople: string[] = []): boolean {
  if (!query || !registeredPeople || registeredPeople.length === 0) return false;
  const lower = query.toLowerCase();
  for (const person of registeredPeople) {
    if (person && lower.includes(person.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/**
 * Checks for precise named places using the registered namedPlaces database.
 * Note: generic categories like "pool", "beach", "restaurant" are not named places.
 */
export function checkLocationAnchor(query: string, namedPlaces: string[] = []): boolean {
  if (!query || !namedPlaces || namedPlaces.length === 0) return false;
  const lower = query.toLowerCase();
  for (const place of namedPlaces) {
    if (place && lower.includes(place.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/**
 * Main vagueCheck function executing the classifier.
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

  const placesData = dataStore.getPlaces();
  const timeResult = checkTimeAnchor(q);
  const hasPerson = checkPersonAnchor(q, placesData.people);
  const hasLocation = checkLocationAnchor(q, placesData.namedPlaces);

  const anchors: Anchor = {
    person: hasPerson,
    time: timeResult.hasTime,
    location: hasLocation,
  };

  const preciseCount =
    (hasPerson ? 1 : 0) +
    timeResult.count +
    (hasLocation ? 1 : 0);

  const isVague = preciseCount < 1;

  return {
    isVague,
    anchors,
    preciseCount,
  };
}
