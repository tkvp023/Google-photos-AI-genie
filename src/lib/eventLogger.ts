// src/lib/eventLogger.ts — Server-side Persistent Event Logger
import fs from "fs";
import path from "path";
import { LogEvent } from "@/types";

const EVENTS_FILE = path.join(process.cwd(), "data", "events.json");

// Serialized write queue to prevent race conditions during rapid concurrent logging
let writeQueue: Promise<void> = Promise.resolve();

/**
 * Writes an event to persistent storage. Serialized and atomic. Never throws.
 */
export async function writeEvent(event: Partial<LogEvent>): Promise<void> {
  const task = async () => {
    try {
      const fullEvent: LogEvent = {
        ts: typeof event.ts === "string" ? event.ts : new Date().toISOString(),
        sessionId: typeof event.sessionId === "string" ? event.sessionId.slice(0, 128) : "default_session",
        participantId: typeof event.participantId === "string" ? event.participantId.slice(0, 64) : "P00",
        mode: event.mode === "B" ? "B" : "A",
        type: typeof event.type === "string" ? event.type.slice(0, 100) : "unknown",
        payload: event.payload && typeof event.payload === "object" ? event.payload : {},
      };

      const dir = path.dirname(EVENTS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      let events: LogEvent[] = [];
      if (fs.existsSync(EVENTS_FILE)) {
        try {
          const raw = fs.readFileSync(EVENTS_FILE, "utf-8");
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            events = parsed;
          }
        } catch {
          events = [];
        }
      }

      events.push(fullEvent);

      // Atomic write via temp file rename
      const tempFile = `${EVENTS_FILE}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(events, null, 2), "utf-8");
      try {
        fs.renameSync(tempFile, EVENTS_FILE);
      } catch {
        // Fallback for Windows file lock edge case
        fs.copyFileSync(tempFile, EVENTS_FILE);
        try {
          fs.unlinkSync(tempFile);
        } catch {}
      }
    } catch (err) {
      console.warn("[EventLogger] Failed to write event:", err);
    }
  };

  return new Promise((resolve) => {
    writeQueue = writeQueue.then(task).catch((err) => {
      console.warn("[EventLogger] Queue error:", err);
    }).finally(() => {
      resolve();
    });
  });
}

/**
 * Reads events from persistent storage, optionally filtered by sessionId.
 */
export async function readEvents(sessionId?: string): Promise<LogEvent[]> {
  try {
    if (!fs.existsSync(EVENTS_FILE)) return [];
    const raw = fs.readFileSync(EVENTS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    const events: LogEvent[] = Array.isArray(parsed) ? parsed : [];
    if (sessionId) {
      return events.filter((e) => e.sessionId === sessionId);
    }
    return events;
  } catch (err) {
    console.warn("[EventLogger] Failed to read events:", err);
    return [];
  }
}
