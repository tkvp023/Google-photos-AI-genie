"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { CoachStrip } from "@/components/coach/CoachStrip";
import { Toast } from "@/components/ui/Toast";
import { PhotoItem, Question, QuestionOption } from "@/types";
import { getChipPhrase, removeChipPhrase, replaceOrAppendChipPhrase } from "@/lib/phraseTemplates";
import { TesterDisclaimer } from "@/components/ui/TesterDisclaimer";
import { LibraryInfoModal } from "@/components/ui/LibraryInfoModal";

interface ScoredPhotoItem extends PhotoItem {
  score: number;
  tier?: 1 | 2 | 3;
  matchedFields: string[];
  matches?: Array<{ field: string; token: string; termType?: string; weight: number }>;
  explanation?: string;
}

function getAiExplanation(query: string, count: number, results: ScoredPhotoItem[]): string {
  if (count === 0) {
    return `We couldn't find any photos matching "${query}". Try another term or explore suggestions.`;
  }
  // Dynamic contextual summary generated strictly from real query and result themes/activities
  const themes = Array.from(new Set(results.slice(0, 5).map((r) => r.theme))).filter(Boolean);
  const activities = Array.from(
    new Set(
      results.slice(0, 5).flatMap((r) => {
        const act = r.tag?.activity || "";
        return act ? [act.split(",")[0].trim()] : [];
      })
    )
  )
    .filter(Boolean)
    .slice(0, 2);
  const themeText = themes.length > 0 ? themes.join(" and ") : "your photos";
  const activityText = activities.length > 0 ? ` featuring ${activities.join(" and ")}` : "";
  return `Found ${count} matching photo${count === 1 ? "" : "s"} for "${query}" across ${themeText}${activityText}.`;
}

function ResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const isDebug = searchParams.get("debug") === "1";
  const isGenieOff = searchParams.get("genie") === "off";

  const [results, setResults] = useState<ScoredPhotoItem[]>([]);
  const [count, setCount] = useState<number>(0);
  const [countStrong, setCountStrong] = useState<number>(0);
  const [countTotal, setCountTotal] = useState<number>(0);
  const [ambiguousCount, setAmbiguousCount] = useState<number>(0);
  const [topScore, setTopScore] = useState<number>(0);
  const [unmatchedTerms, setUnmatchedTerms] = useState<string[]>([]);
  const [showRelated, setShowRelated] = useState<boolean>(false);
  const [coachTriggerStatus, setCoachTriggerStatus] = useState<{ triggered: boolean; reason: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedbackRating, setFeedbackRating] = useState<"up" | "down" | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Coach help state on results page
  const [isCoachHelpOpen, setIsCoachHelpOpen] = useState<boolean>(false);
  const [coachQuestions, setCoachQuestions] = useState<Question[]>([]);
  const [coachLoading, setCoachLoading] = useState<boolean>(false);
  const [isLibraryInfoOpen, setIsLibraryInfoOpen] = useState(false);

  useEffect(() => {
    if (!q) {
      setResults([]);
      setCount(0);
      setUnmatchedTerms([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.results) {
          setResults(data.results);
          setCount(data.count || data.results.length);
          setCountStrong(data.count_strong ?? 0);
          setCountTotal(data.count_total ?? data.count ?? data.results.length);
          setAmbiguousCount(data.ambiguous_count ?? 0);
          setTopScore(data.top_score ?? 0);
          setUnmatchedTerms(data.unmatched_terms || []);
        } else {
          setResults([]);
          setCount(0);
          setUnmatchedTerms([]);
        }
      })
      .catch((err) => {
        console.error("Search fetch error:", err);
        setResults([]);
        setCount(0);
        setUnmatchedTerms([]);
      })
      .finally(() => setLoading(false));

    if (isDebug && q && !isGenieOff) {
      fetch("/api/coach/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, explicit: false, genieOff: isGenieOff }),
      })
        .then((res) => res.json())
        .then((data) => {
          setCoachTriggerStatus({
            triggered: Boolean(data.triggered),
            reason: data.trigger_blocked_reason || (data.triggered ? "ambiguity and match thresholds satisfied" : "not triggered"),
          });
        })
        .catch(() => {});
    }
  }, [q, isDebug, isGenieOff]);

  const fetchCoachQuestions = async (targetQuery: string) => {
    if (!targetQuery || isGenieOff) return;
    setCoachLoading(true);
    try {
      const res = await fetch("/api/coach/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: targetQuery, explicit: true, genieOff: isGenieOff }),
      });
      const data = await res.json();
      if (data.questions && data.questions.length > 0) {
        setCoachQuestions(data.questions);
      } else {
        setCoachQuestions([]);
      }
    } catch (err) {
      console.error("Failed to fetch coach questions:", err);
      setCoachQuestions([]);
    } finally {
      setCoachLoading(false);
    }
  };

  const handleToggleCoachHelp = () => {
    if (isGenieOff) return;
    const nextState = !isCoachHelpOpen;
    setIsCoachHelpOpen(nextState);
    if (nextState) {
      fetchCoachQuestions(q);
    }
  };

  const handleResultsChipTap = (question: Question, option: QuestionOption, isSelected: boolean) => {
    const phrase = getChipPhrase(question.cueType, option.value);
    let newQ = "";

    if (isSelected) {
      newQ = removeChipPhrase(q, phrase);
    } else {
      const existingPhrases = question.options.map((opt) => getChipPhrase(question.cueType, opt.value));
      newQ = replaceOrAppendChipPhrase(q, phrase, existingPhrases);
    }

    const params = new URLSearchParams();
    params.set("q", newQ);
    if (isDebug) params.set("debug", "1");
    if (isGenieOff) params.set("genie", "off");

    router.replace(`/results?${params.toString()}`);
  };

  const handleFeedback = (rating: "up" | "down") => {
    setFeedbackRating(rating);
    setToastMessage(rating === "up" ? "Thanks for your feedback!" : "Feedback recorded.");
  };

  const handleInertClick = (msg = "Not part of this prototype") => {
    setToastMessage(msg);
  };

  const handleSuggestionClick = (term: string) => {
    const params = new URLSearchParams();
    params.set("q", term);
    if (isDebug) params.set("debug", "1");
    if (isGenieOff) params.set("genie", "off");
    router.push(`/results?${params.toString()}`);
  };

  const aiExplanation = getAiExplanation(q, count, results);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#1b1512] text-[#f3e3d9] select-none font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#1b1512]/95 backdrop-blur-md px-3 h-14 flex items-center justify-between border-b border-[#29201a]">
        <Link
          href={`/search?${new URLSearchParams({ q, ...(isDebug ? { debug: "1" } : {}), ...(isGenieOff ? { genie: "off" } : {}) }).toString()}`}
          className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-white/10 active:bg-white/15 text-white transition-colors -ml-1 flex-shrink-0 cursor-pointer"
          aria-label="Back to search"
        >
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </Link>

        <h1 className="text-[17px] font-semibold text-white tracking-tight truncate max-w-[200px] text-center">
          {q || "Search"}
        </h1>

        <div className="flex items-center gap-1 flex-shrink-0">
          {!isGenieOff && (
            <button
              type="button"
              onClick={handleToggleCoachHelp}
              className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isCoachHelpOpen
                  ? "bg-[#f59e6c] text-[#281204] shadow-xs"
                  : "text-[#f59e6c] hover:bg-white/10"
              }`}
              aria-label="Ask AI Genie for help"
              title="Ask AI Genie for help"
            >
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                auto_awesome
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleInertClick()}
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-white/10 active:bg-white/15 text-white/80 hover:text-white transition-colors -mr-1 flex-shrink-0 cursor-pointer"
            aria-label="More options"
          >
            <span className="material-symbols-outlined text-[22px]">more_vert</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col pb-28">
        {/* Controls Bar & Feedback */}
        <section aria-label="Search feedback" className="px-4 py-2.5 flex items-center justify-between gap-2 border-b border-[#29201a]/50">
          {!isGenieOff ? (
            <button
              type="button"
              onClick={handleToggleCoachHelp}
              className={`min-h-[44px] px-3.5 py-1.5 rounded-full text-[14px] font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                isCoachHelpOpen
                  ? "bg-[#f59e6c] text-[#281204] border border-[#f59e6c]"
                  : "bg-[#2d221c] text-[#f59e6c] border border-[#483b34] hover:bg-[#3d3027] hover:text-white"
              }`}
              aria-label="Ask AI Genie for help"
            >
              <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                auto_awesome
              </span>
              <span>{isCoachHelpOpen ? "Genie Active" : "Need help?"}</span>
            </button>
          ) : <div />}

          {/* Feedback Buttons */}
          <div className="flex items-center gap-1.5 text-[#d7c3b8]">
            <button
              type="button"
              onClick={() => handleFeedback("up")}
              aria-label="Thumbs up feedback"
              className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition-all cursor-pointer ${
                feedbackRating === "up"
                  ? "text-[#f8a370] bg-white/10 font-bold"
                  : "hover:bg-white/10 hover:text-white"
              }`}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={{ fontVariationSettings: feedbackRating === "up" ? "'FILL' 1" : "'FILL' 0" }}
              >
                thumb_up
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleFeedback("down")}
              aria-label="Thumbs down feedback"
              className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition-all cursor-pointer ${
                feedbackRating === "down"
                  ? "text-[#f8a370] bg-white/10 font-bold"
                  : "hover:bg-white/10 hover:text-white"
              }`}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={{ fontVariationSettings: feedbackRating === "down" ? "'FILL' 1" : "'FILL' 0" }}
              >
                thumb_down
              </span>
            </button>
          </div>
        </section>

        {/* Debug Panel (?debug=1) */}
        {isDebug && (
          <div className="bg-[#1f1612] border-b border-[#f59e6c]/40 px-3 py-2.5 text-[12px] font-mono text-[#f0e6e0] space-y-2 shadow-inner">
            <div className="flex items-center justify-between text-[#f59e6c] font-bold">
              <span>DEBUG PANEL (?debug=1)</span>
              <span>Results: {count}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 bg-[#2a1e18] p-2 rounded border border-[#3e2d24]">
              <div>
                <span className="text-[#a89b92]">Tier 1 (All):</span>{" "}
                <span className="font-semibold text-emerald-400">{results.filter((r) => r.tier === 1).length}</span>
              </div>
              <div>
                <span className="text-[#a89b92]">Tier 2 (≥50%):</span>{" "}
                <span className="font-semibold text-amber-400">{results.filter((r) => r.tier === 2).length}</span>
              </div>
              <div>
                <span className="text-[#a89b92]">Tier 3 (Weak):</span>{" "}
                <span className="font-semibold text-zinc-400">{results.filter((r) => r.tier === 3).length}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[#d7c3b8]">
              <div>Strong matches: <span className="font-semibold text-white">{countStrong}</span></div>
              <div>Ambiguous count: <span className="font-semibold text-white">{ambiguousCount}</span></div>
              <div>Top score: <span className="font-semibold text-white">{topScore.toFixed(1)}</span></div>
              <div>Total matches: <span className="font-semibold text-white">{countTotal}</span></div>
            </div>
            {!isGenieOff && (
              <div className="pt-1.5 border-t border-[#3e2d24]">
                <span className="text-[#a89b92]">Coach Trigger:</span>{" "}
                <span className={`font-bold ${coachTriggerStatus?.triggered ? "text-emerald-400" : "text-rose-400"}`}>
                  {coachTriggerStatus?.triggered ? "TRIGGERED" : "NOT TRIGGERED"}
                </span>{" "}
                <span className="text-[#a89b92]">({coachTriggerStatus?.reason || "evaluating..."})</span>
              </div>
            )}
          </div>
        )}

        {/* Coach Strip when triggered */}
        {!isGenieOff && isCoachHelpOpen && (
          <div className="border-b border-[#29201a] animate-fade-in">
            {coachLoading ? (
              <div className="bg-[#241c17] px-4 py-3 flex items-center gap-2.5 text-[14px] text-[#a89b92]">
                <div className="w-4 h-4 border-2 border-[#f59e6c] border-t-transparent rounded-full animate-spin" />
                <span>Finding details to help narrow down &ldquo;{q}&rdquo;...</span>
              </div>
            ) : (
              <CoachStrip
                questions={coachQuestions}
                currentText={q}
                candidateCount={count}
                isDebug={isDebug}
                noMatchState="none"
                unmatchedTerms={[]}
                onChipTap={handleResultsChipTap}
                onDismiss={() => setIsCoachHelpOpen(false)}
              />
            )}
          </div>
        )}

        {/* Natural Language Explanation at the Top */}
        {!isGenieOff && count > 0 && (
          <section aria-label="AI summary" className="px-4 pt-2 pb-3 text-[14px] text-[#f0e6e0] leading-relaxed select-text animate-fade-in">
            <p>{aiExplanation}</p>
          </section>
        )}

        {/* Unmatched location or terms notice */}
        {unmatchedTerms.length > 0 && (
          <div className="mx-3 my-2 p-3 bg-[#241c18] border border-[#f59e6c]/40 rounded-xl text-[13px] text-[#e8d5cb] flex items-start gap-2.5 animate-fade-in">
            <span className="material-symbols-outlined text-[#f59e6c] text-[20px] flex-shrink-0 mt-0.5">location_on</span>
            <div>
              <p className="font-semibold text-white">No exact matches for &ldquo;{unmatchedTerms.join(", ")}&rdquo;</p>
              <p className="text-[12px] text-[#a89b92] mt-0.5 leading-relaxed">
                This demo library contains photos from <strong>Goa, Bengaluru, Chennai, Coorg, Hyderabad, Manali, Munnar, Ooty, and Pondicherry</strong>.
              </p>
            </div>
          </div>
        )}

        {/* AI Highlight Banner if top photo has AI explanation */}
        {!isGenieOff && results[0]?.explanation?.startsWith("AI Match:") && (
          <div className="mx-3 my-2 p-2.5 bg-[#251d18] border border-[#f59e6c]/30 rounded-xl flex items-center gap-2 text-[13px] text-[#f2e2d8] animate-fade-in">
            <span className="material-symbols-outlined text-[#f59e6c] text-[18px]">auto_awesome</span>
            <span>{results[0].explanation}</span>
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-[#a89b92]">
            <div className="w-8 h-8 border-2 border-[#f59e6c] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-[14px]">Searching photos with AI...</p>
          </div>
        ) : count > 0 ? (
          /* Results Grid */
          (() => {
            const strongMatches = results.filter((r) => (r.tier || 3) === 1 || r.score >= 50);
            const relatedMatches = results.filter((r) => !strongMatches.includes(r));
            const primaryList = strongMatches.length > 0 ? strongMatches : results;

            return (
              <div className="flex-1 flex flex-col">
                {/* Top Highlights */}
                {primaryList.length >= 2 && (
                  <div className="grid grid-cols-2 gap-1 px-1 pb-1">
                    {primaryList.slice(0, 2).map((photo) => (
                      <Link
                        key={`highlight-${photo.id}`}
                        href={`/photo/${photo.id}?from=results&q=${encodeURIComponent(q)}`}
                        className="relative aspect-square overflow-hidden bg-[#241c18] group cursor-pointer"
                      >
                        <Image
                          src={photo.src}
                          alt={photo.file}
                          fill
                          sizes="(max-width: 400px) 50vw, 200px"
                          className="object-cover group-hover:scale-102 transition-transform duration-200"
                          unoptimized
                        />
                        {photo.explanation?.startsWith("AI Match:") && (
                          <div className="absolute bottom-2 left-2 right-2 bg-black/80 backdrop-blur-xs text-[11px] text-[#f59e6c] px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
                            <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
                            <span className="truncate">{photo.explanation.replace("AI Match: ", "")}</span>
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                )}

                {/* Section Header: Best Matches */}
                <div className="px-3 pt-4 pb-2 flex items-center justify-between text-[#f0e6e0]">
                  <h2 className="text-[15px] font-semibold tracking-tight flex items-center gap-2">
                    <span>{strongMatches.length > 0 ? "Best matches" : "Most relevant photos"}</span>
                    {strongMatches.length > 0 && (
                      <span className="bg-[#f59e6c]/20 text-[#f59e6c] text-[11px] px-2 py-0.5 rounded-full font-medium">
                        Verified Match
                      </span>
                    )}
                  </h2>
                  <span className="text-[13px] text-[#a89b92]">
                    {strongMatches.length > 0 ? `${strongMatches.length} photo${strongMatches.length === 1 ? "" : "s"}` : `${count} photos`}
                  </span>
                </div>

                {/* 3-Column Photo Grid */}
                <div className="grid grid-cols-3 gap-[2px] px-1 pb-4">
                  {primaryList.map((photo) => (
                    <Link
                      key={photo.id}
                      href={`/photo/${photo.id}?from=results&q=${encodeURIComponent(q)}`}
                      className="relative aspect-square overflow-hidden bg-[#241c18] group cursor-pointer"
                    >
                      <Image
                        src={photo.src}
                        alt={photo.file}
                        fill
                        sizes="(max-width: 400px) 33vw, 130px"
                        className="object-cover group-hover:scale-105 transition-transform duration-200"
                        unoptimized
                      />
                      {photo.explanation?.startsWith("AI Match:") && (
                        <div className="absolute top-1 left-1 bg-black/80 backdrop-blur-xs text-[10px] text-[#f59e6c] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-xs">
                          <span className="material-symbols-outlined text-[11px]">auto_awesome</span>
                        </div>
                      )}
                      {isDebug && photo.tier && (
                        <div className="absolute bottom-1 right-1 bg-black/85 backdrop-blur-xs text-[10px] font-mono text-white px-1.5 py-0.5 rounded flex items-center gap-1 border border-white/20 shadow-xs">
                          <span className={`font-bold ${photo.tier === 1 ? "text-emerald-300" : photo.tier === 2 ? "text-amber-300" : "text-zinc-400"}`}>
                            T{photo.tier}
                          </span>
                          <span>{photo.score.toFixed(1)}</span>
                        </div>
                      )}
                    </Link>
                  ))}
                </div>

                {/* Expandable Section for Related Photos (when strongMatches exist and related photos exist) */}
                {strongMatches.length > 0 && relatedMatches.length > 0 && (
                  <div className="px-3 pt-2 pb-4 border-t border-[#29201a]/80">
                    <button
                      type="button"
                      onClick={() => setShowRelated(!showRelated)}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#241c18] border border-[#3e2e25] flex items-center justify-between text-[13px] font-medium text-[#d7c3b8] hover:bg-[#2d221c] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-[#a89b92]">grid_view</span>
                        <span>Other related photos ({relatedMatches.length})</span>
                      </div>
                      <span className="material-symbols-outlined text-[18px] text-[#a89b92]">
                        {showRelated ? "expand_less" : "expand_more"}
                      </span>
                    </button>
                    {showRelated && (
                      <div className="grid grid-cols-3 gap-[2px] pt-2 animate-fade-in">
                        {relatedMatches.map((photo) => (
                          <Link
                            key={`rel-${photo.id}`}
                            href={`/photo/${photo.id}?from=results&q=${encodeURIComponent(q)}`}
                            className="relative aspect-square overflow-hidden bg-[#241c18] group cursor-pointer"
                          >
                            <Image
                              src={photo.src}
                              alt={photo.file}
                              fill
                              sizes="(max-width: 400px) 33vw, 130px"
                              className="object-cover group-hover:scale-105 transition-transform duration-200"
                              unoptimized
                            />
                            {isDebug && photo.tier && (
                              <div className="absolute bottom-1 right-1 bg-black/85 backdrop-blur-xs text-[10px] font-mono text-white px-1.5 py-0.5 rounded flex items-center gap-1 border border-white/20 shadow-xs">
                                <span className="text-zinc-400">T{photo.tier}</span>
                                <span>{photo.score.toFixed(1)}</span>
                              </div>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}

            {/* Step 2 Required Attribution: S6 attribution line + A2 disclaimer + A3 library info */}
            <div className="py-4 text-center text-[14px] text-[#8f7e73] space-y-1">
              <p>
                <a
                  href="https://pixabay.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline hover:text-[#f59e6c] font-medium"
                >
                  Photos from Pixabay
                </a>
              </p>
              <p className="text-[12px] text-[#736357]">
                Dates, places and people are synthetic
              </p>
              <button
                type="button"
                onClick={() => setIsLibraryInfoOpen(true)}
                className="text-[13px] text-[#736357] hover:text-[#f59e6c] min-h-[36px] transition-colors cursor-pointer bg-transparent border-none"
              >
                About this library
              </button>
              <TesterDisclaimer />
            </div>
          </div>
        );
      })()
    ) : (
          /* S8 Zero Results Fallback */
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-[#2a211b] flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[40px] text-[#a89b92]">
                search_off
              </span>
            </div>

            <h3 className="text-[17px] font-semibold text-white mb-1">
              No matching photos found
            </h3>
            <p className="text-[14px] text-[#a89b92] max-w-[260px] mb-6 leading-relaxed">
              We couldn&apos;t find any photos matching &ldquo;{q}&rdquo;. Try another term or explore suggestions:
            </p>

            <div className="flex flex-wrap gap-2 justify-center max-w-[300px]">
              {["pool", "birthday cake", "road trip", "beach"].map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => handleSuggestionClick(term)}
                  className="min-h-[44px] px-4 py-2 rounded-full bg-[#2a211b] hover:bg-[#382b24] text-[14px] font-medium text-[#f0e6e0] transition-colors cursor-pointer"
                >
                  {term}
                </button>
              ))}
            </div>

            {!isGenieOff && (
              <button
                type="button"
                onClick={() => {
                  setIsCoachHelpOpen(true);
                  fetchCoachQuestions(q);
                }}
                className="mt-5 min-h-[44px] px-5 py-2.5 rounded-full bg-[#f59e6c] text-[#281204] font-semibold text-[14px] flex items-center gap-1.5 shadow-sm hover:bg-[#faaf82] active:scale-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                <span>Ask Genie for ideas</span>
              </button>
            )}

            {/* A2/A3: Disclaimer + library info for S8 zero-results */}
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsLibraryInfoOpen(true)}
                className="text-[13px] text-[#736357] hover:text-[#f59e6c] min-h-[36px] transition-colors cursor-pointer bg-transparent border-none"
              >
                About this library
              </button>
              <TesterDisclaimer />
            </div>
          </div>
        )}
      </main>

      {/* Floating Follow-up Search Pill Bar */}
      <div className="sticky bottom-0 bg-[#1b1512]/95 backdrop-blur-md p-3 border-t border-[#29201a] z-40">
        <div className="flex items-center gap-2">
          <Link
            href={`/search?${new URLSearchParams({ q, ...(isDebug ? { debug: "1" } : {}), ...(isGenieOff ? { genie: "off" } : {}) }).toString()}`}
            className="h-12 flex-1 bg-[#332924] hover:bg-[#3e322b] active:scale-98 rounded-full px-4 flex items-center justify-between border border-[#483b34] text-[#c9bbb2] shadow-lg transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="material-symbols-outlined text-[19px] text-[#a89b92] flex-shrink-0">search</span>
              <span className="text-[14px] font-normal text-[#d7c3b8] truncate">Search or follow up</span>
            </div>
            <span className="material-symbols-outlined text-[20px] text-[#d7c3b8] flex-shrink-0">mic</span>
          </Link>

          {!isGenieOff && (
            <button
              type="button"
              onClick={handleToggleCoachHelp}
              className={`h-12 px-4 rounded-full flex items-center gap-1.5 font-semibold text-[14px] transition-all shadow-lg flex-shrink-0 cursor-pointer ${
                isCoachHelpOpen
                  ? "bg-[#f59e6c] text-[#281204] border border-[#f59e6c]"
                  : "bg-[#332924] text-[#f59e6c] border border-[#483b34] hover:bg-[#3e322b]"
              }`}
              aria-label="Ask AI Genie for help"
              title="Ask AI Genie for help"
            >
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                auto_awesome
              </span>
              <span>Genie</span>
            </button>
          )}
        </div>
      </div>

      {/* Toast Feedback */}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />

      {/* A3: About this library modal */}
      <LibraryInfoModal
        isOpen={isLibraryInfoOpen}
        onClose={() => setIsLibraryInfoOpen(false)}
      />
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-sm text-[#a89b92]">Loading results...</div>}>
      <ResultsContent />
    </Suspense>
  );
}
