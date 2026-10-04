// src/app/about/page.tsx — S12 About & Credits
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ExternalLink, ShieldCheck, Heart, Search, Sparkles } from "lucide-react";
import { CreditRow } from "@/types";

export default function AboutPage() {
  const [credits, setCredits] = useState<CreditRow[]>([]);
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [selectedTheme, setSelectedTheme] = useState<string>("all");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetch("/api/credits")
      .then((res) => (res.ok ? res.json() : { credits: [] }))
      .then((data) => {
        if (data.credits) {
          setCredits(data.credits);
        }
      })
      .catch((err) => console.error("Failed to load credits:", err))
      .finally(() => setLoading(false));
  }, []);

  const themes = ["all", ...Array.from(new Set(credits.map((c) => c.theme)))];

  const filteredCredits = credits.filter((c) => {
    const matchesSearch =
      searchFilter === "" ||
      c.photographer.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.file.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.theme.toLowerCase().includes(searchFilter.toLowerCase());

    const matchesTheme = selectedTheme === "all" || c.theme === selectedTheme;

    return matchesSearch && matchesTheme;
  });

  return (
    <div className="flex-1 min-h-screen bg-[#F8F9FA] text-[#1F1F1F] flex flex-col antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-3 h-14 flex items-center border-b border-[#E3E5E8]/80 shadow-xs">
        <Link
          href="/"
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#F5F6F8] active:bg-[#EEF0F3] text-[#1F1F1F] transition-colors -ml-1"
          aria-label="Back to photos"
        >
          <ArrowLeft className="w-5 h-5 text-[#1F1F1F]" />
        </Link>
        <div className="ml-2 flex-1 min-w-0">
          <h1 className="text-[17px] font-semibold text-[#1F1F1F] tracking-tight">
            About &amp; Credits
          </h1>
          <p className="text-[11px] text-[#5F6368] truncate">Google Photos MVP Prototype (S12)</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-4 space-y-4 max-w-2xl mx-auto w-full">
        {/* Project Disclaimer & Purpose Banner */}
        <section className="bg-white rounded-2xl p-4 border border-[#E3E5E8] shadow-sm space-y-2.5">
          <div className="flex items-center gap-2 text-[#1F6FEB]">
            <ShieldCheck className="w-5 h-5 flex-shrink-0" />
            <h2 className="text-[15px] font-semibold text-[#1F1F1F]">Prototype Notice</h2>
          </div>
          <p className="text-[13px] text-[#3C4043] leading-relaxed">
            This application is an educational prototype developed for a product-management case study evaluating
            an AI-assisted <em>&ldquo;Pre-Search Narrow It Down Genie&rdquo;</em> experience.
          </p>
          <div className="bg-[#FEF7E0] text-[#7A4100] text-xs px-3 py-2 rounded-xl border border-[#FEEFC3] leading-snug">
            <strong>Disclaimer:</strong> This project is an independent research concept and is{" "}
            <strong>not affiliated with, endorsed by, or sponsored by Google LLC</strong>.
          </div>
        </section>

        {/* Synthetic Metadata Disclosure & Privacy */}
        <section className="bg-white rounded-2xl p-4 border border-[#E3E5E8] shadow-sm space-y-2.5">
          <div className="flex items-center gap-2 text-[#8430CE]">
            <Sparkles className="w-5 h-5 flex-shrink-0" />
            <h2 className="text-[15px] font-semibold text-[#1F1F1F]">Synthetic Metadata Disclosure</h2>
          </div>
          <p className="text-[13px] text-[#3C4043] leading-relaxed">
            All photo dates, timestamps, places with GPS coordinates, people names, and event titles in this prototype are <strong>100% synthetic</strong>, deterministically generated for this research evaluation. No real personal data or participant photos are used.
          </p>
          <div className="bg-[#F3E8FD] text-[#581C87] text-xs p-3 rounded-xl border border-[#E9D5FF] space-y-1.5 leading-relaxed">
            <p className="font-semibold">How metadata was generated:</p>
            <ul className="list-disc pl-4 space-y-1 text-[12px]">
              <li><strong>Story Events:</strong> 30 fictional event records spanning Jan 2019 to Sep 2026 across Indian cities (Goa, Pondicherry, Bengaluru, Chennai, Hyderabad, Munnar, Ooty, Coorg, Manali) with realistic venue GPS coordinates.</li>
              <li><strong>Fictional Cast:</strong> 8 fictional character names (Aarav, Priya, Rohan, Ananya, Vikram, Meera, Kavita, Arjun) with assigned relationships. No facial recognition or biometric identification is used.</li>
              <li><strong>Deterministic Assignment:</strong> Photos were seeded and mapped to events matching their visual theme, season, and group type with 0 contradictions.</li>
            </ul>
          </div>
        </section>

        {/* License Statement Card */}
        <section className="bg-white rounded-2xl p-4 border border-[#E3E5E8] shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-[#137333]">
            <Heart className="w-4 h-4 flex-shrink-0 text-red-500 fill-red-500" />
            <h2 className="text-[14px] font-semibold text-[#1F1F1F]">Photo Licenses &amp; Attribution</h2>
          </div>
          <p className="text-[12px] text-[#5F6368] leading-relaxed">
            All stock library photographs are sourced from <strong>Pixabay</strong> (including photographer contributions from Pexels on Pixabay). Photos are used under the Pixabay Content License (free for personal and research evaluation use).
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <a
              href="https://pixabay.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-[#1F6FEB] hover:underline"
            >
              Photos from Pixabay
            </a>
            <span>•</span>
            <a
              href="https://pixabay.com/service/license-summary/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1F6FEB] hover:underline bg-[#E8F0FE] px-2.5 py-1 rounded-full"
            >
              <span>Pixabay License</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </section>

        {/* Credits Directory */}
        <section className="bg-white rounded-2xl border border-[#E3E5E8] shadow-sm overflow-hidden flex flex-col">
          {/* Section Header & Search */}
          <div className="p-4 border-b border-[#E3E5E8] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-[#1F1F1F]">
                Photographer Credits ({filteredCredits.length}/{credits.length})
              </h2>
              <span className="text-xs font-mono text-[#5F6368] bg-[#F1F3F4] px-2 py-0.5 rounded-full">
                10 Themes
              </span>
            </div>

            {/* Filter Search Input */}
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-[#5F6368] absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search photographer or file..."
                className="w-full h-10 pl-9 pr-3 text-xs bg-[#F1F3F4] rounded-xl border border-transparent focus:border-[#1F6FEB] focus:bg-white outline-none transition-all"
              />
            </div>

            {/* Theme Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {themes.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedTheme(t)}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-full capitalize whitespace-nowrap transition-colors ${
                    selectedTheme === t
                      ? "bg-[#1F6FEB] text-white"
                      : "bg-[#F1F3F4] text-[#5F6368] hover:bg-[#E8EAED]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Credits Table / List */}
          <div className="divide-y divide-[#E3E5E8] max-h-[460px] overflow-y-auto">
            {loading ? (
              <div className="py-12 text-center text-xs text-[#5F6368]">Loading credits...</div>
            ) : filteredCredits.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#5F6368]">No photographers found.</div>
            ) : (
              filteredCredits.map((item) => (
                <div
                  key={item.file}
                  className="p-3 flex items-center gap-3 hover:bg-[#F8F9FA] transition-colors"
                >
                  {/* Photo Thumbnail */}
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-[#E8EAED] flex-shrink-0">
                    <Image
                      src={`/library/${item.file}`}
                      alt={item.file}
                      fill
                      sizes="48px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-medium text-[#1F1F1F] truncate">
                        {item.photographer}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#EEF0F3] text-[#5F6368] uppercase">
                        {item.theme}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-[#5F6368] truncate">{item.file}</p>
                  </div>

                  {/* External Link */}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#5F6368] hover:text-[#1F6FEB] hover:bg-[#E8F0FE] transition-colors flex-shrink-0"
                    aria-label={`View photo by ${item.photographer}`}
                    title="View original photo"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Quick Navigation Links */}
        <section className="pt-2 pb-6 flex items-center justify-center gap-4 text-xs text-[#5F6368]">
          <Link href="/" className="hover:text-[#1F6FEB] underline">
            Home Gallery
          </Link>
          <span>•</span>
          <Link href="/search" className="hover:text-[#1F6FEB] underline">
            Search
          </Link>
          <span>•</span>
          <Link href="/moderator" className="hover:text-[#1F6FEB] underline">
            Moderator Console
          </Link>
          <span>•</span>
          <Link href="/admin" className="hover:text-[#1F6FEB] underline">
            Admin Metrics
          </Link>
        </section>
      </main>
    </div>
  );
}
