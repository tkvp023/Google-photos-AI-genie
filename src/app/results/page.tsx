"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Toast } from "@/components/ui/Toast";
import { BottomNav } from "@/components/ui/BottomNav";
import { StudyBanner } from "@/components/study/StudyBanner";
import { logClientEvent } from "@/lib/clientLogger";
import { PhotoItem } from "@/types";

interface ScoredPhotoItem extends PhotoItem {
  score: number;
  matchedFields: string[];
  explanation?: string;
}

function ResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const mode = (searchParams.get("mode") as "A" | "B") || "A";
  const sessionId = searchParams.get("session");
  const participantId = searchParams.get("participant");
  const targetId = searchParams.get("target");

  const [results, setResults] = useState<ScoredPhotoItem[]>([]);
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const forwardStudyParams = (baseUrl: string) => {
    const url = new URL(baseUrl, "http://localhost");
    if (sessionId) url.searchParams.set("session", sessionId);
    if (participantId) url.searchParams.set("participant", participantId);
    if (targetId) url.searchParams.set("target", targetId);
    return `${url.pathname}${url.search}`;
  };

  useEffect(() => {
    if (!q) {
      setResults([]);
      setCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}&mode=${mode}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.results) {
          setResults(data.results);
          setCount(data.count || data.results.length);
        } else {
          setResults([]);
          setCount(0);
        }
      })
      .catch((err) => {
        console.error("Search fetch error:", err);
        setResults([]);
        setCount(0);
      })
      .finally(() => setLoading(false));
  }, [q, mode]);

  const handleInertClick = () => {
    setToastMessage("Not part of this prototype");
  };

  const handleSuggestionClick = (term: string) => {
    router.push(forwardStudyParams(`/results?q=${encodeURIComponent(term)}&mode=${mode}`));
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-white">
      {/* Sticky Study Timer Banner */}
      <StudyBanner sessionId={sessionId} targetId={targetId} mode={mode} />

      {/* Search Header Capsule (S6 / S8) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-3 pt-2.5 pb-2 border-b border-[#E3E5E8]/60">
        <div className="flex items-center gap-2 bg-[#EEF0F3] rounded-full px-3 h-12 shadow-inner">
          <Link
            href={forwardStudyParams(`/search?mode=${mode}`)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#5F6368] hover:text-[#1F1F1F] transition-colors"
            aria-label="Back to search"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>
          <div className="flex-1 min-w-0 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#1F6FEB] text-[18px]">
              auto_awesome
            </span>
            <span className="text-[14px] text-[#1F1F1F] font-medium truncate">
              {q}
            </span>
          </div>
          <Link
            href={forwardStudyParams(`/search?mode=${mode}`)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#5F6368] hover:text-[#1F1F1F] transition-colors"
            aria-label="Clear query"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </Link>
        </div>

        {/* Query Context Filter Chips */}
        {q && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 pb-0.5">
            <div className="inline-flex items-center gap-1 bg-[#E8F0FE] text-[#1F6FEB] px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0">
              <span className="material-symbols-outlined text-[13px]">search</span>
              <span>&ldquo;{q}&rdquo;</span>
            </div>
            {mode === "B" && (
              <div className="inline-flex items-center gap-1 bg-[#FEF7E0] text-[#B06000] px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0">
                <span className="material-symbols-outlined text-[13px]">smart_toy</span>
                <span>Coach Active</span>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-[#5F6368]">
            <div className="w-8 h-8 border-2 border-[#1F6FEB] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs">Searching photos...</p>
          </div>
        ) : count > 0 ? (
          /* S6 Results Grid */
          <div className="flex-1 flex flex-col">
            {/* Header info */}
            <div className="px-3 py-2 flex items-center justify-between">
              <div className="flex items-baseline gap-1.5">
                <h2 className="text-[16px] font-semibold text-[#1F1F1F]">Photos</h2>
                <span className="text-[13px] text-[#5F6368]">({count})</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleInertClick}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F5F6F8] text-xs font-medium text-[#5F6368] hover:bg-[#EEF0F3]"
                >
                  <span>Relevance</span>
                  <span className="material-symbols-outlined text-[14px]">expand_more</span>
                </button>
              </div>
            </div>

            {/* 3-Column Photo Grid */}
            <div className="grid grid-cols-3 gap-[2px] bg-[#E3E5E8]/30 pb-20">
              {results.map((photo, index) => {
                const isTopMatch = index === 0;
                const photoHref = forwardStudyParams(
                  `/photo/${photo.id}?from=results&q=${encodeURIComponent(q)}&mode=${mode}`
                );
                return (
                  <Link
                    key={photo.id}
                    href={photoHref}
                    onClick={() => {
                      if (sessionId) {
                        logClientEvent(
                          "photo_opened",
                          { photoId: photo.id, rank: index + 1, query: q },
                          { sessionId, participantId: participantId || undefined, mode }
                        );
                      }
                    }}
                    className="relative aspect-square overflow-hidden group bg-[#F5F6F8] block"
                  >
                    <Image
                      src={photo.src}
                      alt={photo.tag?.one_line || photo.file}
                      fill
                      sizes="33vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />

                    {/* Top Pick Star Badge for #1 result */}
                    {isTopMatch && (
                      <div className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-[#1F6FEB] text-white flex items-center justify-center shadow-md">
                        <span
                          className="material-symbols-outlined text-[14px]"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          star
                        </span>
                      </div>
                    )}

                    {/* Score Metric Pill */}
                    <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-sm text-[10px] font-mono font-medium text-white px-1.5 py-0.5 rounded shadow-sm">
                      {photo.score.toFixed(1)}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          /* S8 Zero Results Fallback */
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
            {/* Ambient Illustration */}
            <div className="w-24 h-24 rounded-full bg-[#EEF0F3] flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[44px] text-[#5F6368]">
                search_off
              </span>
            </div>

            <h3 className="text-[17px] font-semibold text-[#1F1F1F] mb-1">
              No matching photos found
            </h3>
            <p className="text-[13px] text-[#5F6368] max-w-[260px] mb-6">
              We couldn&apos;t find any photos matching &ldquo;{q}&rdquo;. Try another term or explore suggestions:
            </p>

            {/* S8 Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2 mb-6">
              <Link
                href={forwardStudyParams(`/search?mode=${mode}`)}
                className="h-10 px-5 bg-[#1F6FEB] hover:bg-[#1A5DC8] text-white text-xs font-semibold rounded-full flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                <span>Try again</span>
              </Link>
              {mode === "B" && (
                <Link
                  href={forwardStudyParams(`/search?mode=B`)}
                  className="h-10 px-4 bg-white hover:bg-[#F5F6F8] text-[#1F1F1F] border border-[#D5D9E0] text-xs font-medium rounded-full flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#1F6FEB]">
                    smart_toy
                  </span>
                  <span>Back to my questions</span>
                </Link>
              )}
            </div>

            {/* Quick Suggestion Chips */}
            <div className="flex flex-wrap gap-2 justify-center max-w-[300px]">
              {["pool", "beach", "birthday", "hiking", "friends"].map((term) => (
                <button
                  key={term}
                  onClick={() => handleSuggestionClick(term)}
                  className="px-3 py-1.5 rounded-full bg-[#EEF0F3] hover:bg-[#E3E5E8] text-xs font-medium text-[#1F1F1F] transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav onInertClick={handleInertClick} />

      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-center text-sm text-[#5F6368]">Loading results...</div>}>
      <ResultsContent />
    </Suspense>
  );
}
