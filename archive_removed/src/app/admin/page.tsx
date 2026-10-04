// src/app/admin/page.tsx — Study Analytics & Session Overview Dashboard with Session Replay
"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { LogEvent } from "@/types";
import { computeSessionMetrics, computePerModeSummary, SessionMetrics } from "@/lib/metrics";

interface ChipAction {
  action: "tapped" | "untapped";
  cueType: string;
  phrase: string;
  queryAfter?: string;
}

interface PhotoOpenAction {
  photoId: string;
  rank?: number;
  secondsFromStart?: number;
  isTarget?: boolean;
}

interface SessionReplay {
  sessionId: string;
  participantId: string;
  mode: string;
  targetId: string;
  isPractice: boolean;
  isVoided: boolean;
  typedTextAtTrigger: string;
  chipActions: ChipAction[];
  finalSubmittedText: string;
  resultCountAtTrigger: number;
  resultCountAtSubmit: number;
  openedPhotos: PhotoOpenAction[];
  outcome: string;
  seconds: number;
  difficultyRating?: number | null;
  satisfactionRating?: number | null;
  chipMatchRating?: number | null;
  chipHelpfulCuetype?: string | null;
}

export default function AdminPage() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [metrics, setMetrics] = useState<SessionMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Replay UI state
  const [showPracticeAndVoided, setShowPracticeAndVoided] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);

  // Check if already authenticated in session
  useEffect(() => {
    if (sessionStorage.getItem("admin_authenticated") === "true") {
      setIsUnlocked(true);
      const savedPin = sessionStorage.getItem("admin_pin");
      if (savedPin) setEnteredPin(savedPin);
    }
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    try {
      const res = await fetch("/api/moderator/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: enteredPin }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setIsUnlocked(true);
        sessionStorage.setItem("admin_authenticated", "true");
        sessionStorage.setItem("admin_pin", enteredPin);
      } else {
        setPinError(data.error || "Invalid PIN");
      }
    } catch {
      setPinError("Verification request failed");
    }
  };

  useEffect(() => {
    if (!isUnlocked) return;
    setLoading(true);
    fetch("/api/log")
      .then((res) => (res.ok ? res.json() : { events: [] }))
      .then((data: { events: LogEvent[] }) => {
        if (data.events) {
          setEvents(data.events);
          const computed = computeSessionMetrics(data.events);
          setMetrics(computed);
        }
      })
      .catch((err) => console.error("Admin fetch error:", err))
      .finally(() => setLoading(false));
  }, [isUnlocked]);

  // Exclude practice and voided sessions from study evaluations
  const validMetrics = useMemo(() => {
    return metrics.filter((m) => !m.isPractice && !m.isVoided);
  }, [metrics]);

  const perModeSummary = useMemo(() => {
    return computePerModeSummary(metrics);
  }, [metrics]);

  // Build Session Replay map from raw events and metrics
  const sessionReplays = useMemo(() => {
    const map = new Map<string, SessionReplay>();

    const grouped = new Map<string, LogEvent[]>();
    for (const e of events) {
      if (!e.sessionId) continue;
      if (!grouped.has(e.sessionId)) grouped.set(e.sessionId, []);
      grouped.get(e.sessionId)!.push(e);
    }

    for (const m of metrics) {
      const sEvents = grouped.get(m.sessionId) || [];
      sEvents.sort((a, b) => new Date(a.ts || 0).getTime() - new Date(b.ts || 0).getTime());

      let typedTextAtTrigger = m.typedTextAtTrigger || m.firstTypedText || "";
      let finalSubmittedText = m.finalSubmittedText || m.firstQueryText || "";
      let resultCountAtTrigger = m.resultsForFirstTyped || 0;
      let resultCountAtSubmit = m.resultsPerFirstQuery || 0;

      const chipActions: ChipAction[] = [];
      const openedPhotos: PhotoOpenAction[] = [];

      let startTime: number | null = null;
      for (const e of sEvents) {
        const ts = e.ts ? new Date(e.ts).getTime() : 0;
        if (e.type === "target_shown" || e.type === "task_start") {
          if (!startTime && ts > 0) startTime = ts;
        }
      }
      if (!startTime && sEvents[0]?.ts) {
        startTime = new Date(sEvents[0].ts).getTime();
      }

      for (const e of sEvents) {
        const ts = e.ts ? new Date(e.ts).getTime() : 0;
        const secondsFromStart =
          startTime && ts >= startTime ? Math.round((ts - startTime) / 1000) : 0;

        if (e.type === "coach_triggered") {
          if (e.payload?.typedTextAtTrigger) typedTextAtTrigger = String(e.payload.typedTextAtTrigger);
          else if (e.payload?.query) typedTextAtTrigger = String(e.payload.query);
          if (e.payload?.candidateCount) resultCountAtTrigger = Number(e.payload.candidateCount);
        }

        if (e.type === "chip_tapped" || e.type === "coach_chip_tapped") {
          chipActions.push({
            action: "tapped",
            cueType: String(e.payload?.cueType || "unknown"),
            phrase: String(e.payload?.phrase || e.payload?.value || ""),
            queryAfter: e.payload?.query ? String(e.payload.query) : undefined,
          });
        }

        if (e.type === "chip_untapped") {
          chipActions.push({
            action: "untapped",
            cueType: String(e.payload?.cueType || "unknown"),
            phrase: String(e.payload?.phrase || e.payload?.value || ""),
            queryAfter: e.payload?.query ? String(e.payload.query) : undefined,
          });
        }

        if (e.type === "search_submitted") {
          if (e.payload?.finalSubmittedText) finalSubmittedText = String(e.payload.finalSubmittedText);
          else if (e.payload?.query) finalSubmittedText = String(e.payload.query);
          if (e.payload?.typedTextAtTrigger) typedTextAtTrigger = String(e.payload.typedTextAtTrigger);
          if (e.payload?.resultsForFirstTyped) resultCountAtTrigger = Number(e.payload.resultsForFirstTyped);
          if (e.payload?.resultsPerFirstQuery) resultCountAtSubmit = Number(e.payload.resultsPerFirstQuery);
        }

        if (e.type === "photo_opened") {
          const photoId = String(e.payload?.photoId || e.payload?.file || "");
          const rank = e.payload?.rank !== undefined ? Number(e.payload.rank) : undefined;
          const isTarget = Boolean(
            e.payload?.isTarget || e.payload?.found || (m.targetId && photoId.includes(m.targetId))
          );
          openedPhotos.push({
            photoId,
            rank,
            secondsFromStart,
            isTarget,
          });
        }
      }

      map.set(m.sessionId, {
        sessionId: m.sessionId,
        participantId: m.participantId,
        mode: m.mode,
        targetId: m.targetId,
        isPractice: m.isPractice,
        isVoided: m.isVoided,
        typedTextAtTrigger,
        chipActions,
        finalSubmittedText,
        resultCountAtTrigger,
        resultCountAtSubmit,
        openedPhotos,
        outcome: m.outcome,
        seconds: m.timeToFindSec,
        difficultyRating: m.difficultyRating,
        satisfactionRating: m.satisfactionRating,
        chipMatchRating: m.chipMatchRating,
        chipHelpfulCuetype: m.chipHelpfulCuetype,
      });
    }

    return map;
  }, [events, metrics]);

  // Filter sessions according to toggle
  const displayedMetrics = useMemo(() => {
    return showPracticeAndVoided
      ? metrics
      : metrics.filter((m) => !m.isPractice && !m.isVoided);
  }, [metrics, showPracticeAndVoided]);

  const formatReplayText = (replay: SessionReplay): string => {
    const lines: string[] = [
      `=== SESSION REPLAY: ${replay.sessionId} ===`,
      `Participant: ${replay.participantId} | Mode: ${replay.mode} | Target: ${replay.targetId}`,
      `Practice: ${replay.isPractice ? "Yes" : "No"} | Voided: ${replay.isVoided ? "Yes" : "No"}`,
      `Outcome: ${replay.outcome.toUpperCase()} in ${replay.seconds}s`,
      ``,
      `1. Typed text at trigger:`,
      `   "${replay.typedTextAtTrigger || "(none)"}"`,
      ``,
      `2. Chips tapped and removed (with cue type):`,
    ];

    if (replay.chipActions.length === 0) {
      lines.push(`   (No chip actions recorded)`);
    } else {
      for (const c of replay.chipActions) {
        lines.push(
          `   - [${c.action.toUpperCase()}] [${c.cueType}] "${c.phrase}"${
            c.queryAfter ? ` -> "${c.queryAfter}"` : ""
          }`
        );
      }
    }

    lines.push(
      ``,
      `3. Final submitted text:`,
      `   "${replay.finalSubmittedText || "(none)"}"`,
      ``,
      `4. Result counts:`,
      `   Trigger: ${replay.resultCountAtTrigger} candidates | Submit: ${replay.resultCountAtSubmit} candidates`,
      ``,
      `5. Opened photos:`,
    );

    if (replay.openedPhotos.length === 0) {
      lines.push(`   (No photos opened)`);
    } else {
      for (const p of replay.openedPhotos) {
        lines.push(
          `   - ${p.photoId}${p.rank !== undefined ? ` (Rank #${p.rank})` : ""}${
            p.secondsFromStart !== undefined ? ` at ${p.secondsFromStart}s` : ""
          }${p.isTarget ? " [TARGET FOUND]" : ""}`
        );
      }
    }

    if (replay.chipMatchRating || replay.chipHelpfulCuetype) {
      lines.push(
        ``,
        `Post-task chip feedback:`,
        `   Match rating: ${replay.chipMatchRating ?? "N/A"}/5 | Most helpful question: ${
          replay.chipHelpfulCuetype ?? "N/A"
        }`
      );
    }

    return lines.join("\n");
  };

  const handleCopyReplay = (replay: SessionReplay, e: React.MouseEvent) => {
    e.stopPropagation();
    const text = formatReplayText(replay);
    if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedSessionId(replay.sessionId);
      setTimeout(() => setCopiedSessionId(null), 2500);
    }
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    setPinError(null);
    try {
      const pinToSend = enteredPin || sessionStorage.getItem("admin_pin") || "";
      const res = await fetch("/api/admin/export.csv", {
        headers: {
          Authorization: `Bearer ${pinToSend.trim()}`,
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Export failed (HTTP ${res.status})`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `study_metrics_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "CSV export failed");
    } finally {
      setIsExporting(false);
    }
  };

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-900 text-white font-sans flex items-center justify-center p-4">
        <form
          onSubmit={handleUnlock}
          className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-2xl max-w-sm w-full space-y-4 text-center"
        >
          <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center mx-auto text-blue-400">
            <span className="material-symbols-outlined text-[24px]">lock</span>
          </div>
          <h2 className="text-base font-semibold">Admin Authentication</h2>
          <p className="text-xs text-slate-400">
            Enter the moderator PIN to view session analytics.
          </p>
          <input
            type="password"
            maxLength={8}
            value={enteredPin}
            onChange={(e) => setEnteredPin(e.target.value)}
            placeholder="PIN"
            autoFocus
            className="w-32 mx-auto bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-center font-mono text-base tracking-widest text-white outline-none focus:border-blue-500"
          />
          {pinError && <p className="text-xs text-red-400">{pinError}</p>}
          <button
            type="submit"
            className="w-full h-10 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            Unlock Dashboard
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header */}
        <header className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Study Metrics &amp; Session Replay Dashboard
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-mono">
                /admin
              </span>
            </h1>
            <p className="text-xs text-slate-400">Google Photos MVP Evaluation Results</p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/moderator"
              className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors"
            >
              Moderator Console
            </Link>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={isExporting}
              className="text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>{isExporting ? "Exporting..." : "Export CSV"}</span>
            </button>
          </div>
        </header>

        {/* Per-Mode Summary Table */}
        <section className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-blue-400">equalizer</span>
              Per-Mode Evaluation Summary (Excludes Practice &amp; Voided)
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              {validMetrics.length} Evaluated Sessions
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/90 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Mode</th>
                  <th className="py-2.5 px-3">Sessions</th>
                  <th className="py-2.5 px-3">Vague Sessions</th>
                  <th className="py-2.5 px-3 text-blue-400">Query Formation Rate</th>
                  <th className="py-2.5 px-3">Avg Res / 1st</th>
                  <th className="py-2.5 px-3">Median Res</th>
                  <th className="py-2.5 px-3 text-emerald-400">Found Rate</th>
                  <th className="py-2.5 px-3">Median TTF</th>
                  <th className="py-2.5 px-3">Genie Trigger</th>
                  <th className="py-2.5 px-3 text-cyan-400">Genie Accepted</th>
                  <th className="py-2.5 px-3">Dismiss Rate</th>
                  <th className="py-2.5 px-3">Ignore Rate</th>
                  <th className="py-2.5 px-3">Text Edit Rate</th>
                  <th className="py-2.5 px-3">Skip Rate</th>
                  <th className="py-2.5 px-3">Prompt Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {[perModeSummary.A, perModeSummary.B, perModeSummary.All].map((s) => (
                  <tr
                    key={s.mode}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      s.mode === "B" ? "bg-blue-950/20" : ""
                    }`}
                  >
                    <td className="py-2.5 px-3 font-sans font-bold">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] ${
                          s.mode === "B"
                            ? "bg-blue-900/60 text-blue-300 border border-blue-700"
                            : s.mode === "A"
                            ? "bg-slate-700 text-slate-300"
                            : "bg-indigo-900/60 text-indigo-200"
                        }`}
                      >
                        {s.mode === "All" ? "Combined" : `Mode ${s.mode}`}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">{s.sessions}</td>
                    <td className="py-2.5 px-3">{s.vagueSessions}</td>
                    <td className="py-2.5 px-3 font-bold text-blue-400">
                      {Math.round(s.queryFormationRate * 100)}%
                    </td>
                    <td className="py-2.5 px-3">{s.avgResultsPerFirstQuery}</td>
                    <td className="py-2.5 px-3">{s.medianResultsPerFirstQuery}</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-400">
                      {Math.round(s.foundRate * 100)}%
                    </td>
                    <td className="py-2.5 px-3">{s.medianTimeToFindSec}s</td>
                    <td className="py-2.5 px-3">{Math.round(s.coachTriggerRate * 100)}%</td>
                    <td className="py-2.5 px-3 font-semibold text-cyan-400">
                      {Math.round(s.coachAcceptanceRate * 100)}%
                    </td>
                    <td className="py-2.5 px-3">{Math.round(s.coachDismissRate * 100)}%</td>
                    <td className="py-2.5 px-3">{Math.round(s.coachIgnoreRate * 100)}%</td>
                    <td className="py-2.5 px-3">{Math.round(s.textEditRate * 100)}%</td>
                    <td className="py-2.5 px-3">{Math.round(s.skipRate * 100)}%</td>
                    <td className="py-2.5 px-3">{Math.round(s.promptEditRate * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Sessions & Replay Table */}
        <section className="bg-slate-800/40 border border-slate-700/60 rounded-2xl overflow-hidden space-y-0">
          <div className="px-5 py-3 border-b border-slate-700/60 flex flex-wrap items-center justify-between gap-3 bg-slate-800/60">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-blue-400">
                  replay
                </span>
                Sessions &amp; Interactive Replay
              </h2>
              <p className="text-[11px] text-slate-400">
                Click any session row to expand its chronological interaction replay.
              </p>
            </div>

            {/* Toggle: Practice and Voided */}
            <label className="flex items-center gap-2 text-xs text-slate-300 font-medium cursor-pointer select-none bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-700">
              <input
                type="checkbox"
                checked={showPracticeAndVoided}
                onChange={(e) => setShowPracticeAndVoided(e.target.checked)}
                className="rounded border-slate-600 text-blue-600 focus:ring-0 cursor-pointer"
              />
              <span>Show Practice &amp; Voided</span>
              <span className="text-[10px] text-slate-500 font-mono">
                ({metrics.length} total)
              </span>
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-700">
                <tr>
                  <th className="py-2.5 px-3 w-8"></th>
                  <th className="py-2.5 px-3">Session</th>
                  <th className="py-2.5 px-2">P-ID</th>
                  <th className="py-2.5 px-2">Mode</th>
                  <th className="py-2.5 px-2">Target</th>
                  <th className="py-2.5 px-3">1st Typed</th>
                  <th className="py-2.5 px-3">Final Submitted</th>
                  <th className="py-2.5 px-2">Chips</th>
                  <th className="py-2.5 px-2">Outcome</th>
                  <th className="py-2.5 px-2">Time</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-500 italic">
                      Loading session metrics &amp; replays...
                    </td>
                  </tr>
                ) : displayedMetrics.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-500 italic">
                      No matching sessions recorded yet. Launch a session via the Moderator Console.
                    </td>
                  </tr>
                ) : (
                  displayedMetrics.map((m) => {
                    const isExpanded = expandedSessionId === m.sessionId;
                    const replay = sessionReplays.get(m.sessionId);
                    const isCopied = copiedSessionId === m.sessionId;

                    return (
                      <React.Fragment key={m.sessionId}>
                        {/* Summary Row */}
                        <tr
                          onClick={() => setExpandedSessionId(isExpanded ? null : m.sessionId)}
                          className={`hover:bg-slate-800/70 transition-colors cursor-pointer ${
                            isExpanded ? "bg-slate-800/90 border-l-4 border-l-blue-500" : ""
                          } ${
                            m.isVoided ? "opacity-40 line-through" : m.isPractice ? "bg-amber-950/20" : ""
                          }`}
                        >
                          <td className="py-2.5 px-3 text-slate-400">
                            <span className="material-symbols-outlined text-[16px] transition-transform">
                              {isExpanded ? "expand_more" : "chevron_right"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-300 truncate max-w-[130px]">
                            {m.sessionId}
                            {m.isPractice && (
                              <span className="ml-1 text-[9px] bg-amber-900/60 text-amber-300 px-1 py-0.2 rounded font-sans">
                                PRACTICE
                              </span>
                            )}
                            {m.isVoided && (
                              <span className="ml-1 text-[9px] bg-red-900/60 text-red-300 px-1 py-0.2 rounded font-sans">
                                VOIDED
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 font-semibold text-white">{m.participantId}</td>
                          <td className="py-2.5 px-2">
                            <span
                              className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                                m.mode === "B"
                                  ? "bg-blue-900/60 text-blue-300 border border-blue-700"
                                  : "bg-slate-700 text-slate-300"
                              }`}
                            >
                              Mode {m.mode}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 font-mono text-slate-300">{m.targetId}</td>
                          <td className="py-2.5 px-3 truncate max-w-[120px]" title={m.firstTypedText}>
                            &ldquo;{m.firstTypedText}&rdquo;
                          </td>
                          <td className="py-2.5 px-3 truncate max-w-[140px]" title={m.finalSubmittedText}>
                            &ldquo;{m.finalSubmittedText}&rdquo;
                          </td>
                          <td className="py-2.5 px-2 font-mono text-[11px]">
                            {m.chipsTappedCount > 0 ? (
                              <span className="text-cyan-400 font-semibold">{m.chipsTappedCount}</span>
                            ) : (
                              <span className="text-slate-500">0</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2">
                            <span
                              className={`px-1.5 py-0.5 rounded font-semibold text-[10px] ${
                                m.outcome === "found"
                                  ? "bg-emerald-900/60 text-emerald-300"
                                  : m.outcome === "timeout"
                                  ? "bg-amber-900/60 text-amber-300"
                                  : "bg-rose-900/60 text-rose-300"
                              }`}
                            >
                              {m.outcome}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 font-mono">{m.timeToFindSec}s</td>
                          <td className="py-2.5 px-3 text-right">
                            {replay && (
                              <button
                                type="button"
                                onClick={(e) => handleCopyReplay(replay, e)}
                                className={`text-[11px] px-2.5 py-1 rounded-md font-semibold transition-all inline-flex items-center gap-1 shadow-xs cursor-pointer ${
                                  isCopied
                                    ? "bg-emerald-600 text-white"
                                    : "bg-slate-700 hover:bg-slate-600 text-slate-200"
                                }`}
                                title="Copy session replay as formatted plain text"
                              >
                                <span className="material-symbols-outlined text-[14px]">
                                  {isCopied ? "check" : "content_copy"}
                                </span>
                                <span>{isCopied ? "Copied" : "Copy"}</span>
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* Expandable Replay Row */}
                        {isExpanded && replay && (
                          <tr className="bg-slate-900/90 border-b border-slate-700/80">
                            <td colSpan={11} className="p-5">
                              <div className="bg-slate-950/80 border border-slate-700/80 rounded-xl p-5 space-y-4 font-sans text-xs">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                  <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px] text-blue-400">
                                      fast_forward
                                    </span>
                                    <h3 className="font-bold text-white text-sm">
                                      Chronological Session Replay: {m.sessionId}
                                    </h3>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      Target {m.targetId} • Mode {m.mode}
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(e) => handleCopyReplay(replay, e)}
                                    className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold cursor-pointer shadow-xs transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">
                                      {isCopied ? "check" : "content_copy"}
                                    </span>
                                    <span>{isCopied ? "Copied to Clipboard!" : "Copy as text"}</span>
                                  </button>
                                </div>

                                {/* Replay Steps (Ordered: 1. Typed at trigger, 2. Chips, 3. Final submit, 4. Counts, 5. Photos & Outcome) */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Step 1: Typed text at trigger */}
                                  <div className="bg-slate-900/90 p-3.5 rounded-lg border border-slate-800 space-y-1">
                                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                      1. Typed Text at Trigger
                                    </div>
                                    <p className="text-sm font-mono text-cyan-300">
                                      &ldquo;{replay.typedTextAtTrigger || "(None typed)"}&rdquo;
                                    </p>
                                  </div>

                                  {/* Step 3: Final Submitted Text */}
                                  <div className="bg-slate-900/90 p-3.5 rounded-lg border border-slate-800 space-y-1">
                                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                      3. Final Submitted Text
                                    </div>
                                    <p className="text-sm font-mono text-emerald-300">
                                      &ldquo;{replay.finalSubmittedText}&rdquo;
                                    </p>
                                  </div>
                                </div>

                                {/* Step 2: Chips tapped and removed (with cue type) */}
                                <div className="bg-slate-900/90 p-3.5 rounded-lg border border-slate-800 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                      2. Chips Tapped &amp; Removed (with Cue Type)
                                    </div>
                                    <span className="text-[11px] font-mono text-slate-400">
                                      {replay.chipActions.length} Actions
                                    </span>
                                  </div>

                                  {replay.chipActions.length === 0 ? (
                                    <p className="text-slate-500 italic text-[11px]">
                                      No chips tapped or removed in this session.
                                    </p>
                                  ) : (
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                      {replay.chipActions.map((c, idx) => (
                                        <div
                                          key={idx}
                                          className="flex items-center gap-2 p-1.5 rounded bg-slate-800/60 font-mono text-[11px]"
                                        >
                                          <span
                                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                              c.action === "tapped"
                                                ? "bg-cyan-900/80 text-cyan-200 border border-cyan-700"
                                                : "bg-rose-900/80 text-rose-200 border border-rose-700"
                                            }`}
                                          >
                                            {c.action.toUpperCase()}
                                          </span>
                                          <span className="px-1 py-0.5 rounded text-[9px] bg-slate-700 text-slate-300 font-sans">
                                            {c.cueType}
                                          </span>
                                          <span className="text-white font-medium">
                                            &ldquo;{c.phrase}&rdquo;
                                          </span>
                                          {c.queryAfter && (
                                            <span className="text-slate-400 text-[10px] truncate ml-auto">
                                              Result prompt: &ldquo;{c.queryAfter}&rdquo;
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Step 4: Result counts at trigger and at submit */}
                                <div className="bg-slate-900/90 p-3.5 rounded-lg border border-slate-800 space-y-2">
                                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                    4. Result Counts (Narrowing Ratio)
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 text-center font-mono">
                                    <div className="bg-slate-800/80 p-2 rounded">
                                      <div className="text-[10px] text-slate-400">At Trigger</div>
                                      <div className="text-base font-bold text-white">
                                        {replay.resultCountAtTrigger}
                                      </div>
                                    </div>
                                    <div className="bg-slate-800/80 p-2 rounded">
                                      <div className="text-[10px] text-slate-400">At Submit</div>
                                      <div className="text-base font-bold text-emerald-400">
                                        {replay.resultCountAtSubmit}
                                      </div>
                                    </div>
                                    <div className="bg-slate-800/80 p-2 rounded">
                                      <div className="text-[10px] text-slate-400">Narrowing Ratio</div>
                                      <div className="text-base font-bold text-cyan-400">
                                        {replay.resultCountAtTrigger > 0
                                          ? (
                                              replay.resultCountAtSubmit / replay.resultCountAtTrigger
                                            ).toFixed(2)
                                          : "1.00"}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Step 5: Opened photos with rank, outcome, and seconds */}
                                <div className="bg-slate-900/90 p-3.5 rounded-lg border border-slate-800 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                      5. Opened Photos with Rank &amp; Outcome
                                    </div>
                                    <span className="font-semibold text-emerald-400 text-xs">
                                      Final: {replay.outcome.toUpperCase()} in {replay.seconds}s
                                    </span>
                                  </div>

                                  {replay.openedPhotos.length === 0 ? (
                                    <p className="text-slate-500 italic text-[11px]">
                                      No photos opened during search.
                                    </p>
                                  ) : (
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                      {replay.openedPhotos.map((p, idx) => (
                                        <div
                                          key={idx}
                                          className={`flex items-center justify-between p-2 rounded font-mono text-[11px] ${
                                            p.isTarget
                                              ? "bg-emerald-950/60 border border-emerald-700 text-emerald-200"
                                              : "bg-slate-800/50 text-slate-300"
                                          }`}
                                        >
                                          <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[15px]">
                                              {p.isTarget ? "verified" : "photo"}
                                            </span>
                                            <span className="font-bold">{p.photoId}</span>
                                            {p.rank !== undefined && (
                                              <span className="text-[10px] text-slate-400">
                                                (Rank #{p.rank})
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {p.secondsFromStart !== undefined && (
                                              <span className="text-slate-400">
                                                at {p.secondsFromStart}s
                                              </span>
                                            )}
                                            {p.isTarget && (
                                              <span className="px-1.5 py-0.2 rounded bg-emerald-800 text-white font-bold text-[9px]">
                                                TARGET FOUND
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Survey Feedback if present */}
                                {(replay.chipMatchRating || replay.chipHelpfulCuetype) && (
                                  <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 flex items-center justify-between text-xs text-slate-300">
                                    <span>
                                      <strong className="text-white">Coach Feedback:</strong> Match Rating:{" "}
                                      <span className="font-bold text-amber-400">
                                        {replay.chipMatchRating ?? "N/A"}/5
                                      </span>
                                    </span>
                                    <span>
                                      Most Helpful:{" "}
                                      <span className="font-bold text-cyan-400">
                                        {replay.chipHelpfulCuetype ?? "N/A"}
                                      </span>
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
