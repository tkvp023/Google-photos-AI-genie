// src/app/not-found.tsx — Custom 404 Screen
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white text-[#1F1F1F] flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="w-16 h-16 rounded-full bg-[#EEF0F3] text-[#5F6368] flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-[32px]">search_off</span>
      </div>

      <h1 className="text-[18px] font-semibold text-[#1F1F1F] mb-1">
        Page Not Found
      </h1>
      <p className="text-[13px] text-[#5F6368] max-w-xs mb-6">
        This screen isn&apos;t part of the Google Photos MVP prototype.
      </p>

      <Link
        href="/"
        className="h-10 px-6 bg-[#1F6FEB] hover:bg-[#1A5DC8] text-white text-xs font-semibold rounded-full flex items-center justify-center shadow-sm transition-colors"
      >
        Return to Photos
      </Link>
    </div>
  );
}
