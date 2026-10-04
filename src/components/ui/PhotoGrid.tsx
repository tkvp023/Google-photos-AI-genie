"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";
import { PhotoCard } from "./PhotoCard";

export interface PhotoGridItem {
  id: string;
  file: string;
  theme: string;
  src: string;
  taken_at?: string | null;
  year?: number | null;
  month_name?: string | null;
  event_title?: string | null;
  city?: string | null;
  venue?: string | null;
  people?: string[];
}

interface PhotoGridProps {
  photos: PhotoGridItem[];
  isLoading?: boolean;
}

interface DateGroup {
  key: string;
  title: string;
  subtitle?: string;
  items: PhotoGridItem[];
}

export function PhotoGrid({ photos, isLoading = false }: PhotoGridProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-32 bg-[#e8eaed] rounded-md animate-pulse ml-3 mt-2" />
        <div className="grid grid-cols-3 gap-[2px] w-full">
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square bg-[#f1f3f4] animate-pulse"
            />
          ))}
        </div>
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
          Photos will appear here once loaded.
        </p>
      </div>
    );
  }

  // Check if photos have taken_at date metadata to group by date
  const hasDates = photos.some((p) => Boolean(p.taken_at));

  if (!hasDates) {
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

  // Group photos chronologically by Month & Year
  const groups: DateGroup[] = [];
  const groupMap = new Map<string, DateGroup>();

  for (const photo of photos) {
    let key = "Earlier";
    let title = "Earlier";
    let subtitle: string | undefined = undefined;

    if (photo.taken_at) {
      try {
        const d = new Date(photo.taken_at);
        const month = d.toLocaleString("en-US", { month: "long" });
        const year = d.getFullYear();
        key = `${year}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        title = `${month} ${year}`;
      } catch {
        key = "Other";
        title = "Other";
      }
    }

    if (photo.city) {
      subtitle = photo.venue ? `${photo.venue}, ${photo.city}` : photo.city;
    }

    let group = groupMap.get(key);
    if (!group) {
      group = { key, title, subtitle, items: [] };
      groupMap.set(key, group);
      groups.push(group);
    } else if (!group.subtitle && subtitle) {
      group.subtitle = subtitle;
    }
    group.items.push(photo);
  }

  return (
    <div className="w-full space-y-3 pb-8">
      {groups.map((group) => (
        <section key={group.key} className="w-full">
          {/* Google Photos Timeline Date Header */}
          <div className="flex items-center justify-between px-3 py-2 sticky top-[108px] bg-white/95 backdrop-blur-md z-20 border-b border-[#f1f3f4]/60">
            <div className="flex flex-col min-w-0">
              <span className="text-[13.5px] font-semibold text-[#1f1f1f] tracking-tight truncate">
                {group.title}
              </span>
              {group.subtitle && (
                <span className="text-[11px] text-[#5f6368] font-normal truncate">
                  {group.subtitle}
                </span>
              )}
            </div>

            <button
              type="button"
              className="w-7 h-7 rounded-full flex items-center justify-center text-[#5f6368]/40 hover:text-[#1a73e8] transition-colors cursor-pointer"
              title={`Select photos from ${group.title}`}
              aria-label={`Select photos from ${group.title}`}
            >
              <CheckCircle2 className="w-5 h-5 text-[#5f6368]/40 hover:text-[#1a73e8]" />
            </button>
          </div>

          {/* 3-Column Photo Grid */}
          <div className="grid grid-cols-3 gap-[2px] w-full">
            {group.items.map((photo, index) => (
              <PhotoCard
                key={photo.id || photo.file}
                id={photo.id}
                file={photo.file}
                src={photo.src}
                theme={photo.theme}
                priority={groups.indexOf(group) === 0 && index < 6}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
