// scripts/qa/snapshot_genie.ts
import fs from "fs";
import path from "path";
import { dataStore } from "../../src/lib/dataLoader";
import { search } from "../../src/lib/search";
import { vagueCheck } from "../../src/lib/vagueCheck";
import {
  evaluateTrigger,
  selectQuestions,
  genericFallbackQuestions,
} from "../../src/lib/coachEngine";

dataStore.init();

export const SNAPSHOT_QUERIES = [
  "me in a restaurant",
  "restaurant",
  "family picnic",
  "family",
  "friends",
  "pool",
  "me in a pool",
  "beach",
  "birthday party",
  "hiking",
  "festival",
  "kids park",
  "graduation",
  "dog",
  "road trip",
  "cake",
  "sunset",
  "elephant",
  "me",
  "12 March 2021 Goa pool",
];

export interface SnapshotItem {
  query: string;
  trigger: boolean;
  blockedReason: string;
  candidateCount: number;
  rows: Array<{
    cueType: string;
    questionText: string;
    field: string;
    options: Array<{ value: string; label: string; count: number; pct: number }>;
  }>;
  top10Results: Array<{
    id: string;
    score: number;
    tier: number;
    theme?: string;
  }>;
}

export function generateSnapshot(genieOff = false): SnapshotItem[] {
  return SNAPSHOT_QUERIES.map((q) => {
    const trimmed = q.trim();
    const vc = vagueCheck(trimmed);
    const triggerEval = evaluateTrigger({
      query: trimmed,
      isVague: vc.isVague,
      genieOff,
      hasBeenDismissed: false,
    });

    const isTriggered = triggerEval.shouldTrigger;
    const blockedReason = triggerEval.blockedReason || "";
    const candidateCount = triggerEval.candidateCount;

    let rows: SnapshotItem["rows"] = [];
    if (isTriggered) {
      let questions = selectQuestions(triggerEval.candidatePhotos, trimmed, [], 1.0, false);
      if (questions.length === 0) {
        questions = genericFallbackQuestions(trimmed, [], triggerEval.candidatePhotos);
      }
      rows = questions.map((qn) => ({
        cueType: qn.cueType,
        questionText: qn.questionText,
        field: qn.field,
        options: (qn.options || []).map((opt) => ({
          value: opt.value,
          label: opt.label,
          count: opt.count ?? 0,
          pct: opt.pct ?? 0,
        })),
      }));
    }

    const searchRes = search(trimmed);
    const top10Results = searchRes.results.slice(0, 10).map((r) => ({
      id: r.id,
      score: Math.round(r.score * 100) / 100,
      tier: r.tier,
      theme: r.theme,
    }));

    return {
      query: q,
      trigger: isTriggered,
      blockedReason,
      candidateCount,
      rows,
      top10Results,
    };
  });
}

// When run directly from CLI
const targetFile = process.argv[2] || "reports/snapshot_before.json";
const fullPath = path.resolve(process.cwd(), targetFile);
fs.mkdirSync(path.dirname(fullPath), { recursive: true });

const snapshot = generateSnapshot(false);
fs.writeFileSync(fullPath, JSON.stringify(snapshot, null, 2), "utf-8");
console.log(`Saved snapshot of ${snapshot.length} queries to ${targetFile}`);
