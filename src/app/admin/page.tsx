// src/app/admin/page.tsx — Study Analytics & Session Overview Dashboard
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { LogEvent } from "@/types";
import { computeSessionMetrics, SessionMetrics } from "@/lib/metrics";

export default function AdminPage() {
  const [pin, setPin] = useState("1234");
  const [metrics, setMetrics] = useState<SessionMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/log")
      .then((res) => (res.ok ? res.json() : { events: [] }))
      .then((data: { events: LogEvent[] }) => {
        if (data.events) {
          const computed = computeSessionMetrics(data.events);
          setMetrics(computed);
        }
      })
      .catch((err) => console.error("Admin fetch error:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header */}
        <header className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Study Metrics Dashboard
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
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
            <Link
              href="/api/admin/export.csv"
              className="text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
              target="_blank"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Export CSV</span>
            </Link>
          </div>
        </header>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
            <span className="text-xs text-slate-400 uppercase font-semibold">Total Sessions</span>
            <p className="text-2xl font-bold text-white mt-1">{metrics.length}</p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
            <span className="text-xs text-slate-400 uppercase font-semibold">Success Rate</span>
            <p className="text-2xl font-bold text-emerald-400 mt-1">
              {metrics.length > 0
                ? `${Math.round(
                    (metrics.filter((m) => m.outcome === "found").length / metrics.length) * 100
                  )}%`
                : "N/A"}
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
            <span className="text-xs text-slate-400 uppercase font-semibold">Avg Time to Find</span>
            <p className="text-2xl font-bold text-white mt-1">
              {metrics.filter((m) => m.outcome === "found").length > 0
                ? `${Math.round(
                    metrics
                      .filter((m) => m.outcome === "found")
                      .reduce((acc, m) => acc + m.timeToFindSec, 0) /
                      metrics.filter((m) => m.outcome === "found").length
                  )}s`
                : "N/A"}
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
            <span className="text-xs text-slate-400 uppercase font-semibold">Mode B (Coach)</span>
            <p className="text-2xl font-bold text-blue-400 mt-1">
              {metrics.filter((m) => m.mode === "B").length} runs
            </p>
          </div>
        </div>

        {/* Sessions Table */}
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-700/60 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Recorded Sessions</h2>
            <span className="text-xs text-slate-400">{metrics.length} sessions logged</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-700">
                <tr>
                  <th className="py-2.5 px-4">Session</th>
                  <th className="py-2.5 px-3">Participant</th>
                  <th className="py-2.5 px-3">Mode</th>
                  <th className="py-2.5 px-3">Target</th>
                  <th className="py-2.5 px-3">Outcome</th>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Queries</th>
                  <th className="py-2.5 px-3">Difficulty</th>
                  <th className="py-2.5 px-3">Satisfaction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {metrics.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500 italic">
                      No sessions recorded yet. Launch a session via the Moderator Console.
                    </td>
                  </tr>
                ) : (
                  metrics.map((m) => (
                    <tr key={m.sessionId} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-slate-400 truncate max-w-[140px]">
                        {m.sessionId}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-white">{m.participantId}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            m.mode === "B"
                              ? "bg-blue-900/60 text-blue-300 border border-blue-700"
                              : "bg-slate-700 text-slate-300"
                          }`}
                        >
                          Mode {m.mode}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">{m.targetId}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
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
                      <td className="py-2.5 px-3 font-mono">{m.timeToFindSec}s</td>
                      <td className="py-2.5 px-3">{m.queriesCount}</td>
                      <td className="py-2.5 px-3">{m.difficultyRating ? `${m.difficultyRating}/5` : "-"}</td>
                      <td className="py-2.5 px-3">
                        {m.satisfactionRating ? `${m.satisfactionRating}/5` : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
