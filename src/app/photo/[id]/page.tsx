// src/app/photo/[id]/page.tsx — S7 Fullscreen Photo Viewer & Study Verification
"use client";

import React, { use, useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Share2, Info, Trash2, Heart, Check, Search } from "lucide-react";
import { Toast } from "@/components/ui/Toast";
import { StudyBanner } from "@/components/study/StudyBanner";
import { logClientEvent } from "@/lib/clientLogger";
import { StudyTarget, Mode } from "@/types";

interface PhotoPageProps {
  params: Promise<{ id: string }>;
}

function PhotoViewerContent({ photoId }: { photoId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const q = searchParams.get("q");
  const mode = (searchParams.get("mode") as "A" | "B") || "A";
  const sessionId = searchParams.get("session");
  const participantId = searchParams.get("participant");
  const targetId = searchParams.get("target");

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [targets, setTargets] = useState<StudyTarget[]>([]);

  const cleanId = photoId.replace(/\.[^.]+$/, "");
  const photoSrc = `/library/${cleanId}.jpg`;

  const isStudyMode = Boolean(sessionId && targetId);

  // Load study targets if in study mode
  useEffect(() => {
    if (!isStudyMode) return;
    fetch("/api/targets")
      .then((res) => {
        if (!res.ok) return fetch("/data/targets.json");
        return res;
      })
      .then((res) => res.json())
      .then((data: StudyTarget[]) => setTargets(data))
      .catch(() => {});
  }, [isStudyMode]);

  const forwardStudyParams = (baseUrl: string) => {
    const url = new URL(baseUrl, "http://localhost");
    if (sessionId) url.searchParams.set("session", sessionId);
    if (participantId) url.searchParams.set("participant", participantId);
    if (targetId) url.searchParams.set("target", targetId);
    return `${url.pathname}${url.search}`;
  };

  const backHref = forwardStudyParams(
    from === "results" && q
      ? `/results?q=${encodeURIComponent(q)}&mode=${mode}`
      : `/search?mode=${mode}`
  );

  const handleInertClick = (action: string) => {
    setToastMessage(`${action} is not part of this prototype`);
  };

  const handleVerifyTarget = () => {
    const currentTarget = targets.find((t) => t.id === targetId);
    // Check match by target file or ID
    const isMatch = currentTarget
      ? currentTarget.file === `${cleanId}.jpg` ||
        currentTarget.file.replace(/\.[^.]+$/, "") === cleanId
      : targetId === cleanId;

    if (isMatch) {
      logClientEvent(
        "found",
        { photoId: cleanId, targetId, q },
        { sessionId: sessionId || undefined, participantId: participantId || undefined, mode }
      );
      router.push(
        `/study?step=end&outcome=found&session=${encodeURIComponent(
          sessionId || ""
        )}&participant=${encodeURIComponent(participantId || "")}&mode=${mode}&target=${encodeURIComponent(
          targetId || ""
        )}`
      );
    } else {
      logClientEvent(
        "wrong_open",
        { photoId: cleanId, targetId, q },
        { sessionId: sessionId || undefined, participantId: participantId || undefined, mode }
      );
      setToastMessage("Not the target photo! Keep looking.");
    }
  };

  const handleKeepLooking = () => {
    logClientEvent(
      "wrong_open",
      { photoId: cleanId, targetId, action: "keep_looking", q },
      { sessionId: sessionId || undefined, participantId: participantId || undefined, mode }
    );
    router.push(backHref);
  };

  return (
    <div className="flex-1 min-h-screen bg-black text-white flex flex-col justify-between select-none">
      {/* Sticky Study Timer Banner */}
      <StudyBanner sessionId={sessionId} targetId={targetId} mode={mode} />

      {/* Viewer Header */}
      <header className="h-14 px-3 flex items-center justify-between z-20 bg-gradient-to-b from-black/80 to-transparent">
        <Link
          href={backHref}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 active:bg-white/20 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </Link>
        <div className="text-xs font-mono text-white/70 truncate max-w-[200px]">
          {cleanId}.jpg
        </div>
        <div className="w-10 h-10" />
      </header>

      {/* Main Image Display */}
      <main className="flex-1 flex flex-col items-center justify-center relative p-2">
        <div className="relative w-full max-h-[68vh] aspect-square flex items-center justify-center">
          <Image
            src={photoSrc}
            alt={cleanId}
            fill
            className="object-contain"
            sizes="(max-width: 430px) 100vw, 430px"
            priority
            unoptimized
          />
        </div>

        {/* Info Overlay Panel */}
        {showInfo && (
          <div className="absolute bottom-4 left-4 right-4 bg-black/85 backdrop-blur-md rounded-2xl p-4 text-xs text-white/90 border border-white/10 shadow-2xl z-30 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm text-white">{cleanId}.jpg</span>
              <button
                onClick={() => setShowInfo(false)}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-white/70 mb-1">
              <strong className="text-white">Theme:</strong> {cleanId.split("_")[0]}
            </p>
            <p className="text-white/70">
              <strong className="text-white">Library:</strong> Google Photos MVP Collection
            </p>
          </div>
        )}
      </main>

      {/* Study Mode Action Bar */}
      {isStudyMode ? (
        <footer className="p-3 z-20 bg-gradient-to-t from-black/95 via-black/80 to-transparent flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleVerifyTarget}
              className="flex-1 h-12 bg-[#1F6FEB] hover:bg-[#1A5DC8] active:bg-[#164FA8] text-white rounded-full font-semibold text-[14px] flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <Check className="w-5 h-5 text-white" />
              <span>This is the photo</span>
            </button>
            <button
              type="button"
              onClick={handleKeepLooking}
              className="h-12 px-4 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white rounded-full font-medium text-[13px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Search className="w-4 h-4 text-white/80" />
              <span>Keep looking</span>
            </button>
          </div>
        </footer>
      ) : (
        /* Regular Viewer Bottom Controls */
        <footer className="h-16 px-6 flex items-center justify-around z-20 bg-gradient-to-t from-black/80 to-transparent">
          <button
            type="button"
            onClick={() => handleInertClick("Share")}
            className="p-2 text-white/80 hover:text-white transition-colors"
            aria-label="Share"
          >
            <Share2 className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => handleInertClick("Favorite")}
            className="p-2 text-white/80 hover:text-white transition-colors"
            aria-label="Favorite"
          >
            <Heart className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowInfo(!showInfo)}
            className={`p-2 transition-colors ${
              showInfo ? "text-[#1F6FEB]" : "text-white/80 hover:text-white"
            }`}
            aria-label="Info"
          >
            <Info className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => handleInertClick("Delete")}
            className="p-2 text-white/80 hover:text-white transition-colors"
            aria-label="Delete"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </footer>
      )}

      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
}

export default function PhotoViewerPage({ params }: PhotoPageProps) {
  const resolvedParams = use(params);
  const photoId = decodeURIComponent(resolvedParams.id);

  return (
    <Suspense
      fallback={
        <div className="bg-black min-h-screen text-white flex items-center justify-center text-sm">
          Loading photo...
        </div>
      }
    >
      <PhotoViewerContent photoId={photoId} />
    </Suspense>
  );
}
