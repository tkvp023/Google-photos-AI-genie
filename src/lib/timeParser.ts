// src/lib/timeParser.ts — Deterministic Time Parser with Soft Range Matching
// Evaluates relative and absolute temporal queries relative to DEMO_TODAY (2026-10-01).

export const DEMO_TODAY = "2026-10-01";
export const DEMO_YEAR = 2026;
export const DEMO_MONTH = 10;

export type Season = "summer" | "monsoon" | "post-monsoon" | "winter";

export const SEASONS: Season[] = ["winter", "summer", "monsoon", "post-monsoon"];

export const SEASON_ADJACENT: Record<Season, Season[]> = {
  summer: ["winter", "monsoon"],
  monsoon: ["summer", "post-monsoon"],
  "post-monsoon": ["monsoon", "winter"],
  winter: ["post-monsoon", "summer"],
};

export const MONTH_TO_SEASON: Record<number, Season> = {
  1: "winter", 2: "winter", 3: "summer", 4: "summer",
  5: "summer", 6: "summer", 7: "monsoon", 8: "monsoon",
  9: "monsoon", 10: "post-monsoon", 11: "post-monsoon", 12: "winter"
};

export const MONTH_NAME_TO_NUM: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

export interface ParsedTimeFilter {
  rawMatchedPhrase: string;
  isRelative: boolean;
  isPrecise: boolean; // exact year, exact month+year, exact season+year
  targetYear?: number;
  targetMonth?: number;
  targetDay?: number;
  targetSeason?: Season;
  softYears?: number[]; // +/- 1 year
}

/**
 * Extracts temporal constraints from user query text.
 */
export function parseTimeQuery(query: string): ParsedTimeFilter | null {
  if (!query || typeof query !== "string") return null;
  const q = query.toLowerCase().replace(/['"]/g, "").trim();

  // 1. Relative season + year phrases (e.g. "two summers ago", "last summer")
  // In Oct 2026:
  // "this summer" -> 2026
  // "last summer" -> 2025
  // "two summers ago" -> 2024
  // "three summers ago" -> 2023
  if (/\b(?:two|2|a\s+couple\s+of)\s+summers?\s+ago\b/i.test(q)) {
    return {
      rawMatchedPhrase: q.match(/\b(?:two|2|a\s+couple\s+of)\s+summers?\s+ago\b/i)![0],
      isRelative: true,
      isPrecise: false,
      targetYear: 2024,
      targetSeason: "summer",
      softYears: [2023, 2025],
    };
  }
  if (/\b(?:three|3)\s+summers?\s+ago\b/i.test(q)) {
    return {
      rawMatchedPhrase: q.match(/\b(?:three|3)\s+summers?\s+ago\b/i)![0],
      isRelative: true,
      isPrecise: false,
      targetYear: 2023,
      targetSeason: "summer",
      softYears: [2022, 2024],
    };
  }
  if (/\blast\s+summer\b/i.test(q)) {
    return {
      rawMatchedPhrase: q.match(/\blast\s+summer\b/i)![0],
      isRelative: true,
      isPrecise: false,
      targetYear: 2025,
      targetSeason: "summer",
      softYears: [2024, 2026],
    };
  }
  if (/\bthis\s+summer\b/i.test(q)) {
    return {
      rawMatchedPhrase: q.match(/\bthis\s+summer\b/i)![0],
      isRelative: true,
      isPrecise: false,
      targetYear: 2026,
      targetSeason: "summer",
      softYears: [2025],
    };
  }

  // 2. Relative year phrases
  if (/\bthis\s+year\b/i.test(q)) {
    return {
      rawMatchedPhrase: q.match(/\bthis\s+year\b/i)![0],
      isRelative: true,
      isPrecise: false,
      targetYear: 2026,
      softYears: [2025],
    };
  }
  if (/\blast\s+year\b/i.test(q)) {
    return {
      rawMatchedPhrase: q.match(/\blast\s+year\b/i)![0],
      isRelative: true,
      isPrecise: false,
      targetYear: 2025,
      softYears: [2024, 2026],
    };
  }
  if (/\b(?:a\s+)?couple(?:\s+of)?\s+years?\s+ago\b/i.test(q) || /\b(?:two|2)\s+years?\s+ago\b/i.test(q)) {
    const m = q.match(/\b(?:a\s+)?couple(?:\s+of)?\s+years?\s+ago\b/i) || q.match(/\b(?:two|2)\s+years?\s+ago\b/i);
    return {
      rawMatchedPhrase: m![0],
      isRelative: true,
      isPrecise: false,
      targetYear: 2024,
      softYears: [2023, 2025],
    };
  }
  if (/\b(?:a\s+)?few\s+years?\s+ago\b/i.test(q) || /\b(?:three|3)\s+years?\s+ago\b/i.test(q)) {
    const m = q.match(/\b(?:a\s+)?few\s+years?\s+ago\b/i) || q.match(/\b(?:three|3)\s+years?\s+ago\b/i);
    return {
      rawMatchedPhrase: m![0],
      isRelative: true,
      isPrecise: false,
      targetYear: 2023,
      softYears: [2022, 2024],
    };
  }
  if (/\b(?:four|4)\s+years?\s+ago\b/i.test(q)) {
    return {
      rawMatchedPhrase: q.match(/\b(?:four|4)\s+years?\s+ago\b/i)![0],
      isRelative: true,
      isPrecise: false,
      targetYear: 2022,
      softYears: [2021, 2023],
    };
  }
  if (/\b(?:five|5)\s+years?\s+ago\b/i.test(q)) {
    return {
      rawMatchedPhrase: q.match(/\b(?:five|5)\s+years?\s+ago\b/i)![0],
      isRelative: true,
      isPrecise: false,
      targetYear: 2021,
      softYears: [2020, 2022],
    };
  }

  // 2b. Relative anchor "earlier" / "long time ago" / "ages ago"
  // Maps to photos from 3+ years back (2022 and before). Uses a wide soft range.
  if (/\bearlier\b/i.test(q) || /\blong(?:\s+time)?\s+ago\b/i.test(q) || /\bages\s+ago\b/i.test(q)) {
    const m = q.match(/\bearlier\b/i) || q.match(/\blong(?:\s+time)?\s+ago\b/i) || q.match(/\bages\s+ago\b/i);
    return {
      rawMatchedPhrase: m![0],
      isRelative: true,
      isPrecise: false,
      // "earlier" = photos from before 3 years ago; soft range covers 2019–2022
      targetYear: 2022,
      softYears: [2019, 2020, 2021, 2023],
    };
  }


  // 3. Exact Day + Month + Year or Month + Year (e.g. "12 March 2021", "March 2021")
  const dateRegex = /\b(?:(\d{1,2})(?:st|nd|rd|th)?\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(201[9]|202[0-6])\b/i;
  const dMatch = q.match(dateRegex);
  if (dMatch) {
    const dayNum = dMatch[1] ? parseInt(dMatch[1], 10) : undefined;
    const monthNum = MONTH_NAME_TO_NUM[dMatch[2].toLowerCase()];
    const yr = parseInt(dMatch[3], 10);
    return {
      rawMatchedPhrase: dMatch[0],
      isRelative: false,
      isPrecise: true,
      targetYear: yr,
      targetMonth: monthNum,
      targetDay: dayNum,
      targetSeason: MONTH_TO_SEASON[monthNum],
      softYears: [yr - 1, yr + 1],
    };
  }

  // 4. Season + Year (e.g. "Summer 2023", "Winter 2021")
  const seasonYearRegex = /\b(summer|monsoon|post-monsoon|winter)\s+(201[9]|202[0-6])\b/i;
  const syMatch = q.match(seasonYearRegex);
  if (syMatch) {
    const sName = syMatch[1].toLowerCase() as Season;
    const yr = parseInt(syMatch[2], 10);
    return {
      rawMatchedPhrase: syMatch[0],
      isRelative: false,
      isPrecise: true,
      targetYear: yr,
      targetSeason: sName,
      softYears: [yr - 1, yr + 1],
    };
  }

  // 5. Exact Year alone (e.g. "2023", "2019")
  const yearAloneRegex = /\b(201[9]|202[0-6])\b/;
  const yMatch = q.match(yearAloneRegex);
  if (yMatch) {
    const yr = parseInt(yMatch[1], 10);
    return {
      rawMatchedPhrase: yMatch[0],
      isRelative: false,
      isPrecise: true,
      targetYear: yr,
      softYears: [yr - 1, yr + 1],
    };
  }

  // 6. Season words alone (e.g. "summer", "monsoon", "winter")
  const seasonAloneRegex = /\b(summer|monsoon|post-monsoon|winter)\b/i;
  const sMatch = q.match(seasonAloneRegex);
  if (sMatch) {
    const sName = sMatch[1].toLowerCase() as Season;
    return {
      rawMatchedPhrase: sMatch[0],
      isRelative: false,
      isPrecise: false,
      targetSeason: sName,
    };
  }

  // 7. Full month name alone (e.g. "January", "May")
  const monthAloneRegex = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i;
  const mAloneMatch = q.match(monthAloneRegex);
  if (mAloneMatch) {
    const monthNum = MONTH_NAME_TO_NUM[mAloneMatch[1].toLowerCase()];
    return {
      rawMatchedPhrase: mAloneMatch[0],
      isRelative: false,
      isPrecise: false,
      targetMonth: monthNum,
      targetSeason: MONTH_TO_SEASON[monthNum],
    };
  }

  return null;
}

/**
 * Evaluates soft temporal matching score for a photo.
 * Returns:
 *   1.0: Full match within target range
 *   0.5: Soft match (+/- 1 year or adjacent season)
 *   0.0: No match
 */
export function scoreTimeMatch(
  photoYearOrFilter: number | ParsedTimeFilter,
  photoMonthOrYear?: number,
  photoSeasonOrMonth?: Season | string | number,
  filterOrSeason?: ParsedTimeFilter | Season | string
): { scoreMultiplier: number; isMatch: boolean; isDirect: boolean } {
  let filter: ParsedTimeFilter;
  let photoYear: number | undefined;
  let photoMonth: number | undefined;
  let photoSeason: Season | undefined;

  if (typeof photoYearOrFilter === "object" && photoYearOrFilter !== null) {
    filter = photoYearOrFilter;
    photoYear = typeof photoMonthOrYear === "number" ? photoMonthOrYear : undefined;
    photoMonth = typeof photoSeasonOrMonth === "number" ? photoSeasonOrMonth : undefined;
    photoSeason = typeof filterOrSeason === "string" ? (filterOrSeason as Season) : undefined;
  } else {
    photoYear = photoYearOrFilter;
    photoMonth = typeof photoMonthOrYear === "number" ? photoMonthOrYear : undefined;
    photoSeason = typeof photoSeasonOrMonth === "string" ? (photoSeasonOrMonth as Season) : undefined;
    filter = filterOrSeason as ParsedTimeFilter;
  }

  if (!filter) {
    return { scoreMultiplier: 0.0, isMatch: false, isDirect: false };
  }

  const { targetYear, targetMonth, targetSeason, softYears } = filter;

  // Exact / Full match condition
  let yearMatches = targetYear === undefined || (photoYear !== undefined && targetYear === photoYear);
  let monthMatches = targetMonth === undefined || (photoMonth !== undefined && targetMonth === photoMonth);
  let seasonMatches = targetSeason === undefined || (photoSeason !== undefined && targetSeason === photoSeason);

  if (yearMatches && monthMatches && seasonMatches) {
    return { scoreMultiplier: 1.0, isMatch: true, isDirect: true };
  }

  // Soft match conditions:
  // 1. Year is in softYears (+/- 1 year) and season/month matches if specified
  if (softYears && photoYear !== undefined && softYears.includes(photoYear)) {
    if ((targetMonth === undefined || targetMonth === photoMonth) &&
        (targetSeason === undefined || targetSeason === photoSeason)) {
      return { scoreMultiplier: 0.5, isMatch: true, isDirect: false };
    }
  }

  // 2. Year matches, but season is adjacent in the same year
  if (yearMatches && targetSeason && photoSeason && SEASON_ADJACENT[targetSeason]?.includes(photoSeason)) {
    return { scoreMultiplier: 0.5, isMatch: true, isDirect: false };
  }

  return { scoreMultiplier: 0.0, isMatch: false, isDirect: false };
}
