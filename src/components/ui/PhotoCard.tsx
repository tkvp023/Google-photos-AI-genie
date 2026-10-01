"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface PhotoCardProps {
  id: string;
  file: string;
  src: string;
  theme?: string;
  priority?: boolean;
}

export function PhotoCard({ id, file, src, priority = false }: PhotoCardProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <Link
      href={`/photo/${encodeURIComponent(id)}`}
      className="relative aspect-square w-full bg-[#e8eaed] overflow-hidden block group select-none active:opacity-90"
      aria-label={`View photo ${file}`}
    >
      {!hasError ? (
        <Image
          src={src}
          alt={file}
          fill
          sizes="(max-width: 430px) 33vw, 140px"
          priority={priority}
          className={`object-cover transition-opacity duration-300 ${
            isLoaded ? "opacity-100" : "opacity-0"
          } group-hover:scale-105 transition-transform duration-200`}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          unoptimized
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#e8eaed] text-[#5f6368] p-2 text-center text-xs">
          <svg
            className="w-6 h-6 text-[#9aa0a6] mb-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="truncate max-w-full text-[10px] text-[#80868b]">{file}</span>
        </div>
      )}
    </Link>
  );
}
