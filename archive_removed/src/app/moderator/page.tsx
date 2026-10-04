// src/app/moderator/page.tsx — S9 Moderator Console & Study Facilitator
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogEvent, StudyTarget } from "@/types";

export default function ModeratorPage() {
  const router = useRouter();

  // Authentication — PIN starts empty; never pre-filled to avoid leaking into client bundle
  const [pin, setPin] = useState<string>("");
  const [pinError, setPinError] = useState<string | null>(null);

  // Session settings — single Genie experience (no A/B split)
  const [participantId, setParticipantId] = useState<string>("P01");
  const [targetId, setTargetId] = useState<string>("T01");
  const [isPractice, setIsPractice] = useState<boolean>(false);
  const [targets, setTargets] = useState<StudyTarget[]>([]);

  // Logs tail
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Load targets
  useEffect(() => {
    fetch("/api/targets")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: StudyTarget[]) => {
        setTargets(data);
        if (data.length > 0) setTargetId(data[0].id);
      })
      .catch(() => {});
  }, []);

  // Poll latest events
  const fetchLogs = useCallback(() => {
    fetch("/api/log")
      .then((res) => (res.ok ? res.json() : { events: [] }))
      .then((data) => {
        if (data.events) {
          setEvents(data.events);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  // Compute voided session IDs
  const voidedSessionIds = useMemo(() => {
    const sIds = new Set<string>();
    for (const e of events) {
      if (e.type === "session_voided" && e.sessionId) {
        sIds.add(e.sessionId);
      }
    }
    return sIds;
  }, [events]);

  // Active sessions per participant (excluding voided and practice)
  const participantHistory = useMemo(() => {
    const map = new Map<string, { targetId: string }[]>();
    for (const e of events) {
      if (!e.sessionId || voidedSessionIds.has(e.sessionId)) continue;
      if (e.isPractice === true || e.payload?.is_practice === true || e.payload?.isPractice === true) continue;

      const pId = e.participantId || "P01";
      const hist = map.get(pId) || [];
      const tId = String(e.payload?.targetId || "");

      if (tId && !hist.some((h) => h.targetId === tId)) {
        hist.push({ targetId: tId });
      }
      map.set(pId, hist);
    }
    return map;
  }, [events, voidedSessionIds]);

  // Dynamic assignment suggestion: never give same target twice (single Genie experience — no mode selection)
  const suggestedAssignment = useMemo(() => {
    const pClean = participantId.trim().toUpperCase() || "P01";
    const hist = participantHistory.get(pClean) || [];
    const completedTasksCount = hist.length;

    const usedTargetIds = new Set(hist.map((h) => h.targetId));
    const availableTargets = targets.filter((t) => !usedTargetIds.has(t.id));
    const nextTarget = availableTargets.length > 0 ? availableTargets[0] : targets[0];

    return {
      targetId: nextTarget ? nextTarget.id : "T01",
      targetTheme: nextTarget ? nextTarget.theme : "pool",
      taskNumber: completedTasksCount + 1,
      usedCount: usedTargetIds.size,
    };
  }, [participantId, participantHistory, targets]);

  const handleApplySuggested = () => {
    setTargetId(suggestedAssignment.targetId);
  };

  const handleResetTask = () => {
    setIsPractice(false);
    handleApplySuggested();
    setPinError(null);
  };

  const handleVoidSession = async (sId: string) => {
    if (!sId) return;
    if (!confirm(`Are you sure you want to void session ${sId}?\nVoided sessions are preserved in the log but excluded from all analysis and CSV exports.`)) {
      return;
    }

    try {
      await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "session_voided",
          sessionId: sId,
          participantId,
          mode: "genie",
          payload: { voidedAt: new Date().toISOString(), voidedSessionId: sId },
        }),
      });
      fetchLogs();
    } catch (err) {
      console.error("Failed to void session:", err);
    }
  };

  const handleStartTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);

    if (!pin) {
      setPinError("Please enter moderator PIN");
      return;
    }

    try {
      const res = await fetch("/api/moderator/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setPinError("Invalid PIN. Access denied.");
        return;
      }
    } catch {
      setPinError("Moderator verification failed.");
      return;
    }

    // Single Genie experience: mode is always "genie" in the session ID
    const prefix = isPractice ? "s_practice" : "s";
    const sessionId = `${prefix}_${participantId.toLowerCase()}_genie_${Date.now()}`;
    const practiceParam = isPractice ? "&practice=true" : "";

    router.push(
      `/study?step=reveal&session=${encodeURIComponent(sessionId)}&participant=${encodeURIComponent(
        participantId
      )}&mode=B&target=${encodeURIComponent(targetId)}${practiceParam}`
    );
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    setPinError(null);
    try {
      const res = await fetch("/api/admin/export.csv", {
        headers: {
          Authorization: `Bearer ${pin.trim()}`,
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
      const msg = err instanceof Error ? err.message : "CSV export failed";
      setPinError(msg);
    } finally {
      setIsExporting(false);
    }
  };

  const recentSessions = useMemo(() => {
    const list: Array<{ sessionId: string; participantId: string; targetId: string; outcome?: string }> = [];
    const seen = new Set<string>();

    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.sessionId && !seen.has(e.sessionId)) {
        seen.add(e.sessionId);
        list.push({
          sessionId: e.sessionId,
          participantId: e.participantId || "P01",
          targetId: String(e.payload?.targetId || ""),
          outcome: String(e.payload?.outcome || ""),
        });
      }
      if (list.length >= 6) break;
    }
    return list;
  }, [events]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans antialiased p-4 flex flex-col items-center justify-center">
      <main className="w-full max-w-[540px] bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col">
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
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-14 bg-transparent text-center font-mono text-xs text-white outline-none"
                placeholder="PIN"
              />
            </div>
          </div>
        </header>

        {/* Suggested Assignment Protocol Banner */}
        <section className="bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-3 border-b border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-blue-600">psychology</span>
              Suggested Target ({participantId})
            </span>
            <button
              type="button"
              onClick={handleApplySuggested}
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-white border border-blue-200 hover:border-blue-400 px-2 py-0.5 rounded shadow-xs transition-all cursor-pointer"
            >
              Apply Suggestion
            </button>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-blue-100 flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-slate-800">
                Task #{suggestedAssignment.taskNumber}:
              </span>{" "}
              <span className="font-mono text-emerald-600 font-bold">
                Genie ON
              </span>{" "}
              • Target{" "}
              <span className="font-mono font-bold text-slate-800">
                {suggestedAssignment.targetId}
              </span>{" "}
              ({suggestedAssignment.targetTheme})
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              {suggestedAssignment.usedCount} previous used
            </span>
          </div>
        </section>

        {/* Setup Form */}
        <form onSubmit={handleStartTask} className="p-5 space-y-4">
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

          {/* Practice Mode Toggle & Reset Task */}
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPractice}
                onChange={(e) => setIsPractice(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span className="text-xs font-medium text-slate-800">
                Practice Session{" "}
                <span className="text-[10px] text-slate-500 font-normal">
                  (excluded from exports/analytics)
                </span>
              </span>
            </label>

            <button
              type="button"
              onClick={handleResetTask}
              className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer"
            >
              Reset Task
            </button>
          </div>

          {/* Task Flow Note */}
          <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-[11px] text-amber-900 space-y-1">
            <p className="font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px] text-amber-700">info</span>
              <span>Study Protocol Reminder</span>
            </p>
            <p className="text-amber-800 leading-snug">
              Task starts with a <strong>5-second preview</strong> of target {targetId}, then redirects to search with a <strong>180-second countdown</strong>. Target is never viewable again.
            </p>
          </div>

          {/* Error Message */}
          {pinError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-red-600">error</span>
              <span>{pinError}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-1 flex items-center gap-2">
            <button
              type="submit"
              className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">play_arrow</span>
              <span>
                Start Task ({participantId} • Genie ON {isPractice ? "• PRACTICE" : ""})
              </span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={isExporting}
              className="h-11 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>{isExporting ? "Exporting..." : "CSV"}</span>
            </button>
          </div>
        </form>

        {/* Recent Sessions Management (Void Session) */}
        {recentSessions.length > 0 && (
          <section className="bg-slate-50 px-5 py-3 border-t border-slate-200 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
                Recent Sessions &amp; Void Control
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {voidedSessionIds.size} voided
              </span>
            </div>
            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {recentSessions.map((s) => {
                const isVoided = voidedSessionIds.has(s.sessionId);
                return (
                  <div
                    key={s.sessionId}
                    className={`flex items-center justify-between p-2 rounded-lg border text-[11px] font-mono ${
                      isVoided
                        ? "bg-slate-100 border-slate-200 text-slate-400 line-through"
                        : "bg-white border-slate-200 text-slate-700 shadow-xs"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-bold text-slate-900">{s.participantId}</span>
                      <span className="text-emerald-600 font-semibold">Genie</span>
                      <span>{s.targetId}</span>
                      <span className="text-slate-400 truncate max-w-[120px]">{s.sessionId}</span>
                    </div>

                    {!isVoided ? (
                      <button
                        type="button"
                        onClick={() => handleVoidSession(s.sessionId)}
                        className="text-[10px] font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded border border-rose-200 transition-colors cursor-pointer flex-shrink-0"
                      >
                        Void
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">Voided</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Live Event Stream Tail */}
        <section className="bg-slate-950 text-slate-300 p-4 border-t border-slate-800 font-mono text-[11px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 uppercase text-[10px] font-semibold tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Live Event Tail (Latest {Math.min(8, events.length)})
            </span>
            <span className="text-[10px] text-slate-500">Auto-refresh (3s)</span>
          </div>

          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
            {events.length === 0 ? (
              <p className="text-slate-600 italic">No events logged yet.</p>
            ) : (
              events
                .slice(-8)
                .reverse()
                .map((evt, idx) => (
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
