"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Toast } from "@/components/ui/Toast";
import { useCoach } from "@/hooks/useCoach";
import { CoachPanel } from "@/components/coach/CoachPanel";
import { PromptReview } from "@/components/coach/PromptReview";
import { StudyBanner } from "@/components/study/StudyBanner";
import { logClientEvent } from "@/lib/clientLogger";

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = (searchParams.get("mode") as "A" | "B") || "A";
  const sessionId = searchParams.get("session");
  const participantId = searchParams.get("participant");
  const targetId = searchParams.get("target");

  const [query, setQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // S5 Prompt Review state
  const [showPromptReview, setShowPromptReview] = useState(false);
  const [reviewPrompt, setReviewPrompt] = useState("");

  // Mode B Coach state machine
  const coach = useCoach(query, mode);

  const handleInertClick = () => {
    setToastMessage("Not part of this prototype");
  };

  const forwardStudyParams = (baseUrl: string) => {
    const url = new URL(baseUrl, "http://localhost");
    if (sessionId) url.searchParams.set("session", sessionId);
    if (participantId) url.searchParams.set("participant", participantId);
    if (targetId) url.searchParams.set("target", targetId);
    return `${url.pathname}${url.search}`;
  };

  const handleSearchSubmit = (searchQuery: string) => {
    const q = searchQuery.trim();
    if (!q) return;

    logClientEvent("search_submitted", { query: q, mode }, { sessionId: sessionId || undefined, participantId: participantId || undefined, mode });
    const targetUrl = forwardStudyParams(`/results?q=${encodeURIComponent(q)}&mode=${mode}`);
    router.push(targetUrl);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearchSubmit(query);
    }
  };

  const handleBuildSearch = async () => {
    const refined = await coach.composeSearchPrompt();
    setReviewPrompt(refined);
    setShowPromptReview(true);
    logClientEvent("prompt_composed", { query, refinedPrompt: refined }, { sessionId: sessionId || undefined, participantId: participantId || undefined, mode });
  };

  const handleReviewSearch = (finalPrompt: string) => {
    if (finalPrompt !== reviewPrompt) {
      logClientEvent("prompt_edited", { originalPrompt: reviewPrompt, editedPrompt: finalPrompt }, { sessionId: sessionId || undefined, participantId: participantId || undefined, mode });
    }
    handleSearchSubmit(finalPrompt);
  };

  const handleAnswerQuestion = (questionId: string, cueType: any, value: string, source: "chip" | "typed" = "chip") => {
    logClientEvent(
      "chip_tapped",
      { questionId, cueType, value, source, query },
      { sessionId: sessionId || undefined, participantId: participantId || undefined, mode }
    );
    coach.answerQuestion(questionId, cueType, value, source);
  };

  const handleSkipQuestion = (questionId: string, cueType: any) => {
    logClientEvent(
      "chip_skipped",
      { questionId, cueType, query },
      { sessionId: sessionId || undefined, participantId: participantId || undefined, mode }
    );
    coach.skipQuestion(questionId, cueType);
  };

  const handleResetCoach = () => {
    logClientEvent(
      "coach_reset",
      { query },
      { sessionId: sessionId || undefined, participantId: participantId || undefined, mode }
    );
    coach.resetCoach();
  };

  const handleRemoveReviewAnswer = (questionId: string) => {
    coach.answerQuestion(questionId, "", "dont_remember");
    const active = coach.answers.filter((a) => a.questionId !== questionId && a.value !== "dont_remember");
    const newPrompt = [query, ...active.map((a) => a.value)].join(", ");
    setReviewPrompt(newPrompt);
  };

  const recentSearches = ["pool", "birthday cake", "road trip", "beach with family"];

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-white">
      {/* Optional Sticky Study Timer Banner */}
      <StudyBanner sessionId={sessionId} targetId={targetId} mode={mode} />

      {/* Top App Bar with Back Arrow */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-3 h-14 flex items-center border-b border-[#E3E5E8]/60">
        <Link
          href={forwardStudyParams(`/?mode=${mode}`)}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#F5F6F8] active:bg-[#EEF0F3] text-[#1F1F1F] transition-colors -ml-1"
          aria-label="Go back"
        >
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </Link>
        <div className="flex items-center justify-between flex-1 pr-1">
          <span className="ml-2 font-medium text-[17px] tracking-tight text-[#1F1F1F]">
            Search
          </span>
          {/* Mode Switcher Pill */}
          <Link
            href={forwardStudyParams(`/search?mode=${mode === "A" ? "B" : "A"}`)}
            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
              mode === "B"
                ? "bg-[#1F6FEB] text-white shadow-xs"
                : "bg-[#F1F3F4] text-[#5F6368] hover:text-[#1F1F1F]"
            }`}
          >
            {mode === "B" ? "Mode B (Coach)" : "Mode A (Plain)"}
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="px-4 pt-3 flex-1 flex flex-col">
        {/* S5 Prompt Review Screen */}
        {showPromptReview ? (
          <PromptReview
            initialPrompt={reviewPrompt}
            composer="groq"
            answers={coach.answers}
            onRemoveAnswer={handleRemoveReviewAnswer}
            onSearch={handleReviewSearch}
            onBack={() => setShowPromptReview(false)}
          />
        ) : (
          <>
            {/* Mode B Coach Panel (S4) */}
            {coach.isCoachVisible && (
              <CoachPanel
                questions={coach.questions}
                answers={coach.answers}
                candidateCount={coach.candidateCount}
                isComposing={coach.state === "COMPOSING"}
                onAnswer={handleAnswerQuestion}
                onSkip={handleSkipQuestion}
                onBuildSearch={handleBuildSearch}
                onSearchAnyway={() => handleSearchSubmit(query)}
                onReset={handleResetCoach}
              />
            )}

            {query.trim().length === 0 ? (
              /* S2 Empty State */
              <div className="flex flex-col gap-6 pt-2">
                {/* People Section */}
                <section>
                  <div className="flex items-center justify-between mb-3 px-0.5">
                    <h2 className="text-[15px] font-semibold tracking-tight text-[#1F1F1F]">People</h2>
                    <button
                      onClick={handleInertClick}
                      className="text-[13px] font-medium text-[#1F6FEB] hover:underline"
                    >
                      View all
                    </button>
                  </div>

                  <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none px-0.5">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <button
                        key={i}
                        onClick={handleInertClick}
                        className="flex flex-col items-center flex-shrink-0 group"
                      >
                        <div className="w-14 h-14 rounded-full bg-[#F5F6F8] border border-[#E3E5E8] flex items-center justify-center group-hover:border-[#1F6FEB]/40 transition-colors">
                          <span className="material-symbols-outlined text-[28px] text-[#9AA0A6]">
                            person
                          </span>
                        </div>
                      </button>
                    ))}
                    <button
                      onClick={handleInertClick}
                      className="w-14 h-14 rounded-full bg-[#F5F6F8] border border-[#E3E5E8] flex items-center justify-center flex-shrink-0 hover:bg-[#EEF0F3] transition-colors"
                    >
                      <span className="text-[#5F6368] font-bold text-lg">…</span>
                    </button>
                  </div>
                </section>

                {/* Places & Things Rows */}
                <section className="space-y-1">
                  <button
                    onClick={handleInertClick}
                    className="w-full flex items-center justify-between py-2 px-1 rounded-xl hover:bg-[#F5F6F8] transition-colors text-left"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-full bg-[#F5F6F8] flex items-center justify-center border border-[#E3E5E8]">
                        <span className="material-symbols-outlined text-[20px] text-[#5F6368]">
                          location_on
                        </span>
                      </div>
                      <span className="text-[15px] font-medium text-[#1F1F1F]">Places</span>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-[#5F6368]/60">
                      chevron_right
                    </span>
                  </button>

                  <button
                    onClick={handleInertClick}
                    className="w-full flex items-center justify-between py-2 px-1 rounded-xl hover:bg-[#F5F6F8] transition-colors text-left"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-full bg-[#F5F6F8] flex items-center justify-center border border-[#E3E5E8]">
                        <span className="material-symbols-outlined text-[20px] text-[#5F6368]">
                          category
                        </span>
                      </div>
                      <span className="text-[15px] font-medium text-[#1F1F1F]">Things</span>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-[#5F6368]/60">
                      chevron_right
                    </span>
                  </button>
                </section>

                {/* Divider */}
                <div className="h-[1px] bg-[#E3E5E8]" />

                {/* Recent Searches */}
                <section>
                  <h2 className="text-[13px] font-semibold text-[#5F6368] uppercase tracking-wider mb-2 px-1">
                    Recent searches
                  </h2>
                  <ul className="space-y-1">
                    {recentSearches.map((term) => (
                      <li
                        key={term}
                        className="flex items-center justify-between py-2 px-1 rounded-xl hover:bg-[#F5F6F8] cursor-pointer group"
                        onClick={() => handleSearchSubmit(term)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-[20px] text-[#5F6368]">
                            history
                          </span>
                          <span className="text-[15px] text-[#1F1F1F] font-normal">{term}</span>
                        </div>
                        <span className="material-symbols-outlined text-[18px] text-[#5F6368] opacity-0 group-hover:opacity-100 transition-opacity">
                          north_west
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            ) : !coach.isCoachVisible ? (
              /* S3 Typing State */
              <div className="w-full flex flex-col pt-1">
                <div
                  onClick={() => handleSearchSubmit(query)}
                  className="w-full min-h-[52px] px-2 py-3 flex items-center gap-3.5 rounded-xl hover:bg-[#F5F6F8] active:bg-[#EEF0F3] transition-colors cursor-pointer group"
                  role="button"
                  tabIndex={0}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-[#5F6368] flex-shrink-0 group-hover:text-[#1F1F1F]">
                    <span className="material-symbols-outlined text-[22px]">search</span>
                  </div>
                  <div className="flex items-center min-w-0 flex-1">
                    <p className="text-[15px] text-[#1F1F1F] truncate">
                      <span>Search for </span>
                      <span className="font-semibold text-[#1F6FEB]">“{query}”</span>
                    </p>
                  </div>
                  <div className="w-8 h-8 flex items-center justify-center text-[#5F6368] flex-shrink-0">
                    <span className="material-symbols-outlined text-[20px]">north_west</span>
                  </div>
                </div>

                <div className="w-full h-[1px] bg-[#E3E5E8] mt-1 mb-6" />

                <div className="w-full py-12 flex flex-col items-center justify-center text-center opacity-50 select-none pointer-events-none">
                  <span className="material-symbols-outlined text-[44px] text-[#5F6368] mb-2">
                    photo_library
                  </span>
                  <p className="text-xs text-[#5F6368]">Searching your 100 photos</p>
                </div>
              </div>
            ) : null}
          </>
        )}
      </main>

      {/* Bottom Input Pill Bar */}
      {!showPromptReview && (
        <div className="sticky bottom-0 bg-white border-t border-[#E3E5E8] p-3 shadow-md z-40">
          <div className="w-full h-12 px-4 bg-[#EEF0F3] rounded-full flex items-center justify-between focus-within:ring-2 focus-within:ring-[#1F6FEB] transition-all">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <span className="material-symbols-outlined text-[22px] text-[#5F6368] flex-shrink-0">
                search
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search photos, people, or ask..."
                autoFocus
                className="flex-1 bg-transparent border-none outline-none text-[15px] text-[#1F1F1F] placeholder-[#5F6368]"
              />
            </div>

            {query.trim().length > 0 ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setQuery("")}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#5F6368] hover:text-[#1F1F1F] transition-colors"
                  aria-label="Clear search"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
                <button
                  onClick={() => handleSearchSubmit(query)}
                  className="w-8 h-8 rounded-full bg-[#1F6FEB] text-white flex items-center justify-center hover:bg-[#1A5DC8] transition-colors shadow-sm"
                  aria-label="Execute search"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleInertClick}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#5F6368] hover:text-[#1F1F1F] transition-colors"
                aria-label="Voice search"
              >
                <span className="material-symbols-outlined text-[20px]">mic</span>
              </button>
            )}
          </div>
        </div>
      )}

      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-4 text-center text-sm text-[#5F6368]">Loading search...</div>}>
      <SearchContent />
    </Suspense>
  );
}
