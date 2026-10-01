"use client";

import React, { useEffect, useState, useCallback } from "react";
import { TopBar } from "@/components/ui/TopBar";
import { BottomNav } from "@/components/ui/BottomNav";
import { PhotoGrid, PhotoGridItem } from "@/components/ui/PhotoGrid";
import { Toast } from "@/components/ui/Toast";

export default function PhotosHomePage() {
  const [photos, setPhotos] = useState<PhotoGridItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  return (
    <main className="flex-1 flex flex-col min-h-screen bg-white">
      {/* S1: Top App Bar */}
      <TopBar onInertClick={handleInertTabClick} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {errorMessage ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <p className="text-sm text-[#d93025] font-medium mb-3">{errorMessage}</p>
            <button
              onClick={fetchPhotos}
              className="px-4 py-2 bg-[#1a73e8] text-white text-xs font-medium rounded-full shadow hover:bg-[#1557b0] transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex-1 pb-4">
            <PhotoGrid photos={photos} isLoading={isLoading} />
          </div>
        )}
      </div>

      {/* S1: Bottom Navigation Bar */}
      <BottomNav onInertClick={handleInertTabClick} />

      {/* Toast Feedback */}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </main>
  );
}
