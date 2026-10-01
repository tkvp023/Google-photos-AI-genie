// src/lib/metrics.ts — Compute Derived Study Session Metrics
import { LogEvent, Mode } from "@/types";

export interface SessionMetrics {
  sessionId: string;
  participantId: string;
  mode: Mode;
  targetId: string;
  outcome: "found" | "timeout" | "gave_up" | "abandoned";
  timeToFindSec: number;
  queriesCount: number;
  chipsTappedCount: number;
  promptEdited: boolean;
  difficultyRating: number | null;
  satisfactionRating: number | null;
  comment: string;
}

export function computeSessionMetrics(events: LogEvent[]): SessionMetrics[] {
  // Group events by sessionId
  const sessionMap = new Map<string, LogEvent[]>();

  for (const evt of events) {
    if (!evt.sessionId) continue;
    const group = sessionMap.get(evt.sessionId) || [];
    group.push(evt);
    sessionMap.set(evt.sessionId, group);
  }

  const results: SessionMetrics[] = [];

  for (const [sessionId, sessionEvents] of sessionMap.entries()) {
    // Sort chronologically
    sessionEvents.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    const firstEvt = sessionEvents[0];
    const participantId = firstEvt.participantId || "P00";
    const mode = firstEvt.mode || "A";

    let targetId = "unknown";
    let startTime: number | null = null;
    let endTime: number | null = null;
    let outcome: "found" | "timeout" | "gave_up" | "abandoned" = "abandoned";
    let queriesCount = 0;
    let chipsTappedCount = 0;
    let promptEdited = false;
    let difficultyRating: number | null = null;
    let satisfactionRating: number | null = null;
    let comment = "";

    for (const e of sessionEvents) {
      if (e.payload?.targetId) {
        targetId = String(e.payload.targetId);
      }

      if (e.type === "target_hidden" || e.type === "task_start") {
        if (!startTime) startTime = new Date(e.ts).getTime();
      }

      if (e.type === "search_submitted") {
        queriesCount++;
      }

      if (e.type === "chip_tapped") {
        chipsTappedCount++;
      }

      if (e.type === "prompt_edited") {
        promptEdited = true;
      }

      if (e.type === "found") {
        outcome = "found";
        endTime = new Date(e.ts).getTime();
      }

      if (e.type === "timeout") {
        outcome = "timeout";
        endTime = new Date(e.ts).getTime();
      }

      if (e.type === "gave_up") {
        outcome = "gave_up";
        endTime = new Date(e.ts).getTime();
      }

      if (e.type === "survey_answered") {
        if (e.payload?.difficultyRating) difficultyRating = Number(e.payload.difficultyRating);
        if (e.payload?.satisfactionRating) satisfactionRating = Number(e.payload.satisfactionRating);
        if (e.payload?.comment) comment = String(e.payload.comment);
      }
    }

    let timeToFindSec = 0;
    if (startTime && endTime) {
      timeToFindSec = Math.round((endTime - startTime) / 1000);
    } else if (outcome === "timeout") {
      timeToFindSec = 180;
    }

    results.push({
      sessionId,
      participantId,
      mode,
      targetId,
      outcome,
      timeToFindSec,
      queriesCount,
      chipsTappedCount,
      promptEdited,
      difficultyRating,
      satisfactionRating,
      comment,
    });
  }

  return results;
}

/**
 * Converts session metrics to RFC 4180 CSV string.
 */
export function metricsToCsv(metrics: SessionMetrics[]): string {
  const headers = [
    "session_id",
    "participant_id",
    "mode",
    "target_id",
    "outcome",
    "time_to_find_sec",
    "queries_count",
    "chips_tapped_count",
    "prompt_edited",
    "difficulty_rating",
    "satisfaction_rating",
    "comment",
  ];

  const rows = metrics.map((m) => [
    m.sessionId,
    m.participantId,
    m.mode,
    m.targetId,
    m.outcome,
    m.timeToFindSec,
    m.queriesCount,
    m.chipsTappedCount,
    m.promptEdited ? "true" : "false",
    m.difficultyRating ?? "",
    m.satisfactionRating ?? "",
    `"${(m.comment || "").replace(/"/g, '""')}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
