// src/lib/clientLogger.ts — Client-side Event Logger with LocalStorage Queue
import { EventType, LogEvent, Mode } from "@/types";

const QUEUE_KEY = "gp_offline_events";

/**
 * Logs an event from client-side UI, queuing locally if network fails.
 */
export function logClientEvent(
  type: EventType | string,
  payload: Record<string, unknown> = {},
  meta?: { sessionId?: string; participantId?: string; mode?: Mode }
): void {
  if (typeof window === "undefined") return;

  const event: LogEvent = {
    ts: new Date().toISOString(),
    sessionId: meta?.sessionId || sessionStorage.getItem("study_session_id") || "browse_session",
    participantId: meta?.participantId || sessionStorage.getItem("study_participant_id") || "P00",
    mode: meta?.mode || (sessionStorage.getItem("study_mode") as Mode) || "A",
    type,
    payload,
  };

  // Attempt async fire-and-forget fetch
  fetch("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  })
    .then((res) => {
      if (res.ok) {
        flushQueue();
      } else {
        queueEvent(event);
      }
    })
    .catch(() => {
      queueEvent(event);
    });
}

function queueEvent(event: LogEvent): void {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const queue: LogEvent[] = raw ? JSON.parse(raw) : [];
    queue.push(event);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-50))); // Keep last 50
  } catch {
    // Ignore localStorage errors
  }
}

function flushQueue(): void {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return;
    const queue: LogEvent[] = JSON.parse(raw);
    if (queue.length === 0) return;

    localStorage.removeItem(QUEUE_KEY);

    for (const evt of queue) {
      fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(evt),
      }).catch(() => {});
    }
  } catch {
    // Ignore
  }
}
