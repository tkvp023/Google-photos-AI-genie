// src/lib/metrics.ts — Compute Derived Study Session Metrics & Per-Mode Summary
import { LogEvent, Mode, SessionMetrics, PerModeSummary } from "@/types";
import { vagueCheck } from "./vagueCheck";
import { classifyCues } from "./cueClassifier";
import { parseTimeQuery } from "./timeParser";

export type { SessionMetrics, PerModeSummary };

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
  }
  return Math.round(sorted[mid] * 10) / 10;
}

export function computeSessionMetrics(events: LogEvent[]): SessionMetrics[] {
  // 1. Identify voided sessions
  const voidedSessionIds = new Set<string>();
  for (const e of events) {
    if (e.type === "session_voided" && e.sessionId) {
      voidedSessionIds.add(e.sessionId);
    }
    if (e.payload?.voidedSessionId) {
      voidedSessionIds.add(String(e.payload.voidedSessionId));
    }
  }

  // 2. Group events by sessionId
  const sessionMap = new Map<string, LogEvent[]>();
  for (const evt of events) {
    if (!evt.sessionId) continue;
    const group = sessionMap.get(evt.sessionId) || [];
    group.push(evt);
    sessionMap.set(evt.sessionId, group);
  }

  const results: SessionMetrics[] = [];

  const getEventTs = (evt: any): number => {
    if (typeof evt.timestamp === "number" && !isNaN(evt.timestamp)) return evt.timestamp;
    if (evt.ts) {
      const t = new Date(evt.ts).getTime();
      if (!isNaN(t)) return t;
    }
    return 0;
  };

  for (const [sessionId, sessionEvents] of sessionMap.entries()) {
    // Sort chronologically
    sessionEvents.sort((a, b) => getEventTs(a) - getEventTs(b));

    const firstEvt = sessionEvents[0];
    const participantId = firstEvt.participantId || "P01";
    const mode = firstEvt.mode || "A";

    const isVoided = voidedSessionIds.has(sessionId);
    let isPractice = sessionId.startsWith("s_practice") || firstEvt.isPractice === true;

    let targetId = "T01";
    let startTime: number | null = null;
    let endTime: number | null = null;
    let firstKeystrokeTime: number | null = null;
    let explicitTimeToFindSec = 0;
    let outcome: "found" | "timeout" | "gave_up" | "abandoned" = "abandoned";

    let firstTypedText = "";
    let typedTextAtTrigger = "";
    let finalSubmittedText = "";
    let firstQueryText = "";
    let firstQuerySource: "typed" | "composed" | "composed_edited" | "typed_plus_chips" | "typed_plus_chips_edited" = "typed";
    let firstQuerySubmitted = false;
    let resultsPerFirstQuery = 0;
    let resultsForFirstTyped = 0;
    let narrowingRatio = 1.0;
    let secondsFirstKeystrokeToSubmit = 0;

    let coachTriggered = false;
    let coachTriggerTime: number | null = null;
    let firstChipTapTime: number | null = null;
    let coachLayer: "library" | "generic" | "none" = "none";
    let chipsTappedCount = 0;
    let textEditedAfterChip = false;
    let coachDismissed = false;
    let coachShownQuestions: string[] = [];
    let questionsIgnored = 0;
    let coachAccepted = false;
    let secondsFirstChipTapFromTrigger = 0;
    let chipsSelectedAtSubmit = 0;
    const chipsByCueType = {
      when: 0,
      where: 0,
      who: 0,
      other: 0,
    };

    let dontRememberCount = 0;
    let notTheseCount = 0;
    let promptEdited = false;
    let promptBeforeEdit: string | undefined = undefined;
    let promptAfterEdit: string | undefined = undefined;
    let composer: "groq" | "fallback" | "template" | "none" = mode === "B" ? "template" : "none";
    let composerReason: string | undefined = mode === "B" ? "template" : undefined;
    let composerLatencyMs = 0;
    let previewCountAfterChips = 0;
    let finalResultCount = 0;

    let wrongOpensCount = 0;
    const openedPhotoRanks: number[] = [];
    let foundPhotoId = "";

    let difficultyRating: number | null = null;
    let satisfactionRating: number | null = null;
    let comment = "";
    let chipMatchRating: number | null = null;
    let chipHelpfulCuetype: string | null = null;
    let triggerBlockedReason = "";
    let hintShown = false;

    for (const e of sessionEvents) {
      const evtTs = getEventTs(e);

      if (e.isPractice === true || (e.payload as any)?.is_practice === true || (e.payload as any)?.isPractice === true) {
        isPractice = true;
      }
      if (e.payload?.targetId) {
        targetId = String(e.payload.targetId);
      }

      if (e.type === "target_hidden" || e.type === "task_start") {
        if (!startTime) startTime = evtTs;
      }

      if (e.type === "hint_shown") {
        hintShown = true;
      }
      if ((e.payload as any)?.hint_shown !== undefined) {
        hintShown = Boolean((e.payload as any).hint_shown);
      }
      if ((e.payload as any)?.hintShown !== undefined) {
        hintShown = Boolean((e.payload as any).hintShown);
      }
      if ((e.payload as any)?.trigger_blocked_reason) {
        triggerBlockedReason = String((e.payload as any).trigger_blocked_reason);
      }
      if ((e.payload as any)?.triggerBlockedReason) {
        triggerBlockedReason = String((e.payload as any).triggerBlockedReason);
      }

      if (e.type === "search_keystroke") {
        if (!firstKeystrokeTime) firstKeystrokeTime = evtTs;
        if (!coachTriggered && !firstQuerySubmitted && e.payload?.query) {
          firstTypedText = String(e.payload.query);
        }
      }

      if (e.type === "coach_triggered" || e.type === "coach_shown") {
        coachTriggered = true;
        if (!coachTriggerTime) coachTriggerTime = evtTs;
        if (!firstTypedText && e.payload?.query) {
          firstTypedText = String(e.payload.query);
        }
        if (!typedTextAtTrigger && e.payload?.query) {
          typedTextAtTrigger = String(e.payload.query);
        }
        if (e.payload?.layer) {
          coachLayer = String(e.payload.layer) === "generic_fallback" ? "generic" : "library";
        }
        if (e.payload?.candidateCount) {
          resultsForFirstTyped = Number(e.payload.candidateCount);
        }
      }

      if (e.type === "chip_tapped" || e.type === "coach_chip_tapped") {
        chipsTappedCount++;
        const rawCue = String(e.payload?.cueType || "").toLowerCase();
        const rawQId = String(e.payload?.questionId || "").toLowerCase();
        if (rawCue === "when" || rawQId.includes("when") || rawQId.includes("time") || rawQId.includes("season")) {
          chipsByCueType.when++;
        } else if (rawCue === "where" || rawQId.includes("where") || rawQId.includes("place") || rawQId.includes("venue") || rawQId.includes("city")) {
          chipsByCueType.where++;
        } else if (rawCue === "who" || rawQId.includes("who") || rawQId.includes("cast") || rawQId.includes("people") || rawQId.includes("group")) {
          chipsByCueType.who++;
        } else {
          chipsByCueType.other++;
        }
        if (!firstChipTapTime) firstChipTapTime = evtTs;
        if (e.payload?.candidateCountAfter !== undefined) {
          previewCountAfterChips = Number(e.payload.candidateCountAfter);
        }
        if (e.payload?.questionId) {
          const qId = String(e.payload.questionId);
          if (!coachShownQuestions.includes(qId)) coachShownQuestions.push(qId);
        }
      }

      if (e.type === "coach_dismissed") {
        coachDismissed = true;
      }

      if (e.type === "chip_skipped" || e.type === "coach_chip_skipped") {
        dontRememberCount++;
      }

      if (e.type === "coach_reset") {
        notTheseCount++;
      }

      if (e.type === "prompt_composed") {
        if (e.payload?.composer) {
          composer = e.payload.composer === "groq" ? "groq" : e.payload.composer === "template" ? "template" : "fallback";
        }
        if (e.payload?.composerReason) composerReason = String(e.payload.composerReason);
        if (e.payload?.latencyMs) composerLatencyMs = Number(e.payload.latencyMs);
      }

      if (e.type === "prompt_edited") {
        promptEdited = true;
        if (e.payload?.originalPrompt) promptBeforeEdit = String(e.payload.originalPrompt);
        if (e.payload?.editedPrompt) promptAfterEdit = String(e.payload.editedPrompt);
      }

      if (e.type === "search_submitted") {
        if (!firstQuerySubmitted) {
          firstQuerySubmitted = true;
          firstQueryText = String(e.payload?.query || "");
          finalSubmittedText = firstQueryText;
          firstTypedText = String(e.payload?.firstTypedText || firstTypedText || firstQueryText);
          typedTextAtTrigger = String(e.payload?.typedTextAtTrigger || typedTextAtTrigger || firstTypedText);
          firstQuerySource = (e.payload?.firstQuerySource as any) || (mode === "A" ? "typed" : "typed_plus_chips");

          if (e.payload?.resultsCount !== undefined) {
            resultsPerFirstQuery = Number(e.payload.resultsCount);
            finalResultCount = resultsPerFirstQuery;
          } else if (e.payload?.resultsPerFirstQuery !== undefined) {
            resultsPerFirstQuery = Number(e.payload.resultsPerFirstQuery);
            finalResultCount = resultsPerFirstQuery;
          }

          if (e.payload?.resultsForFirstTyped !== undefined) {
            resultsForFirstTyped = Number(e.payload.resultsForFirstTyped);
          }

          if (e.payload?.narrowingRatio !== undefined) {
            narrowingRatio = Number(e.payload.narrowingRatio);
          }

          if (e.payload?.secondsFirstKeystrokeToSubmit !== undefined) {
            secondsFirstKeystrokeToSubmit = Number(e.payload.secondsFirstKeystrokeToSubmit);
          } else if (firstKeystrokeTime && evtTs > firstKeystrokeTime) {
            secondsFirstKeystrokeToSubmit = Math.round((evtTs - firstKeystrokeTime) / 100) / 10;
          }

          if (e.payload?.coachTriggered !== undefined) {
            coachTriggered = Boolean(e.payload.coachTriggered);
          }
          if (e.payload?.coachLayer) {
            coachLayer = String(e.payload.coachLayer) as any;
          }
          if (e.payload?.coachDismissed !== undefined) {
            coachDismissed = Boolean(e.payload.coachDismissed);
          }
          if (e.payload?.coachShownQuestions && Array.isArray(e.payload.coachShownQuestions)) {
            coachShownQuestions = e.payload.coachShownQuestions.map(String);
          }
          if (e.payload?.questionsIgnored !== undefined) {
            questionsIgnored = Number(e.payload.questionsIgnored);
          }
          if (e.payload?.coachAccepted !== undefined) {
            coachAccepted = Boolean(e.payload.coachAccepted);
          }
          if (e.payload?.chipsTappedCount !== undefined) {
            chipsTappedCount = Math.max(chipsTappedCount, Number(e.payload.chipsTappedCount));
          }
          if (e.payload?.textEditedAfterChip !== undefined) {
            textEditedAfterChip = Boolean(e.payload.textEditedAfterChip);
          }
          if (e.payload?.chipsSelectedAtSubmit !== undefined) {
            chipsSelectedAtSubmit = Number(e.payload.chipsSelectedAtSubmit);
          }
          if (e.payload?.secondsFirstChipTapFromTrigger !== undefined) {
            secondsFirstChipTapFromTrigger = Number(e.payload.secondsFirstChipTapFromTrigger);
          }
          if (e.payload?.dontRememberCount !== undefined) {
            dontRememberCount = Math.max(dontRememberCount, Number(e.payload.dontRememberCount));
          }
          if (e.payload?.notTheseCount !== undefined) {
            notTheseCount = Math.max(notTheseCount, Number(e.payload.notTheseCount));
          }
          if (e.payload?.promptEdited !== undefined) {
            promptEdited = Boolean(e.payload.promptEdited);
          }
          if (e.payload?.composer) {
            composer = e.payload.composer === "groq" ? "groq" : e.payload.composer === "template" ? "template" : "fallback";
          }
          if (e.payload?.composerReason) {
            composerReason = String(e.payload.composerReason);
          }
          if (e.payload?.composerLatencyMs !== undefined) {
            composerLatencyMs = Number(e.payload.composerLatencyMs);
          }
          if (e.payload?.previewCountAfterChips !== undefined) {
            previewCountAfterChips = Number(e.payload.previewCountAfterChips);
          }
        }
      }

      if (e.type === "photo_opened") {
        if (e.payload?.rank !== undefined) {
          openedPhotoRanks.push(Number(e.payload.rank));
        }
      }

      if (e.type === "wrong_open") {
        wrongOpensCount++;
      }

      if (e.type === "found") {
        outcome = "found";
        endTime = evtTs;
        if (e.payload?.photoId) foundPhotoId = String(e.payload.photoId);
      }

      if (e.type === "timeout") {
        outcome = "timeout";
        endTime = evtTs;
      }

      if (e.type === "gave_up") {
        outcome = "gave_up";
        endTime = evtTs;
      }

      if (e.type === "task_completed") {
        if (e.payload?.outcome) outcome = e.payload.outcome as any;
        if (e.payload?.timeToFindSec !== undefined) explicitTimeToFindSec = Number(e.payload.timeToFindSec);
        if (e.payload?.selectedPhotoId) foundPhotoId = String(e.payload.selectedPhotoId);
        if (!endTime) endTime = evtTs;
      }

      if (e.type === "survey_answered") {
        if (e.payload?.difficultyRating) difficultyRating = Number(e.payload.difficultyRating);
        if (e.payload?.satisfactionRating) satisfactionRating = Number(e.payload.satisfactionRating);
        if (e.payload?.chip_match_rating !== undefined && e.payload?.chip_match_rating !== null) {
          chipMatchRating = Number(e.payload.chip_match_rating);
        }
        if (e.payload?.chip_helpful_cuetype) {
          chipHelpfulCuetype = String(e.payload.chip_helpful_cuetype);
        }
        if (e.payload?.comment) comment = String(e.payload.comment);
      }
    }

    // Fallbacks if search_submitted was missing or direct
    if (!firstTypedText) firstTypedText = firstQueryText || "pool";
    if (!typedTextAtTrigger) typedTextAtTrigger = firstTypedText;
    if (!firstQueryText) firstQueryText = firstTypedText;
    if (!finalSubmittedText) finalSubmittedText = firstQueryText;

    // Run vagueCheck on first_typed_text
    const vc = vagueCheck(firstTypedText);
    const isVagueFirstTyped = vc.isVague;
    const anchors = vc.anchors;
    const preciseCount = vc.preciseCount;

    // Run classifyCues on first_query_text
    const cc = classifyCues(firstQueryText);
    const cueTypesInFirstQuery = cc.cueTypes;
    const cueCountFirstQuery = cc.cueCount;
    const firstQueryHas2PlusCues = cc.has2PlusCues;

    // Step 7: Synthetic metadata logging & cue telemetry
    const vcFirstQuery = vagueCheck(firstQueryText);
    const parsedTimeFirstQuery = parseTimeQuery(firstQueryText);
    const timeCueInFirstQuery = cueTypesInFirstQuery.includes("when") || vcFirstQuery.anchors.time || parsedTimeFirstQuery !== null;
    const placeCueInFirstQuery = cueTypesInFirstQuery.includes("where") || vcFirstQuery.anchors.location;
    const personCueInFirstQuery = cueTypesInFirstQuery.includes("who") || vcFirstQuery.anchors.person;
    const firstQueryHasPreciseAnchor = vcFirstQuery.preciseCount >= 1;
    const metadataSynthetic = true;

    // Estimated result count if not explicitly logged
    if (resultsPerFirstQuery <= 0) {
      resultsPerFirstQuery = previewCountAfterChips > 0 ? previewCountAfterChips : 10;
    }
    if (resultsForFirstTyped <= 0) {
      resultsForFirstTyped = previewCountAfterChips > 0 ? previewCountAfterChips : resultsPerFirstQuery;
    }
    if (finalResultCount <= 0) {
      finalResultCount = resultsPerFirstQuery;
    }
    if (narrowingRatio === 1.0 && resultsForFirstTyped > 0) {
      narrowingRatio = Math.round((resultsPerFirstQuery / resultsForFirstTyped) * 100) / 100;
    }

    if (secondsFirstChipTapFromTrigger === 0 && firstChipTapTime && coachTriggerTime && firstChipTapTime >= coachTriggerTime) {
      secondsFirstChipTapFromTrigger = Math.max(0, Math.round((firstChipTapTime - coachTriggerTime) / 1000));
    }

    if (chipsSelectedAtSubmit === 0 && chipsTappedCount > 0) {
      chipsSelectedAtSubmit = chipsTappedCount;
    }

    if (!coachAccepted) {
      coachAccepted = chipsSelectedAtSubmit >= 1;
    }

    if (questionsIgnored === 0 && coachShownQuestions.length > 0 && chipsTappedCount === 0) {
      questionsIgnored = coachShownQuestions.length;
    }

    let timeToFindSec = explicitTimeToFindSec;
    if (timeToFindSec <= 0) {
      if (startTime && endTime) {
        timeToFindSec = Math.max(1, Math.round((endTime - startTime) / 1000));
      } else if (outcome === "timeout") {
        timeToFindSec = 180;
      }
    }

    results.push({
      sessionId,
      participantId,
      mode,
      targetId,
      isPractice,
      hintShown,
      isVoided,

      firstTypedText,
      typedTextAtTrigger,
      finalSubmittedText,
      isVagueFirstTyped,
      anchors,
      preciseCount,

      firstQueryText,
      firstQuerySource,
      cueTypesInFirstQuery,
      cueCountFirstQuery,
      firstQueryHas2PlusCues,
      resultsPerFirstQuery,
      resultsForFirstTyped,
      narrowingRatio,
      secondsFirstKeystrokeToSubmit,

      coachTriggered,
      triggerBlockedReason,
      coachLayer,
      chipsTappedCount,
      dontRememberCount,
      notTheseCount,
      textEditedAfterChip,
      coachDismissed,
      coachShownQuestions,
      questionsIgnored,
      coachAccepted,
      secondsFirstChipTapFromTrigger,
      chipsSelectedAtSubmit,
      promptEdited,
      promptBeforeEdit,
      promptAfterEdit,
      composer,
      composerReason,
      composerLatencyMs,
      previewCountAfterChips,
      finalResultCount,

      wrongOpensCount,
      openedPhotoRanks,
      foundPhotoId,
      outcome,
      timeToFindSec,

      difficultyRating,
      satisfactionRating,
      comment,
      chipMatchRating,
      chipHelpfulCuetype,

      timeCueInFirstQuery,
      placeCueInFirstQuery,
      personCueInFirstQuery,
      chipsByCueType: { ...chipsByCueType },
      firstQueryHasPreciseAnchor,
      metadataSynthetic,
    });
  }

  return results;
}

/**
 * Computes per-mode summary statistics across non-practice, non-voided sessions.
 */
export function computePerModeSummary(metrics: SessionMetrics[]): Record<"A" | "B" | "All", PerModeSummary> {
  const valid = metrics.filter((m) => !m.isPractice && !m.isVoided);

  const calculateGroup = (group: SessionMetrics[], modeLabel: Mode | "All"): PerModeSummary => {
    const n = group.length;
    if (n === 0) {
      return {
        mode: modeLabel,
        sessions: 0,
        vagueSessions: 0,
        queryFormationRate: 0,
        avgResultsPerFirstQuery: 0,
        medianResultsPerFirstQuery: 0,
        foundRate: 0,
        medianTimeToFindSec: 0,
        coachTriggerRate: 0,
        skipRate: 0,
        promptEditRate: 0,
        fallbackComposerRate: 0,
        coachAcceptanceRate: 0,
        coachDismissRate: 0,
        coachIgnoreRate: 0,
        textEditRate: 0,
      };
    }

    const vagueGroup = group.filter((m) => m.isVagueFirstTyped);
    const vagueSessions = vagueGroup.length;
    const vague2PlusCues = vagueGroup.filter((m) => m.firstQueryHas2PlusCues).length;
    const queryFormationRate = vagueSessions > 0 ? Math.round((vague2PlusCues / vagueSessions) * 100) / 100 : 0;

    const resultsList = group.map((m) => m.resultsPerFirstQuery);
    const avgResultsPerFirstQuery =
      Math.round((resultsList.reduce((acc, v) => acc + v, 0) / n) * 10) / 10;
    const medianResultsPerFirstQuery = calculateMedian(resultsList);

    const foundSessions = group.filter((m) => m.outcome === "found");
    const foundRate = Math.round((foundSessions.length / n) * 100) / 100;
    const medianTimeToFindSec = calculateMedian(
      (foundSessions.length > 0 ? foundSessions : group).map((m) => m.timeToFindSec)
    );

    const coachTriggerRate = Math.round((group.filter((m) => m.coachTriggered).length / n) * 100) / 100;
    const skipRate = Math.round((group.filter((m) => m.dontRememberCount > 0).length / n) * 100) / 100;
    const promptEditRate = Math.round((group.filter((m) => m.promptEdited).length / n) * 100) / 100;
    const fallbackComposerRate =
      Math.round((group.filter((m) => m.composer === "fallback").length / n) * 100) / 100;

    const coachAcceptanceRate =
      Math.round((group.filter((m) => m.coachAccepted).length / n) * 100) / 100;
    const coachDismissRate =
      Math.round((group.filter((m) => m.coachDismissed).length / n) * 100) / 100;
    const coachIgnoreRate =
      Math.round((group.filter((m) => m.coachTriggered && m.chipsTappedCount === 0).length / n) * 100) / 100;
    const textEditRate =
      Math.round((group.filter((m) => m.textEditedAfterChip).length / n) * 100) / 100;

    return {
      mode: modeLabel,
      sessions: n,
      vagueSessions,
      queryFormationRate,
      avgResultsPerFirstQuery,
      medianResultsPerFirstQuery,
      foundRate,
      medianTimeToFindSec,
      coachTriggerRate,
      skipRate,
      promptEditRate,
      fallbackComposerRate,
      coachAcceptanceRate,
      coachDismissRate,
      coachIgnoreRate,
      textEditRate,
    };
  };

  return {
    A: calculateGroup(valid.filter((m) => m.mode === "A"), "A"),
    B: calculateGroup(valid.filter((m) => m.mode === "B"), "B"),
    All: calculateGroup(valid, "All"),
  };
}

/**
 * Converts session metrics to RFC 4180 CSV string with all required fields and per-mode summary.
 * Excludes is_practice and is_voided sessions by default.
 */
export function metricsToCsv(metrics: SessionMetrics[], options?: { includePractice?: boolean }): string {
  const valid = options?.includePractice ? metrics : metrics.filter((m) => !m.isPractice && !m.isVoided);

  const headers = [
    "session_id",
    "participant_id",
    "mode",
    "target_id",
    "is_practice",
    "hint_shown",
    "first_typed_text",
    "typed_text_at_trigger",
    "final_submitted_text",
    "is_vague_first_typed",
    "anchors_person",
    "anchors_time",
    "anchors_location",
    "precise_count",
    "first_query_text",
    "first_query_source",
    "cue_types_in_first_query",
    "cue_count_first_query",
    "first_query_has_2plus_cues",
    "results_for_first_typed",
    "results_per_first_query",
    "narrowing_ratio",
    "seconds_first_keystroke_to_first_submit",
    "coach_triggered",
    "trigger_blocked_reason",
    "coach_layer",
    "coach_dismissed",
    "coach_shown_questions",
    "questions_ignored",
    "coach_accepted",
    "seconds_first_chip_tap_from_trigger",
    "chips_tapped_count",
    "chips_selected_at_submit",
    "text_edited_after_chip",
    "dont_remember_count",
    "not_these_count",
    "prompt_edited",
    "prompt_before_edit",
    "prompt_after_edit",
    "composer",
    "composer_reason",
    "composer_latency_ms",
    "preview_count_after_chips",
    "final_result_count",
    "wrong_opens_count",
    "opened_photo_ranks",
    "found_photo_id",
    "outcome",
    "time_to_find_sec",
    "difficulty_rating",
    "satisfaction_rating",
    "comment",
    "time_cue_in_first_query",
    "place_cue_in_first_query",
    "person_cue_in_first_query",
    "chips_by_cuetype",
    "first_query_has_precise_anchor",
    "metadata_synthetic",
  ];

  const escapeCsv = (str: string | undefined | null) => `"${(str || "").replace(/"/g, '""')}"`;

  const rows = valid.map((m) => [
    m.sessionId,
    m.participantId,
    m.mode,
    m.targetId,
    m.isPractice ? "true" : "false",
    m.hintShown ? "true" : "false",
    escapeCsv(m.firstTypedText),
    escapeCsv(m.typedTextAtTrigger || m.firstTypedText),
    escapeCsv(m.finalSubmittedText || m.firstQueryText),
    m.isVagueFirstTyped ? "true" : "false",
    m.anchors.person ? "true" : "false",
    m.anchors.time ? "true" : "false",
    m.anchors.location ? "true" : "false",
    m.preciseCount,
    escapeCsv(m.firstQueryText),
    m.firstQuerySource,
    escapeCsv(m.cueTypesInFirstQuery.join(";")),
    m.cueCountFirstQuery,
    m.firstQueryHas2PlusCues ? "true" : "false",
    m.resultsForFirstTyped,
    m.resultsPerFirstQuery,
    m.narrowingRatio,
    m.secondsFirstKeystrokeToSubmit,
    m.coachTriggered ? "true" : "false",
    escapeCsv(m.triggerBlockedReason || ""),
    m.coachLayer,
    m.coachDismissed ? "true" : "false",
    escapeCsv(m.coachShownQuestions.join(";")),
    m.questionsIgnored,
    m.coachAccepted ? "true" : "false",
    m.secondsFirstChipTapFromTrigger,
    m.chipsTappedCount,
    m.chipsSelectedAtSubmit,
    m.textEditedAfterChip ? "true" : "false",
    m.dontRememberCount,
    m.notTheseCount,
    m.promptEdited ? "true" : "false",
    escapeCsv(m.promptBeforeEdit || ""),
    escapeCsv(m.promptAfterEdit || ""),
    m.composer,
    escapeCsv(m.composerReason || ""),
    m.composerLatencyMs,
    m.previewCountAfterChips,
    m.finalResultCount,
    m.wrongOpensCount,
    escapeCsv(m.openedPhotoRanks.join(";")),
    m.foundPhotoId || "",
    m.outcome,
    m.timeToFindSec,
    m.difficultyRating ?? "",
    m.satisfactionRating ?? "",
    escapeCsv(m.comment),
    m.timeCueInFirstQuery ? "true" : "false",
    m.placeCueInFirstQuery ? "true" : "false",
    m.personCueInFirstQuery ? "true" : "false",
    escapeCsv(`when:${m.chipsByCueType.when};where:${m.chipsByCueType.where};who:${m.chipsByCueType.who};other:${m.chipsByCueType.other}`),
    m.firstQueryHasPreciseAnchor ? "true" : "false",
    m.metadataSynthetic ? "true" : "false",
  ]);

  const summary = computePerModeSummary(metrics);
  const summaryHeaders = [
    "mode",
    "sessions",
    "vague_sessions",
    "query_formation_rate",
    "avg_results_per_first_query",
    "median_results_per_first_query",
    "found_rate",
    "median_time_to_find_sec",
    "coach_trigger_rate",
    "coach_acceptance_rate",
    "coach_dismiss_rate",
    "coach_ignore_rate",
    "text_edit_rate",
    "skip_rate",
    "prompt_edit_rate",
    "fallback_composer_rate",
  ];

  const summaryRows = [summary.A, summary.B, summary.All].map((s) => [
    s.mode,
    s.sessions,
    s.vagueSessions,
    s.queryFormationRate,
    s.avgResultsPerFirstQuery,
    s.medianResultsPerFirstQuery,
    s.foundRate,
    s.medianTimeToFindSec,
    s.coachTriggerRate,
    s.coachAcceptanceRate,
    s.coachDismissRate,
    s.coachIgnoreRate,
    s.textEditRate,
    s.skipRate,
    s.promptEditRate,
    s.fallbackComposerRate,
  ]);

  return [
    "# PER-SESSION STUDY DATA (Excludes Practice & Voided Sessions)",
    headers.join(","),
    ...rows.map((r) => r.join(",")),
    "",
    "# PER-MODE SUMMARY",
    summaryHeaders.join(","),
    ...summaryRows.map((r) => r.join(",")),
  ].join("\n");
}
