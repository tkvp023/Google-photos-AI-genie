// src/lib/eventLogger.ts — Server-side Persistent Event Logger
import fs from "fs";
import path from "path";
import { LogEvent } from "@/types";

const EVENTS_FILE = path.join(process.cwd(), "data", "events.json");

/**
 * Writes an event to persistent storage. Never throws.
 */
export async function writeEvent(event: Partial<LogEvent>): Promise<void> {
  try {
    const fullEvent: LogEvent = {
      ts: event.ts || new Date().toISOString(),
      sessionId: event.sessionId || "default_session",
      participantId: event.participantId || "P00",
      mode: event.mode || "A",
      type: event.type || "unknown",
      payload: event.payload || {},
    };

    let events: LogEvent[] = [];
    if (fs.existsSync(EVENTS_FILE)) {
      try {
        const raw = fs.readFileSync(EVENTS_FILE, "utf-8");
        events = JSON.parse(raw);
      } catch {
        events = [];
      }
    }

    events.push(fullEvent);
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2), "utf-8");
  } catch (err) {
    console.warn("[EventLogger] Failed to write event:", err);
  }
}

/**
 * Reads events from persistent storage, optionally filtered by sessionId.
 */
export async function readEvents(sessionId?: string): Promise<LogEvent[]> {
  try {
    if (!fs.existsSync(EVENTS_FILE)) return [];
    const raw = fs.readFileSync(EVENTS_FILE, "utf-8");
    const events: LogEvent[] = JSON.parse(raw);
    if (sessionId) {
      return events.filter((e) => e.sessionId === sessionId);
    }
    return events;
  } catch (err) {
    console.warn("[EventLogger] Failed to read events:", err);
    return [];
  }
}
