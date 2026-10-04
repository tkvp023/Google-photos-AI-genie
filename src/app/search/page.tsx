"use client";

import React, { useState, Suspense, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { config } from "@/lib/config";
import { Toast } from "@/components/ui/Toast";
import { useCoach } from "@/hooks/useCoach";
import { CoachStrip } from "@/components/coach/CoachStrip";
import { GboardKeyboard } from "@/components/ui/GboardKeyboard";
import { Question, QuestionOption } from "@/types";
import { TesterDisclaimer } from "@/components/ui/TesterDisclaimer";
import { LibraryInfoModal } from "@/components/ui/LibraryInfoModal";

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDebug = searchParams.get("debug") === "1";
  const isGenieOff = searchParams.get("genie") === "off" || !config.GENIE_ENABLED;
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(Boolean(initialQuery));
  const [submittedQuery, setSubmittedQuery] = useState<string>("");
  const [isLibraryInfoOpen, setIsLibraryInfoOpen] = useState(false);

  // Search input ref to keep focus when chips are tapped
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Coach state machine — always on unless hidden switch ?genie=off
  const coach = useCoach(query, { genieOff: isGenieOff });

  // Recent searches list with long-press delete support
  const [recentSearches, setRecentSearches] = useState<string[]>([
    "pool with friends",
    "birthday cake",
    "beach sunset",
  ]);

  // Prompt delete dialog state
  const [promptToDelete, setPromptToDelete] = useState<string | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressActiveRef = useRef<boolean>(false);

  // Load saved recent searches from localStorage if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem("gp_recent_searches");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecentSearches(parsed);
        }
      }
    } catch {}
  }, []);

  const handleStartLongPress = (promptText: string) => {
    isLongPressActiveRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      setPromptToDelete(promptText);
      if (typeof window !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(40);
        } catch {}
      }
    }, 450);
  };

  const handleCancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePromptClick = (promptText: string) => {
    if (isLongPressActiveRef.current) {
      isLongPressActiveRef.current = false;
      return;
    }
    handleSearchSubmit(promptText);
  };

  const handleDeletePrompt = (promptText: string) => {
    setRecentSearches((prev) => {
      const filtered = prev.filter((p) => p !== promptText);
      try {
        localStorage.setItem("gp_recent_searches", JSON.stringify(filtered));
      } catch {}
      return filtered;
    });
    if (query === promptText) {
      setQuery("");
    }
    setPromptToDelete(null);
    setToastMessage(`Deleted "${promptText}" from history`);
  };

  const handleInertClick = (msg = "Not part of this prototype") => {
    setToastMessage(msg);
  };

  const handleQueryChange = (val: string) => {
    setQuery(val);
  };

  const handleSearchSubmit = (searchQuery: string) => {
    const q = searchQuery.trim();
    if (!q) return;

    setSubmittedQuery(q);

    // Save final executed query to recent searches
    try {
      setRecentSearches((prev) => {
        const deduped = prev.filter((p) => p.toLowerCase() !== q.toLowerCase());
        const updated = [q, ...deduped].slice(0, 10);
        try {
          localStorage.setItem("gp_recent_searches", JSON.stringify(updated));
        } catch {}
        return updated;
      });
    } catch {}

    const params = new URLSearchParams();
    params.set("q", q);
    if (isDebug) params.set("debug", "1");
    if (isGenieOff) params.set("genie", "off");

    router.push(`/results?${params.toString()}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearchSubmit(query);
    }
  };

  // Keyboard handlers
  const handleKeypadPress = (char: string) => {
    handleQueryChange(query + char);
  };

  const handleKeypadBackspace = () => {
    if (query.length > 0) {
      handleQueryChange(query.slice(0, -1));
    }
  };

  const handleKeypadSpace = () => {
    handleQueryChange(query + " ");
  };

  // Zero-friction chip tap handler — single source of truth is the search bar
  const handleChipTap = (question: Question, option: QuestionOption, isSelected: boolean) => {
    const newText = coach.handleChipTap(question, option, isSelected);
    setQuery(newText);

    // Keep focus and keyboard open
    searchInputRef.current?.focus();
  };

  // Dismiss coach handler
  const handleDismissCoach = () => {
    coach.dismissCoach();
  };

  // Copy debug info as text
  const handleCopyDebug = () => {
    const debugText = [
      `=== AI GENIE DEBUG INFO ===`,
      `Typed Text at Trigger: ${coach.typedTextAtTrigger || "(none)"}`,
      `Candidate Count: ${coach.candidateCount}`,
      `Tokens: [${coach.tokens.join(", ")}]`,
      `Recognised Tokens: [${coach.recognisedTokens.join(", ")}]`,
      `Unrecognised Tokens: [${coach.unrecognisedTokens.join(", ")}]`,
      `Trigger Blocked Reason: ${coach.triggerBlockedReason || "none"}`,
      `Results Count at Trigger: ${coach.resultsForFirstTyped || coach.candidateCount}`,
      `Final Submitted Text: ${submittedQuery || query}`,
      `Rows Shown:`,
      ...coach.questions.map((q) => `  - ${q.cueType} (${q.field}): ${q.text} -> [${q.options.map((o) => o.label).join(", ")}]`),
      `Chip History (Order of tap/remove):`,
      ...coach.chipHistory.map((h, i) => `  ${i + 1}. [${h.action}] "${h.phrase}" (${h.cueType}) at +${h.timestamp - (coach.triggerTime || h.timestamp)}ms`),
    ].join("\n");

    try {
      navigator.clipboard.writeText(debugText);
      setToastMessage("Copied debug info to clipboard");
    } catch {
      setToastMessage("Could not copy debug info");
    }
  };

  // People avatar bubbles from synthetic cast registry
  const peopleList = [
    { id: "1", name: "Family", src: "/library/graduation_01.jpg" },
    { id: "2", name: "Aarav", src: "/library/pool_02.jpg" },
    { id: "3", name: "Dad", src: "/library/beach_01.jpg" },
    { id: "4", name: "Brother", src: "/library/festival_01.jpg" },
    { id: "5", name: "Mom", src: "/library/birthday_01.jpg" },
    { id: "6", name: "Friend", src: "/library/kids_01.jpg" },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#1b1512] text-[#f3e3d9] select-none font-sans">
      {/* Top Header: Back Arrow & Title */}
      <header className="sticky top-0 z-30 bg-[#1b1512]/95 backdrop-blur-md px-4 h-14 flex items-center justify-between border-b border-[#2a211b]">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href={`/${isGenieOff ? "?genie=off" : ""}`}
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-white/10 active:bg-white/15 text-white transition-colors -ml-1 flex-shrink-0 cursor-pointer"
            aria-label="Go back"
          >
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </Link>
          <span className="text-[17px] font-semibold text-white tracking-tight">Search</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 flex flex-col overflow-y-auto no-scrollbar pb-36">
        {/* Debug Panel (?debug=1 only, no storage) */}
        {isDebug && (
          <div className="my-3 p-3.5 rounded-2xl bg-[#29201a] border border-[#f59e6c]/40 text-[13px] font-mono text-[#f3e3d9] space-y-2 select-text shadow-xl">
            <div className="flex items-center justify-between border-b border-[#44352c] pb-2">
              <span className="font-bold text-[#f59e6c] text-[14px]">DEBUG PANEL (?debug=1)</span>
              <button
                type="button"
                onClick={handleCopyDebug}
                className="min-h-[44px] px-3 py-1 rounded-full bg-[#f59e6c] text-[#281204] font-bold text-[12px] hover:bg-[#faaf82] active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                <span>Copy as text</span>
              </button>
            </div>

            <div className="space-y-1 text-[13px]">
              <div><strong className="text-[#a89b92]">Typed at trigger:</strong> {coach.typedTextAtTrigger || "(waiting)"}</div>
              <div><strong className="text-[#a89b92]">Candidates:</strong> {coach.candidateCount}</div>
              <div><strong className="text-[#a89b92]">Tokens:</strong> [{coach.tokens.join(", ")}]</div>
              <div><strong className="text-[#a89b92]">Recognised:</strong> [{coach.recognisedTokens.join(", ")}]</div>
              <div><strong className="text-[#a89b92]">Unrecognised:</strong> [{coach.unrecognisedTokens.join(", ")}]</div>
              <div><strong className="text-[#a89b92]">Blocked reason:</strong> {coach.triggerBlockedReason || "none"}</div>
              <div><strong className="text-[#a89b92]">Results count at trigger:</strong> {coach.resultsForFirstTyped || coach.candidateCount}</div>
              <div><strong className="text-[#a89b92]">Final submitted text:</strong> {submittedQuery || query}</div>
              <div>
                <strong className="text-[#a89b92]">Chips history:</strong>
                {coach.chipHistory.length === 0 ? " (none tapped)" : (
                  <ul className="pl-4 list-disc space-y-0.5 mt-1">
                    {coach.chipHistory.map((h, i) => (
                      <li key={i}>[{h.action}] &ldquo;{h.phrase}&rdquo; ({h.cueType})</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {query.trim().length === 0 ? (
          /* Initial Search Screen */
          <div className="flex flex-col gap-5 pt-3">
            {/* People Circles Row */}
            <section aria-label="People faces" className="pt-1">
              {/* A3: People avatar caption */}
              <p className="text-[12px] text-[#736357] px-1 pb-1 select-none">
                Avatars are illustrative only — not real face recognition
              </p>
              <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
                {peopleList.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => handleSearchSubmit(person.name)}
                    className="w-13 h-13 min-w-[44px] min-h-[44px] rounded-full overflow-hidden border border-[#3e322a] flex-shrink-0 hover:scale-105 active:scale-95 transition-all relative cursor-pointer"
                    aria-label={`Search photos of ${person.name}`}
                  >
                    <Image
                      src={person.src}
                      alt={person.name}
                      fill
                      sizes="52px"
                      className="object-cover"
                      unoptimized
                    />
                  </button>
                ))}
                {/* More button (...) */}
                <button
                  type="button"
                  onClick={() => handleInertClick("More people")}
                  className="w-13 h-13 min-w-[44px] min-h-[44px] rounded-full bg-[#2d231d] border border-[#3e322a] flex items-center justify-center flex-shrink-0 hover:bg-[#3d3129] active:scale-95 transition-all text-[#d7c3b8] cursor-pointer"
                  aria-label="View more people"
                >
                  <span className="material-symbols-outlined text-[20px]">more_horiz</span>
                </button>
              </div>
            </section>

            <div className="h-[1px] bg-[#2d221c]" />

            {/* Recent Searches List with Long-Press Delete Support */}
            <section aria-label="Recent searches" className="space-y-0.5">
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-[14px] font-semibold text-[#a89b92] uppercase tracking-wider">
                  Recent searches
                </span>
                <span className="text-[12px] text-[#736357]">Long press to delete</span>
              </div>
              <ul className="divide-y divide-[#2a211b]">
                {recentSearches.map((term) => (
                  <li
                    key={term}
                    onPointerDown={() => handleStartLongPress(term)}
                    onPointerUp={handleCancelLongPress}
                    onPointerLeave={handleCancelLongPress}
                    onTouchStart={() => handleStartLongPress(term)}
                    onTouchEnd={handleCancelLongPress}
                    onTouchMove={handleCancelLongPress}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setPromptToDelete(term);
                    }}
                    onClick={() => handlePromptClick(term)}
                    className="flex items-center justify-between py-3.5 px-1.5 min-h-[44px] hover:bg-white/5 active:bg-white/10 cursor-pointer rounded-lg transition-colors group select-none relative"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 pr-2">
                      <span className="material-symbols-outlined text-[20px] text-[#a89b92] flex-shrink-0">
                        history
                      </span>
                      <span className="text-[15px] text-[#f0e6e0] font-normal truncate leading-snug">
                        {term}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPromptToDelete(term);
                        }}
                        className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#a89b92] hover:text-[#f59e6c] hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        aria-label={`Delete ${term} from history`}
                        title="Delete from history"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                      <span className="material-symbols-outlined text-[18px] text-[#a89b92] opacity-40 group-hover:opacity-100 transition-opacity">
                        north_west
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : (
          /* Typing Suggestion Row */
          <div className="w-full flex flex-col pt-3">
            <div
              onClick={() => handleSearchSubmit(query)}
              className="w-full min-h-[50px] px-2 py-3 flex items-center gap-3.5 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer group"
              role="button"
              tabIndex={0}
            >
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-[#a89b92] flex-shrink-0 group-hover:text-white">
                <span className="material-symbols-outlined text-[22px]">search</span>
              </div>
              <div className="flex items-center min-w-0 flex-1">
                <p className="text-[15px] text-white truncate">
                  <span>Search for </span>
                  <span className="font-semibold text-[#f59e6c]">“{query}”</span>
                </p>
              </div>
              <div className="w-8 h-8 flex items-center justify-center text-[#a89b92] flex-shrink-0">
                <span className="material-symbols-outlined text-[20px]">north_west</span>
              </div>
            </div>

            <div className="w-full h-[1px] bg-[#2a211b] mt-1 mb-6" />

            <div className="w-full py-12 flex flex-col items-center justify-center text-center opacity-40 select-none pointer-events-none">
              <span className="material-symbols-outlined text-[44px] text-[#a89b92] mb-2">
                photo_library
              </span>
              <p className="text-[14px] text-[#a89b92]">Searching your 200 photos</p>
            </div>

            {/* A2: Tester disclaimer + A3: About this library link */}
            <div className="mt-auto pb-3 text-center">
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

      {/* Sticky Bottom Area: Coach Strip + Search Bar Pill + Keyboard */}
      <div className="sticky bottom-0 bg-[#1b1512] z-30 flex flex-col w-full border-t border-[#2a211b] shadow-2xl">
        {/* Compact Coach Strip: visible unless hidden switch ?genie=off */}
        {!isGenieOff && config.GENIE_ENABLED && (coach.isCoachVisible || coach.isNoMatch || coach.noMatchState === "partial") && (
          <CoachStrip
            questions={coach.questions}
            currentText={query}
            candidateCount={coach.candidateCount}
            isDebug={isDebug}
            noMatchState={coach.noMatchState}
            unmatchedTerms={coach.unmatchedTermsList}
            onChipTap={handleChipTap}
            onDismiss={handleDismissCoach}
          />
        )}

        {/* Floating Pill: "Search or ask" at the Bottom */}
        <div className="p-3">
          <div
            onClick={() => {
              setIsKeyboardOpen(true);
              searchInputRef.current?.focus();
            }}
            onContextMenu={(e) => {
              if (query.trim().length > 0) {
                e.preventDefault();
                setPromptToDelete(query);
              }
            }}
            className="w-full h-12 px-4 bg-[#332924] rounded-full flex items-center justify-between border border-[#483b34] focus-within:border-[#f59e6c] shadow-lg cursor-text transition-all"
          >
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <span className="material-symbols-outlined text-[20px] text-[#a89b92] flex-shrink-0">
                search
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsKeyboardOpen(true)}
                placeholder="Search or ask"
                autoFocus
                className="flex-1 bg-transparent border-none outline-none text-[15px] text-white placeholder-[#a89b92] leading-none"
              />
            </div>

            {query.trim().length > 0 ? (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#a89b92] hover:text-white transition-colors cursor-pointer"
                  aria-label="Clear search"
                  title="Clear prompt"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSearchSubmit(query);
                  }}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-[#f59e6c] text-[#281204] flex items-center justify-center hover:bg-[#faaf82] active:scale-95 transition-all shadow-xs font-bold cursor-pointer"
                  aria-label="Execute search"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleInertClick("Voice search");
                  }}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#d7c3b8] hover:text-white transition-colors flex-shrink-0 cursor-pointer"
                  aria-label="Voice search"
                >
                  <span className="material-symbols-outlined text-[20px]">mic</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Floating Bottom Android Gboard Keyboard */}
        {isKeyboardOpen && (
          <GboardKeyboard
            onKeyPress={handleKeypadPress}
            onBackspace={handleKeypadBackspace}
            onSpace={handleKeypadSpace}
            onSubmit={() => handleSearchSubmit(query)}
            onClose={() => setIsKeyboardOpen(false)}
          />
        )}
      </div>

      {/* Delete Prompt Modal Dialog (Appears on Long-Press) */}
      {promptToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-fade-in"
          onClick={() => setPromptToDelete(null)}
        >
          <div
            className="w-full max-w-[320px] bg-[#29201a] border border-[#483b34] rounded-[24px] p-5 shadow-2xl flex flex-col space-y-3.5 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-prompt-title"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#f59e6c]/20 text-[#f59e6c] flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[22px]">delete</span>
              </div>
              <h3 id="delete-prompt-title" className="text-[17px] font-semibold text-white leading-tight">
                Delete from history?
              </h3>
            </div>

            <p className="text-[14px] text-[#b8a99e] leading-relaxed">
              <span className="text-[#f3e3d9] font-medium">“{promptToDelete}”</span> will be removed from your recent searches.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPromptToDelete(null)}
                className="min-h-[44px] px-4 py-2 rounded-full text-[14px] font-medium text-[#c9bbb2] hover:text-white hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeletePrompt(promptToDelete)}
                className="min-h-[44px] px-4 py-2 rounded-full text-[14px] font-semibold bg-[#f59e6c] text-[#281204] hover:bg-[#faaf82] active:scale-95 transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

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

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-sm text-[#a89b92]">Loading search...</div>}>
      <SearchContent />
    </Suspense>
  );
}
