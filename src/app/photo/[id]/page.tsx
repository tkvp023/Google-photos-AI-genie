// src/app/photo/[id]/page.tsx — S7 Fullscreen Photo Viewer & EXIF Drawer
"use client";

import React, { use, useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Share2, Trash2, Heart, Info, MapPin, Calendar, Users, Sparkles } from "lucide-react";
import { Toast } from "@/components/ui/Toast";
import { PhotoItem } from "@/types";

interface PhotoPageProps {
  params: Promise<{ id: string }>;
}

function PhotoViewerContent({ photoId }: { photoId: string }) {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const q = searchParams.get("q");

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [photoData, setPhotoData] = useState<PhotoItem | null>(null);
  const [showInfo, setShowInfo] = useState<boolean>(false);

  const rawId = photoId.replace(/\.[^.]+$/, "");
  const cleanId = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const photoSrc = `/library/${cleanId || "beach_01"}.jpg`;

  useEffect(() => {
    fetch(`/api/photos/${cleanId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.photo) setPhotoData(data.photo);
      })
      .catch(() => {});
  }, [cleanId]);

  const backHref =
    from === "results" && q
      ? `/results?q=${encodeURIComponent(q)}`
      : from === "search"
      ? "/search"
      : "/";

  const handleInertClick = (action: string) => {
    setToastMessage(`${action} is not part of this prototype`);
  };

  return (
    <div className="flex-1 min-h-screen bg-black text-white flex flex-col justify-between select-none">
      {/* Viewer Header */}
      <header className="h-14 px-3 flex items-center justify-between z-20 bg-gradient-to-b from-black/80 to-transparent">
        <Link
          href={backHref}
          className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-white/10 active:bg-white/20 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </Link>
        <div className="text-sm font-mono text-white/80 truncate max-w-[200px]">
          {cleanId}.jpg
        </div>
        <button
          type="button"
          onClick={() => setShowInfo(!showInfo)}
          className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-white/10 active:bg-white/20 transition-colors text-white/80 hover:text-white"
          aria-label="View photo info"
          title="View photo info"
        >
          <Info className="w-5 h-5" />
        </button>
      </header>

      {/* Main Image Display */}
      <main className="flex-1 flex flex-col items-center justify-center relative p-2">
        <div className="relative w-full max-h-[72vh] aspect-square flex items-center justify-center">
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

        {/* Synthetic Info Panel */}
        {showInfo && photoData?.metadata && (
          <div className="absolute inset-x-2 bottom-2 bg-[#1f1612]/95 backdrop-blur-md border border-[#3e2d24] p-4 text-[#f0e6e0] z-30 rounded-2xl shadow-2xl space-y-3 animate-[fadeIn_150ms_ease-out]">
            <div className="flex items-center justify-between border-b border-[#3e2d24] pb-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-[#f59e6c]">
                <Sparkles className="w-4 h-4" />
                <span>Photo Details</span>
              </div>
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                className="text-white/70 hover:text-white text-sm px-3 py-1 rounded-md hover:bg-white/10 min-h-[44px] flex items-center"
              >
                Close
              </button>
            </div>

            {photoData.metadata.event_title && (
              <div className="text-base font-semibold text-white">
                {photoData.metadata.event_title}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2.5 text-sm text-[#d7c3b8]">
              {photoData.metadata.taken_at && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#f59e6c] flex-shrink-0" />
                  <span>
                    {photoData.metadata.month_name} {photoData.metadata.year} • {photoData.metadata.season} ({photoData.metadata.taken_at.slice(0, 10)})
                  </span>
                </div>
              )}

              {photoData.metadata.place && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-[#f59e6c] flex-shrink-0 mt-0.5" />
                  <div>
                    <div>{photoData.metadata.place.venue}, {photoData.metadata.place.city}, {photoData.metadata.place.country}</div>
                    <div className="text-xs text-white/60 font-mono mt-0.5">
                      GPS: {photoData.metadata.place.lat.toFixed(4)}, {photoData.metadata.place.lng.toFixed(4)}
                    </div>
                  </div>
                </div>
              )}

              {photoData.metadata.people && photoData.metadata.people.length > 0 && (
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#f59e6c] flex-shrink-0" />
                  <span>Cast: {photoData.metadata.people.join(", ")}</span>
                </div>
              )}
            </div>

            <div className="pt-1 text-xs text-white/50 border-t border-[#3e2d24]">
              Photos from Pixabay. Dates, places, and people are synthetic.
            </div>
          </div>
        )}
      </main>

      {/* Viewer Bottom Controls */}
      <footer className="h-16 px-6 flex items-center justify-around z-20 bg-gradient-to-t from-black/80 to-transparent">
        <button
          type="button"
          onClick={() => setShowInfo(!showInfo)}
          className="w-11 h-11 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
          aria-label="Info"
          title="Info"
        >
          <Info className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => handleInertClick("Share")}
          className="w-11 h-11 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
          aria-label="Share"
        >
          <Share2 className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => handleInertClick("Favorite")}
          className="w-11 h-11 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
          aria-label="Favorite"
        >
          <Heart className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => handleInertClick("Delete")}
          className="w-11 h-11 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
          aria-label="Delete"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </footer>

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
