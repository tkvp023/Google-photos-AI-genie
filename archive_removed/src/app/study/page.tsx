// src/app/study/page.tsx — Study Mode Screen (S10 Target Reveal & S11 Task End)
"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { logClientEvent } from "@/lib/clientLogger";
import { StudyTarget } from "@/types";
import { config } from "@/lib/config";

function StudyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const step = searchParams.get("step") || "reveal"; // "reveal" | "end"
  const sessionId = searchParams.get("session") || "session_test";
  const participantId = searchParams.get("participant") || "P01";
  const mode = (searchParams.get("mode") as "A" | "B") || "A";
  const targetId = searchParams.get("target") || "T01";
  const outcome = searchParams.get("outcome") || "found"; // "found" | "timeout" | "gave_up"

  const isPractice = searchParams.get("practice") === "true";

  const [target, setTarget] = useState<StudyTarget | null>(null);
  const [countdown, setCountdown] = useState<number>(5);

  // Survey responses
  const [difficultyRating, setDifficultyRating] = useState<number>(3);
  const [satisfactionRating, setSatisfactionRating] = useState<number>(4);
  const [comment, setComment] = useState<string>("");
  const [chipMatchRating, setChipMatchRating] = useState<number>(4);
  const [chipHelpfulCuetype, setChipHelpfulCuetype] = useState<string>("None");
  const [shownCueTypes, setShownCueTypes] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const hintLoggedRef = React.useRef(false);

  const CUE_LABELS: Record<string, string> = {
    who: "Who was with you",
    where: "Where it was",
    when: "When it was",
    what: "What was happening",
    look: "What it looked like",
    occasion: "What was the occasion",
    mood: "What was the vibe",
    None: "None of them",
  };

  // Load shown cue types for Mode B
  useEffect(() => {
    if (mode === "B") {
      try {
        const storageKey = sessionId ? `study_shown_cuetypes_${sessionId}` : "study_shown_cuetypes";
        const raw = sessionStorage.getItem(storageKey);
        if (raw) {
          const parsed: string[] = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setShownCueTypes(parsed);
            setChipHelpfulCuetype(parsed[0]);
            return;
          }
        }
      } catch {}
      setShownCueTypes(["who", "where", "what", "when", "occasion", "look"]);
      setChipHelpfulCuetype("None");
    }
  }, [mode, sessionId]);

  // Log hint_shown when target hint is available in reveal step
  useEffect(() => {
    if (step === "reveal" && target?.hint && config.TARGET_HINT && !hintLoggedRef.current) {
      hintLoggedRef.current = true;
      logClientEvent(
        "hint_shown",
        { targetId: target.id, hint: target.hint },
        { sessionId, participantId, mode }
      );
    }
  }, [step, target, sessionId, participantId, mode]);

  // Load target photo info
  useEffect(() => {
    fetch("/api/targets")
      .then((res) => {
        if (!res.ok) return fetch("/data/targets.json");
        return res;
      })
      .then((res) => res.json())
      .then((targets: StudyTarget[]) => {
        const found = targets.find((t) => t.id === targetId) || targets[0];
        setTarget(found || null);
      })
      .catch(() => {
        setTarget({
          id: targetId,
          file: "pool_06.jpg",
          theme: "pool",
          difficulty: "medium",
          distinctiveFeature: "children in swimming pool with sunglasses",
        });
      });
  }, [targetId]);

  // S10 Countdown (5s)
  useEffect(() => {
    if (step !== "reveal") return;

    const hintShown = Boolean(config.TARGET_HINT && target?.hint);
    logClientEvent(
      "target_shown",
      { targetId, is_practice: isPractice, hint_shown: hintShown },
      { sessionId, participantId, mode }
    );

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          logClientEvent(
            "target_hidden",
            { targetId, is_practice: isPractice },
            { sessionId, participantId, mode }
          );
          // Initialize timer start
          sessionStorage.setItem(`study_timer_start_${sessionId}`, String(Date.now()));
          sessionStorage.setItem("study_session_id", sessionId);
          sessionStorage.setItem("study_participant_id", participantId);
          sessionStorage.setItem("study_mode", mode);
          if (isPractice) {
            sessionStorage.setItem(`study_is_practice_${sessionId}`, "true");
          }

          const practiceParam = isPractice ? "&practice=true" : "";
          const debugParam = searchParams.get("debug") === "1" ? "&debug=1" : "";
          router.push(
            `/search?session=${encodeURIComponent(sessionId)}&participant=${encodeURIComponent(
              participantId
            )}&target=${encodeURIComponent(targetId)}&mode=${mode}${practiceParam}${debugParam}`
          );
          return 0;

        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [step, sessionId, participantId, mode, targetId, isPractice, router]);

  // Handle survey submit
  const handleSurveySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const surveyPayload: Record<string, unknown> = {
      targetId,
      difficultyRating,
      satisfactionRating,
      comment,
      outcome,
      is_practice: isPractice,
    };

    if (mode === "B") {
      surveyPayload.chip_match_rating = chipMatchRating;
      surveyPayload.chip_helpful_cuetype = chipHelpfulCuetype;
    }

    logClientEvent(
      "survey_answered",
      surveyPayload,
      { sessionId, participantId, mode }
    );

    logClientEvent(
      "task_end",
      { outcome, targetId, is_practice: isPractice },
      { sessionId, participantId, mode }
    );

    router.push("/moderator");
  };

  // Render S10 Target Reveal
  if (step === "reveal") {
    const photoSrc = target?.file ? `/library/${target.file}` : "/library/pool_06.jpg";

    return (
      <div className="relative w-full min-h-screen bg-black text-white flex flex-col justify-between overflow-hidden select-none">
        {/* Background Target Image */}
        <div className="absolute inset-0 w-full h-full z-0">
          <Image
            src={photoSrc}
            alt="Target Photo"
            fill
            className="object-cover"
            priority
            unoptimized
          />
        </div>

        {/* Top Scrim Overlay */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/85 via-black/40 to-transparent z-10 pointer-events-none" />

        {/* Top Header Bar */}
        <header className="relative z-20 flex items-center justify-between px-4 pt-4">
          <div className="bg-black/50 backdrop-blur-md px-3.5 py-1.5 rounded-full flex items-center gap-2 border border-white/10 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#FF9F5A] animate-ping" />
            <span className="font-mono text-xs font-bold tracking-wider uppercase">
              Target • {target?.id || targetId}
            </span>
          </div>

          {/* Countdown Circular Badge */}
          <div className="w-12 h-12 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 shadow-lg">
            <span className="font-mono text-base font-bold text-[#FF9F5A]">{countdown}s</span>
          </div>
        </header>

        {/* Bottom Scrim & Hint Card */}
        <div className="relative z-20 px-4 pb-8 pt-12 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 shadow-xl space-y-2">
            <div className="flex items-center gap-2">
              <span
                className="material-symbols-outlined text-[#FF9F5A] text-[20px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                auto_awesome
              </span>
              <h2 className="text-sm font-semibold text-white tracking-tight">
                Memorize Visual Cues
              </h2>
            </div>
            <p className="text-xs text-white/80 leading-relaxed">
              {target?.distinctiveFeature || "Notice the people, setting, clothing, and actions in this photo."}
            </p>

            {config.TARGET_HINT && target?.hint && (
              <div className="bg-[#241c17]/95 border border-[#f59e6c]/50 rounded-xl px-3 py-2 text-xs text-[#f59e6c] font-medium mt-2 flex items-center gap-1.5 overflow-hidden">
                <span className="font-semibold flex-shrink-0">Hint:</span>
                <span className="truncate whitespace-nowrap">{target.hint}</span>
              </div>
            )}

            {/* Countdown Progress Strip */}
            <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-[#FF9F5A] transition-all duration-1000 ease-linear"
                style={{ width: `${(countdown / 5) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render S11 Task End (Survey)
  const isFound = outcome === "found";
  const isTimeout = outcome === "timeout";

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1F1F1F] flex flex-col justify-between p-4">
      <div className="max-w-md mx-auto w-full pt-4 space-y-6">
        {/* Outcome Header Badge */}
        <div className="flex flex-col items-center text-center space-y-2 pt-4">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center shadow-md ${
              isFound
                ? "bg-[#E6F4EA] text-[#137333]"
                : isTimeout
                ? "bg-[#FEF7E0] text-[#B06000]"
                : "bg-[#FCE8E6] text-[#C5221F]"
            }`}
          >
            <span
              className="material-symbols-outlined text-[36px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {isFound ? "check_circle" : isTimeout ? "hourglass_disabled" : "flag"}
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#1F1F1F]">
            {isFound ? "Target Photo Found!" : isTimeout ? "Time Limit Reached" : "Task Completed"}
          </h1>
          <p className="text-xs text-[#5F6368]">
            Participant {participantId} • Mode {mode} • Target {targetId}
          </p>
        </div>

        {/* Survey Form */}
        <form onSubmit={handleSurveySubmit} className="bg-white rounded-2xl p-5 border border-[#E3E5E8] shadow-sm space-y-5">
          {/* Question 1: Difficulty */}
          <div>
            <label className="block text-xs font-semibold text-[#1F1F1F] mb-2">
              1. How difficult was it to find the photo?
            </label>
            <div className="flex justify-between items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setDifficultyRating(val)}
                  className={`flex-1 h-10 rounded-xl text-sm font-semibold transition-all ${
                    difficultyRating === val
                      ? "bg-[#1F6FEB] text-white shadow-sm"
                      : "bg-[#F1F3F4] text-[#5F6368] hover:bg-[#E8EAED]"
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-[#5F6368] px-1 mt-1">
              <span>Very Easy (1)</span>
              <span>Very Difficult (5)</span>
            </div>
          </div>

          {/* Question 2: Satisfaction */}
          <div>
            <label className="block text-xs font-semibold text-[#1F1F1F] mb-2">
              2. How satisfied were you with the search experience?
            </label>
            <div className="flex justify-between items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setSatisfactionRating(val)}
                  className={`flex-1 h-10 rounded-xl text-sm font-semibold transition-all ${
                    satisfactionRating === val
                      ? "bg-[#1F6FEB] text-white shadow-sm"
                      : "bg-[#F1F3F4] text-[#5F6368] hover:bg-[#E8EAED]"
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-[#5F6368] px-1 mt-1">
              <span>Dissatisfied (1)</span>
              <span>Very Satisfied (5)</span>
            </div>
          </div>

          {/* Mode B Only: Post-Task Chip Questions */}
          {mode === "B" && (
            <div className="pt-3 border-t border-[#E3E5E8] space-y-4">
              {/* Question (a): Chip Match Rating */}
              <div>
                <label className="block text-xs font-semibold text-[#1F1F1F] mb-2">
                  3. Did the questions match what you remembered about the photo?
                </label>
                <div className="flex justify-between items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setChipMatchRating(val)}
                      className={`flex-1 h-10 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                        chipMatchRating === val
                          ? "bg-[#f59e6c] text-[#281204] shadow-sm font-bold"
                          : "bg-[#F1F3F4] text-[#5F6368] hover:bg-[#E8EAED]"
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-[#5F6368] px-1 mt-1">
                  <span>Not at all (1)</span>
                  <span>Matched very well (5)</span>
                </div>
              </div>

              {/* Question (b): Most Helpful Question */}
              <div>
                <label className="block text-xs font-semibold text-[#1F1F1F] mb-2">
                  4. Which question helped most?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Array.from(new Set([...shownCueTypes, "None"])).map((cue) => (
                    <button
                      key={cue}
                      type="button"
                      onClick={() => setChipHelpfulCuetype(cue)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all border flex items-center justify-between cursor-pointer ${
                        chipHelpfulCuetype === cue
                          ? "bg-[#fff2e8] border-[#f59e6c] text-[#93370d] font-semibold shadow-xs"
                          : "bg-[#FAFAFA] border-[#E3E5E8] text-[#3c4043] hover:bg-[#F1F3F4]"
                      }`}
                    >
                      <span>{CUE_LABELS[cue] || cue}</span>
                      {chipHelpfulCuetype === cue && (
                        <span className="material-symbols-outlined text-[16px] text-[#f59e6c]">
                          check
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Comment */}
          <div>
            <label className="block text-xs font-semibold text-[#1F1F1F] mb-1.5">
              Any comments or thoughts? (Optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="What helped or slowed you down..."
              className="w-full text-xs p-3 rounded-xl border border-[#DADCE0] bg-[#FAFAFA] text-[#1F1F1F] outline-none focus:border-[#1F6FEB] resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 bg-[#1F6FEB] hover:bg-[#1A5DC8] text-white font-semibold rounded-full text-sm shadow-sm transition-colors cursor-pointer"
          >
            {isSubmitting ? "Submitting..." : "Submit & Finish Task"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function StudyPage() {
  return (
    <Suspense fallback={<div className="p-4 text-center text-sm text-[#5F6368]">Loading study...</div>}>
      <StudyContent />
    </Suspense>
  );
}
