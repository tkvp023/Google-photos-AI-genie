// src/hooks/useCoach.ts — State Machine Hook for Pre-Search Coach
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { config } from "@/lib/config";
import { Answer, Question } from "@/types";

export type CoachState =
  | "IDLE"
  | "DEBOUNCING"
  | "ANALYZING"
  | "COACH_VISIBLE"
  | "COMPOSING"
  | "PROMPT_REVIEW";

export function useCoach(query: string, mode: "A" | "B") {
  const [state, setState] = useState<CoachState>("IDLE");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [candidateCount, setCandidateCount] = useState<number>(0);
  const [bucket, setBucket] = useState<string>("some");
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [composedPrompt, setComposedPrompt] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnalyzedQueryRef = useRef<string>("");

  // Clear or start debounce when query changes
  useEffect(() => {
    if (mode !== "B") {
      setState("IDLE");
      setQuestions([]);
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 3 || isDismissed) {
      setState("IDLE");
      setQuestions([]);
      return;
    }

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
          body: JSON.stringify({ query: trimmed, mode: "B", dismissed: isDismissed }),
        });

        if (!res.ok) throw new Error("Coach analyze failed");
        const data = await res.json();

        setCandidateCount(data.count || 0);
        setBucket(data.bucket || "some");

        if (data.triggered && data.questions && data.questions.length > 0) {
          setQuestions(data.questions);
          setAnswers([]);
          setState("COACH_VISIBLE");
        } else {
          setState("IDLE");
          setQuestions([]);
        }
      } catch (err) {
        console.warn("[useCoach] Analyze error:", err);
        setState("IDLE");
        setQuestions([]);
      }
    }, config.COACH_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, mode, isDismissed]);

  // Answer a question via chip tap or text input
  const answerQuestion = useCallback(
    async (questionId: string, cueType: any, value: string, source: "chip" | "typed" = "chip") => {
      const existing = answers.find((a) => a.questionId === questionId);
      const isDeselect = existing && existing.value === value && source === "chip";

      const newAnswers = isDeselect
        ? answers.filter((a) => a.questionId !== questionId)
        : [...answers.filter((a) => a.questionId !== questionId), { questionId, cueType, value, source }];

      setAnswers(newAnswers);

      try {
        const res = await fetch("/api/coach/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: query.trim(), answers: newAnswers }),
        });

        if (!res.ok) throw new Error("Coach answer failed");
        const data = await res.json();

        setCandidateCount(data.candidateCount);
        setBucket(data.bucket);

        if (data.isStopCondition || (data.questions && data.questions.length === 0)) {
          // Reached stop threshold or answered all questions
          setQuestions([]);
        } else if (data.questions) {
          setQuestions(data.questions);
        }
      } catch (err) {
        console.warn("[useCoach] Answer error:", err);
      }
    },
    [answers, query]
  );

  // Skip a question
  const skipQuestion = useCallback((questionId: string, cueType: any) => {
    answerQuestion(questionId, cueType, "dont_remember", "chip");
  }, [answerQuestion]);

  // Dismiss coach panel for current query
  const dismissCoach = useCallback(() => {
    setIsDismissed(true);
    setState("IDLE");
    setQuestions([]);
  }, []);

  // Reset coach answers
  const resetCoach = useCallback(() => {
    setAnswers([]);
    lastAnalyzedQueryRef.current = "";
    // Re-triggers analyze on next cycle
  }, []);

  // Compose refined prompt
  const composeSearchPrompt = useCallback(async (): Promise<string> => {
    setState("COMPOSING");
    try {
      const res = await fetch("/api/coach/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), answers }),
      });

      if (!res.ok) throw new Error("Compose failed");
      const data = await res.json();
      const finalPrompt = data.prompt || query;
      setComposedPrompt(finalPrompt);
      setState("PROMPT_REVIEW");
      return finalPrompt;
    } catch {
      const fallback = [query, ...answers.map((a) => a.value).filter((v) => v !== "dont_remember")].join(", ");
      setComposedPrompt(fallback);
      setState("PROMPT_REVIEW");
      return fallback;
    }
  }, [query, answers]);

  return {
    state,
    questions,
    answers,
    candidateCount,
    bucket,
    isCoachVisible: state === "COACH_VISIBLE" && questions.length > 0,
    composedPrompt,
    answerQuestion,
    skipQuestion,
    dismissCoach,
    resetCoach,
    composeSearchPrompt,
  };
}
