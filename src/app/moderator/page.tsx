// src/app/moderator/page.tsx — S9 Moderator Console & Study Facilitator
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogEvent, StudyTarget } from "@/types";

const COUNTERBALANCE_SCHEDULE = [
  { pid: "P01", task1: { mode: "A", target: "T01" }, task2: { mode: "B", target: "T02" } },
  { pid: "P02", task1: { mode: "B", target: "T03" }, task2: { mode: "A", target: "T04" } },
  { pid: "P03", task1: { mode: "A", target: "T05" }, task2: { mode: "B", target: "T06" } },
  { pid: "P04", task1: { mode: "B", target: "T01" }, task2: { mode: "A", target: "T03" } },
  { pid: "P05", task1: { mode: "A", target: "T02" }, task2: { mode: "B", target: "T05" } },
];

export default function ModeratorPage() {
  const router = useRouter();

  // Authentication
  const [pin, setPin] = useState<string>("1234");

  // Session settings
  const [participantId, setParticipantId] = useState<string>("P01");
  const [mode, setMode] = useState<"A" | "B">("A");
  const [targetId, setTargetId] = useState<string>("T01");
  const [targets, setTargets] = useState<StudyTarget[]>([]);

  // Logs tail
  const [events, setEvents] = useState<LogEvent[]>([]);

  useEffect(() => {
    // Load targets
    fetch("/api/targets")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: StudyTarget[]) => setTargets(data))
      .catch(() => {});

    // Poll latest events
    const fetchLogs = () => {
      fetch("/api/log")
        .then((res) => (res.ok ? res.json() : { events: [] }))
        .then((data) => {
          if (data.events) {
            setEvents(data.events.slice(-8).reverse());
          }
        })
        .catch(() => {});
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleApplyPreset = (pId: string, m: "A" | "B", tId: string) => {
    setParticipantId(pId);
    setMode(m);
    setTargetId(tId);
  };

  const handleStartTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) {
      alert("Please enter moderator PIN");
      return;
    }

    const sessionId = `s_${participantId.toLowerCase()}_${mode.toLowerCase()}_${Date.now()}`;
    router.push(
      `/study?step=reveal&session=${encodeURIComponent(sessionId)}&participant=${encodeURIComponent(
        participantId
      )}&mode=${mode}&target=${encodeURIComponent(targetId)}`
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans antialiased p-4 flex flex-col items-center justify-center">
      <main className="w-full max-w-[520px] bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <header className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <h1 className="text-sm font-semibold tracking-wide flex items-center gap-2">
                MODERATOR CONSOLE
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  /moderator
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 font-mono">Google Photos MVP Study Facilitator</p>
            </div>
          </div>

          {/* PIN Input & Admin Link */}
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="text-[11px] font-mono text-slate-300 hover:text-white underline"
            >
              Dashboard
            </Link>
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700">
              <span className="text-[10px] font-mono text-slate-400">PIN</span>
              <input
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-10 bg-transparent text-center font-mono text-xs text-white outline-none"
                placeholder="1234"
              />
            </div>
          </div>
        </header>

        {/* Counterbalance Schedule Quick Selectors */}
        <section className="bg-slate-50 px-5 py-3 border-b border-slate-200 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Counterbalance Protocol Schedule
            </span>
            <span className="text-[10px] text-slate-500 font-mono">1-Tap Preset</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5 pt-0.5">
            {COUNTERBALANCE_SCHEDULE.map((s) => (
              <div key={s.pid} className="flex flex-col gap-1 bg-white p-1.5 rounded-lg border border-slate-200 text-center shadow-xs">
                <span className="text-[11px] font-mono font-bold text-slate-800">{s.pid}</span>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(s.pid, s.task1.mode as "A" | "B", s.task1.target)}
                  className={`text-[10px] py-0.5 rounded font-mono transition-colors ${
                    participantId === s.pid && mode === s.task1.mode && targetId === s.task1.target
                      ? "bg-blue-600 text-white font-bold"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }`}
                  title={`Set Task 1: Mode ${s.task1.mode}, ${s.task1.target}`}
                >
                  T1:{s.task1.mode}
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(s.pid, s.task2.mode as "A" | "B", s.task2.target)}
                  className={`text-[10px] py-0.5 rounded font-mono transition-colors ${
                    participantId === s.pid && mode === s.task2.mode && targetId === s.task2.target
                      ? "bg-blue-600 text-white font-bold"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }`}
                  title={`Set Task 2: Mode ${s.task2.mode}, ${s.task2.target}`}
                >
                  T2:{s.task2.mode}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Setup Form */}
        <form onSubmit={handleStartTask} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Participant ID */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Participant ID
              </label>
              <input
                type="text"
                value={participantId}
                onChange={(e) => setParticipantId(e.target.value.toUpperCase())}
                placeholder="P01"
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            {/* Mode Switcher */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Study Mode
              </label>
              <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setMode("A")}
                  className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                    mode === "A" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Mode A (Plain)
                </button>
                <button
                  type="button"
                  onClick={() => setMode("B")}
                  className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                    mode === "B" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Mode B (Coach)
                </button>
              </div>
            </div>
          </div>

          {/* Target Photo Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Target Photo
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-blue-500"
            >
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id} — {t.theme.toUpperCase()} ({t.distinctiveFeature.slice(0, 48)}...)
                </option>
              ))}
            </select>
          </div>

          {/* Consent / Launch Note */}
          <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-[11px] text-amber-900 space-y-1">
            <p className="font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px] text-amber-700">info</span>
              <span>Participant Consent &amp; Task Flow</span>
            </p>
            <p className="text-amber-800 leading-snug">
              Task starts with a <strong>5-second full-screen preview</strong> of target {targetId}, then redirects to search with a <strong>180-second countdown</strong>. Search keystrokes, chip taps, and timing are recorded anonymously.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-1 flex items-center gap-2">
            <button
              type="submit"
              className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">play_arrow</span>
              <span>Start Study Task ({participantId} • Mode {mode})</span>
            </button>
            <Link
              href="/api/admin/export.csv"
              className="h-11 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors"
              target="_blank"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>CSV</span>
            </Link>
          </div>
        </form>

        {/* Live Event Stream Tail */}
        <section className="bg-slate-950 text-slate-300 p-4 border-t border-slate-800 font-mono text-[11px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 uppercase text-[10px] font-semibold tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Live Event Tail (Latest {events.length})
            </span>
            <span className="text-[10px] text-slate-500">Auto-refresh (3s)</span>
          </div>

          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
            {events.length === 0 ? (
              <p className="text-slate-600 italic">No events logged yet.</p>
            ) : (
              events.map((evt, idx) => (
                <div key={idx} className="flex items-start gap-2 text-slate-400">
                  <span className="text-slate-600 flex-shrink-0">
                    {evt.ts ? evt.ts.split("T")[1]?.slice(0, 8) : "--:--:--"}
                  </span>
                  <span className="text-blue-400 font-semibold flex-shrink-0">[{evt.type}]</span>
                  <span className="truncate text-slate-300">
                    {JSON.stringify(evt.payload || {})}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
