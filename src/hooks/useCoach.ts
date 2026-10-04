// src/hooks/useCoach.ts — In-Memory Zero-Friction Coach State Machine Hook
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { config } from "@/lib/config";
import { Answer, CueType, PhotoItem, Question, QuestionOption } from "@/types";
import {
  getChipPhrase,
  isPhraseSelected,
  removeChipPhrase,
  replaceOrAppendChipPhrase,
} from "@/lib/phraseTemplates";

export type CoachState =
  | "IDLE"
  | "DEBOUNCING"
  | "ANALYZING"
  | "COACH_VISIBLE"
  | "NO_MATCH"
  | "COMPOSING"
  | "PROMPT_REVIEW";

export interface PlannerInfo {
  source: "gemini" | "deterministic";
  latencyMs: number;
  fallbackReason: string;
  sameFieldsAsDeterministic: boolean;
}

export interface ChipAction {
  action: "tapped" | "removed";
  phrase: string;
  questionId: string;
  cueType: string;
  timestamp: number;
}

export function useCoach(query: string, optionsOrMode?: { genieOff?: boolean } | "A" | "B") {
  const isGenieOff =
    typeof optionsOrMode === "object"
      ? Boolean(optionsOrMode?.genieOff)
      : optionsOrMode === "A";

  const [state, setState] = useState<CoachState>("IDLE");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [candidateCount, setCandidateCount] = useState<number>(0);
  const [bucket, setBucket] = useState<string>("some");
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [typedTextAtTrigger, setTypedTextAtTrigger] = useState<string>("");
  const [resultsForFirstTyped, setResultsForFirstTyped] = useState<number>(0);
  const [coachShownQuestions, setCoachShownQuestions] = useState<string[]>([]);
  const [firstChipTapTime, setFirstChipTapTime] = useState<number | null>(null);
  const [triggerTime, setTriggerTime] = useState<number | null>(null);

  // Tokens & No-match state
  const [tokens, setTokens] = useState<string[]>([]);
  const [recognisedTokens, setRecognisedTokens] = useState<string[]>([]);
  const [unrecognisedTokens, setUnrecognisedTokens] = useState<string[]>([]);
  const [noMatchState, setNoMatchState] = useState<"zero" | "partial" | "none">("none");
  const [unmatchedTermsList, setUnmatchedTermsList] = useState<string[]>([]);

  // Debug & History tracking
  const [chipHistory, setChipHistory] = useState<ChipAction[]>([]);
  const [triggerBlockedReason, setTriggerBlockedReason] = useState<string>("");

  // In-memory candidate pool for 0ms client-side filtering
  const initialCandidatesRef = useRef<PhotoItem[]>([]);
  const allKnownQuestionsRef = useRef<Map<string, Question>>(new Map());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnalyzedQueryRef = useRef<string>("");
  const dismissedQueryRef = useRef<string>("");

  // Re-sync or trigger coach when query changes
  useEffect(() => {
    try {
      // 1. genie_enabled check: if hidden ?genie=off or GENIE_ENABLED is false, no strip, no calls
      if (isGenieOff || !config.GENIE_ENABLED) {
        setState("IDLE");
        setQuestions([]);
        return;
      }

      const trimmed = query.trim();

      // If input is cleared, hide the coach and reset all state
      if (trimmed.length === 0) {
        setIsDismissed(false);
        dismissedQueryRef.current = "";
        setTypedTextAtTrigger("");
        setResultsForFirstTyped(0);
        setCoachShownQuestions([]);
        setFirstChipTapTime(null);
        setTriggerTime(null);
        setTokens([]);
        setRecognisedTokens([]);
        setUnrecognisedTokens([]);
        setNoMatchState("none");
        setUnmatchedTermsList([]);
        setTriggerBlockedReason("");
        setChipHistory([]);
        initialCandidatesRef.current = [];
        allKnownQuestionsRef.current.clear();
        lastAnalyzedQueryRef.current = "";
        setState("IDLE");
        setQuestions([]);
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        return;
      }

      // Check Condition 4 (already_shown / dismissed): reopen only if text changes by 2+ words
      if (isDismissed && dismissedQueryRef.current) {
        const wordsCurrent = trimmed.split(/\s+/).filter(Boolean);
        const wordsDismissed = dismissedQueryRef.current.split(/\s+/).filter(Boolean);
        const wordDiff = Math.abs(wordsCurrent.length - wordsDismissed.length);
        const setDismissed = new Set(wordsDismissed.map((w) => w.toLowerCase()));
        const newWordsCount = wordsCurrent.filter((w) => !setDismissed.has(w.toLowerCase())).length;

        if (wordDiff >= 2 || newWordsCount >= 2) {
          setIsDismissed(false);
          dismissedQueryRef.current = "";
        } else {
          // Still dismissed for this query
          return;
        }
      }

      if (trimmed.length < 3) {
        setState("IDLE");
        setNoMatchState("none");
        setUnmatchedTermsList([]);
        setQuestions([]);
        return;
      }

      // If coach has already triggered for this query session and strip is showing,
      // keep the questions fixed while user interacts with chips (do not re-rank).
      // If the query completely diverged from the trigger query, reset so a new query can trigger.
      if (typedTextAtTrigger && state === "COACH_VISIBLE") {
        const wordsTrigger = typedTextAtTrigger.toLowerCase().split(/\s+/).filter(Boolean);
        const wordsCurrent = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
        const hasBaseWord = wordsTrigger.some((w) => wordsCurrent.includes(w));
        if (hasBaseWord) {
          // Still in the same search session; keep questions fixed
          return;
        }
        // Base words completely changed; reset session so new query can trigger
        setTypedTextAtTrigger("");
      }

      // 3. still_typing (500 ms debounce)
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      setState("DEBOUNCING");

      debounceTimerRef.current = setTimeout(async () => {
        if (trimmed === lastAnalyzedQueryRef.current) return;
        lastAnalyzedQueryRef.current = trimmed;
        setState("ANALYZING");

        try {
          const res = await fetch("/api/coach/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: trimmed, dismissed: isDismissed, genieOff: isGenieOff }),
          });

          // If the Genie API errors, hide the strip silently and let search work
          if (!res.ok) {
            setState("IDLE");
            setQuestions([]);
            return;
          }

          const data = await res.json();

          setCandidateCount(data.count || 0);
          setTriggerBlockedReason(data.trigger_blocked_reason ?? "");
          setTokens(data.tokens || []);
          setRecognisedTokens(data.recognised_tokens || []);
          setUnrecognisedTokens(data.unrecognised_tokens || []);

          const nmState = (data.no_match_state as "zero" | "partial" | "none") || "none";
          setNoMatchState(nmState);
          setUnmatchedTermsList((data.unmatched_terms as string[]) || []);

          if (nmState === "zero") {
            // Zero results — show no-match caption in strip, no chips
            setState("NO_MATCH");
            setQuestions([]);
          } else if (data.triggered && data.questions && data.questions.length > 0) {
            setTypedTextAtTrigger(trimmed);
            setResultsForFirstTyped(data.count || 0);
            const now = Date.now();
            setTriggerTime(now);

            initialCandidatesRef.current = data.candidates || [];
            allKnownQuestionsRef.current.clear();
            const qIds: string[] = [];
            for (const q of data.questions as Question[]) {
              allKnownQuestionsRef.current.set(q.id, q);
              qIds.push(q.id);
            }
            setCoachShownQuestions(qIds);
            setQuestions(data.questions);
            setState("COACH_VISIBLE");
          } else {
            setState("IDLE");
            setQuestions([]);
          }
        } catch (err) {
          // Hide strip silently on error
          console.warn("[useCoach] API error — hiding strip:", err);
          setState("IDLE");
          setQuestions([]);
        }
      }, config.COACH_DEBOUNCE_MS);
    } catch (err) {
      console.warn("[useCoach] Unhandled error in hook effect:", err);
      setState("IDLE");
      setQuestions([]);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, isGenieOff, isDismissed, typedTextAtTrigger]);

  // Handle zero-friction chip tap
  const handleChipTap = useCallback(
    (question: Question, option: QuestionOption, isSelected: boolean): string => {
      try {
        const now = Date.now();
        if (!firstChipTapTime) {
          setFirstChipTapTime(now);
        }

        const phrase = getChipPhrase(question.cueType, option.value);
        let newText = query;

        if (isSelected) {
          // Tapping selected chip: remove exactly that phrase and clean up separators
          newText = removeChipPhrase(query, phrase);
          setChipHistory((prev) => [
            ...prev,
            { action: "removed", phrase, questionId: question.id, cueType: question.cueType, timestamp: now },
          ]);
        } else {
          // Tapping unselected chip: replace any existing phrase from this question, or append to end
          const existingQuestionPhrases = question.options.map((opt) =>
            getChipPhrase(question.cueType, opt.value)
          );
          newText = replaceOrAppendChipPhrase(query, phrase, existingQuestionPhrases);
          setChipHistory((prev) => [
            ...prev,
            { action: "tapped", phrase, questionId: question.id, cueType: question.cueType, timestamp: now },
          ]);
        }

        return newText;
      } catch (err) {
        console.warn("[useCoach] handleChipTap error:", err);
        return query;
      }
    },
    [query, firstChipTapTime, typedTextAtTrigger]
  );

  // Dismiss coach strip: hide strip and mark query as dismissed
  const dismissCoach = useCallback(() => {
    setIsDismissed(true);
    dismissedQueryRef.current = query.trim();
    setState("IDLE");
    setQuestions([]);
  }, [query]);

  // Reset coach answers
  const resetCoach = useCallback(() => {
    setQuestions([]);
    lastAnalyzedQueryRef.current = "";
    initialCandidatesRef.current = [];
    allKnownQuestionsRef.current.clear();
    setChipHistory([]);
  }, []);

  return {
    state,
    questions,
    candidateCount,
    bucket,
    triggerBlockedReason,
    isCoachVisible: state === "COACH_VISIBLE" && questions.length > 0,
    isNoMatch: state === "NO_MATCH",
    noMatchState,
    unmatchedTermsList,
    tokens,
    recognisedTokens,
    unrecognisedTokens,
    chipHistory,
    typedTextAtTrigger,
    resultsForFirstTyped,
    coachShownQuestions,
    coachDismissed: isDismissed,
    firstChipTapTime,
    triggerTime,
    handleChipTap,
    dismissCoach,
    resetCoach,
  };
}
