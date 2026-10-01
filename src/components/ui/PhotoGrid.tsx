"use client";

import React from "react";
import { PhotoCard } from "./PhotoCard";

export interface PhotoGridItem {
  id: string;
  file: string;
  theme: string;
  src: string;
}

interface PhotoGridProps {
  photos: PhotoGridItem[];
  isLoading?: boolean;
}

export function PhotoGrid({ photos, isLoading = false }: PhotoGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-[2px] w-full">
        {Array.from({ length: 18 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square bg-[#f1f3f4] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-[#5f6368] min-h-[300px]">
        <div className="w-16 h-16 rounded-full bg-[#f1f3f4] flex items-center justify-center mb-4 text-[#80868b]">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-base font-medium text-[#202124]">No photos in library</p>
        <p className="text-xs text-[#5f6368] mt-1 max-w-[240px]">
          Run the download script or generate sample photos in public/library/ to view the grid.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-[2px] w-full">
      {photos.map((photo, index) => (
        <PhotoCard
          key={photo.id || photo.file}
          id={photo.id}
          file={photo.file}
          src={photo.src}
          theme={photo.theme}
          priority={index < 9}
        />
      ))}
    </div>
  );
}
