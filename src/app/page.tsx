"use client";

import React, { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, Cloud, ChevronRight } from "lucide-react";
import { TopBar } from "@/components/ui/TopBar";
import { PhotoGrid, PhotoGridItem } from "@/components/ui/PhotoGrid";
import { Toast } from "@/components/ui/Toast";
import { TesterDisclaimer } from "@/components/ui/TesterDisclaimer";
import { LibraryInfoModal } from "@/components/ui/LibraryInfoModal";
import { GenieHintBox } from "@/components/ui/GenieHintBox";

interface MemoryStory {
  id: string;
  title: string;
  subtitle: string;
  photoId: string;
  src: string;
}

function HomeContent() {
  const [photos, setPhotos] = useState<PhotoGridItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLibraryInfoOpen, setIsLibraryInfoOpen] = useState(false);

  const fetchPhotos = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/photos");
      if (!res.ok) {
        throw new Error(`Failed to load: ${res.statusText}`);
      }
      const data = await res.json();
      setPhotos(data.photos || []);
    } catch (err) {
      console.error(err);
      setErrorMessage("Unable to load photos. Try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const handleInertTabClick = (_tabName: string) => {
    setToastMessage("Not part of this prototype");
  };

  // Curate Memories carousel cards from actual loaded photos
  const memories: MemoryStory[] = useMemo(() => {
    if (photos.length === 0) return [];

    const list: MemoryStory[] = [];

    // 1. Recent Highlights (latest photo)
    if (photos[0]) {
      list.push({
        id: "mem_recent",
        title: "Recent highlights",
        subtitle: photos[0].city || "Highlights",
        photoId: photos[0].id,
        src: photos[0].src,
      });
    }

    // 2. Beach/Goa trip
    const beachPhoto = photos.find((p) => p.theme === "beach" || p.city === "Goa");
    if (beachPhoto) {
      list.push({
        id: "mem_beach",
        title: "Trip to Goa",
        subtitle: "Sun & Sand",
        photoId: beachPhoto.id,
        src: beachPhoto.src,
      });
    }

    // 3. Hiking/Munnar adventure
    const hikingPhoto = photos.find((p) => p.theme === "hiking" || p.city === "Munnar");
    if (hikingPhoto) {
      list.push({
        id: "mem_hiking",
        title: "Tea Hills Trek",
        subtitle: "Munnar",
        photoId: hikingPhoto.id,
        src: hikingPhoto.src,
      });
    }

    // 4. Festival/Celebration
    const festPhoto = photos.find((p) => p.theme === "festival" || p.theme === "birthday");
    if (festPhoto) {
      list.push({
        id: "mem_fest",
        title: "Celebrations",
        subtitle: "Gatherings",
        photoId: festPhoto.id,
        src: festPhoto.src,
      });
    }

    return list;
  }, [photos]);

  return (
    <main className="flex-1 flex flex-col bg-white min-h-screen text-[#1F1F1F] select-none pb-20">
      {/* Top Search Pill Header */}
      <TopBar
        onSearchClick={() => {}}
        onInertClick={handleInertTabClick}
        onProfileClick={() => setIsProfileOpen(true)}
      />

      <div className="flex-1 flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24 space-y-3">
            <div className="w-8 h-8 border-3 border-[#E8EAED] border-t-[#1A73E8] rounded-full animate-spin" />
            <p className="text-sm text-[#5F6368] font-medium">Loading your photos...</p>
          </div>
        ) : errorMessage ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <p className="text-sm text-[#D93025] font-medium">{errorMessage}</p>
            <button
              type="button"
              onClick={fetchPhotos}
              className="px-5 py-2.5 bg-[#1A73E8] text-white text-sm font-semibold rounded-full hover:bg-[#1557B0] transition-colors cursor-pointer min-h-[44px]"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* MVP Tester: AI Genie hint box */}
            <GenieHintBox />

            {/* S1: Memories Carousel Strip */}
            {memories.length > 0 && (
              <section className="pt-3 pb-2 px-3 border-b border-[#F1F3F4]">
                <div
                  className="flex gap-2.5 overflow-x-auto no-scrollbar scroll-smooth py-1"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  {memories.map((m) => (
                    <Link
                      key={m.id}
                      href={`/photo/${m.photoId}?from=home`}
                      className="group relative flex-shrink-0 w-28 h-40 rounded-2xl overflow-hidden bg-[#F1F3F4] border border-[#DADCE0] shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer"
                    >
                      <Image
                        src={m.src}
                        alt={m.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="112px"
                      />
                      {/* Gradient Shadow Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      
                      {/* Memory Card Labels */}
                      <div className="absolute bottom-2 left-2 right-2 text-white">
                        <p className="text-[11px] font-medium text-white/80 leading-tight uppercase tracking-wider truncate">
                          {m.subtitle}
                        </p>
                        <p className="text-sm font-semibold text-white leading-tight drop-shadow-sm line-clamp-2">
                          {m.title}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Google Photos Chronological Photo Timeline */}
            <div className="flex-1">
              <PhotoGrid photos={photos} isLoading={isLoading} />
            </div>

            {/* S1 Attribution + A2 Disclaimer + A3 Library Info link */}
            <div className="py-4 px-4 text-center space-y-1">
              <p className="text-sm text-[#5F6368]">Photos from Pixabay. Dates, places, and people are synthetic.</p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href="/about"
                  className="inline-block text-[#1A73E8] hover:underline font-medium min-h-[44px] leading-[44px] text-sm"
                >
                  About &amp; Credits
                </Link>
                <span className="text-[#DADCE0] select-none">·</span>
                <button
                  type="button"
                  onClick={() => setIsLibraryInfoOpen(true)}
                  className="text-[#1A73E8] hover:underline font-medium min-h-[44px] leading-[44px] text-sm cursor-pointer bg-transparent border-none"
                >
                  About this library
                </button>
              </div>
              {/* A2: Tester disclaimer */}
              <TesterDisclaimer />
            </div>
          </>
        )}
      </div>

      {/* A3: About this library modal */}
      <LibraryInfoModal
        isOpen={isLibraryInfoOpen}
        onClose={() => setIsLibraryInfoOpen(false)}
      />

      {/* Google Account Profile & Settings Sheet */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-[#DADCE0] space-y-4 animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            {/* Header: Google Photos & Close Button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-[#1F1F1F]">
                <div className="w-5 h-5 relative flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-5 h-5">
                    <path d="M12 2C12 7.52 7.52 12 2 12C7.52 12 12 16.48 12 22C12 16.48 16.48 12 22 12C16.48 12 12 7.52 12 2Z" fill="#4285F4" opacity="0.9" />
                    <circle cx="12" cy="12" r="3" fill="#EA4335" />
                    <path d="M12 2A10 10 0 0 0 2 12H12V2Z" fill="#EA4335" />
                    <path d="M22 12A10 10 0 0 0 12 2V12H22Z" fill="#FBBC05" />
                    <path d="M12 22A10 10 0 0 0 22 12H12V22Z" fill="#34A853" />
                    <path d="M2 12A10 10 0 0 0 12 22V12H2Z" fill="#4285F4" />
                  </svg>
                </div>
                <span>Google Account</span>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileOpen(false)}
                className="w-11 h-11 rounded-full flex items-center justify-center text-[#5F6368] hover:bg-[#F1F3F4] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Avatar & Info Card */}
            <div className="bg-[#F8F9FA] rounded-2xl p-3 flex items-center gap-3 border border-[#E3E5E8]">
              <div className="w-11 h-11 rounded-full bg-[#1A73E8] text-white flex items-center justify-center text-sm font-bold shadow-xs">
                D
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1F1F1F] truncate">Demo User</p>
                <p className="text-xs text-[#5F6368] truncate">demo.user@example.com</p>
              </div>
            </div>

            {/* Backup & Storage */}
            <div className="space-y-1.5 px-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#5F6368] flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-[#137333]" />
                  Account storage
                </span>
                <span className="font-semibold text-[#1F1F1F]">5.2 GB of 15 GB used</span>
              </div>
              <div className="w-full h-1.5 bg-[#E8EAED] rounded-full overflow-hidden">
                <div className="h-full bg-[#1A73E8] rounded-full w-[34%]" />
              </div>
            </div>

            {/* Navigation Links */}
            <div className="divide-y divide-[#F1F3F4] text-sm pt-1">
              <Link
                href="/about"
                onClick={() => setIsProfileOpen(false)}
                className="flex items-center justify-between py-3 text-[#5F6368] hover:text-[#1A73E8] transition-colors min-h-[44px]"
              >
                <span>About &amp; Synthetic Data Credits</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </main>
  );
}

export default function GooglePhotosHomePage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-sm text-[#5F6368]">Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
