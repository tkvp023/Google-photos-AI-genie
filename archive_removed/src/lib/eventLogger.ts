// src/lib/eventLogger.ts — Server-side Persistent Event Logger
import fs from "fs";
import path from "path";
import os from "os";
import { LogEvent } from "@/types";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const BASE_EVENTS_FILE = path.join(DATA_DIR, "events.json");
const TEMP_EVENTS_DIR = path.join(process.env.TEMP || os.tmpdir(), "gp2_temp_data");
const TEMP_EVENTS_FILE = path.join(TEMP_EVENTS_DIR, "events.json");

export function isTestSession(sessionId?: string, participantId?: string, isTestFlag?: boolean): boolean {
  return (
    Boolean(isTestFlag) ||
    process.env.NODE_ENV === "test" ||
    process.env.TEST_MODE === "true" ||
    (typeof participantId === "string" && (
      participantId.startsWith("P_TEST") ||
      participantId.startsWith("P_SIM") ||
      participantId === "TEST" ||
      participantId === "P00"
    )) ||
    (typeof sessionId === "string" && (
      sessionId.startsWith("qa_") ||
      sessionId.startsWith("test_") ||
      sessionId.startsWith("s_practice_") ||
      sessionId.startsWith("s_study_") ||
      sessionId === "default_session"
    ))
  );
}

export function getEventsFilePath(sessionId?: string, participantId?: string, isTestFlag?: boolean): string {
  if (process.env.DATA_DIR) {
    return path.join(process.env.DATA_DIR, "events.json");
  }
  if (isTestSession(sessionId, participantId, isTestFlag)) {
    return TEMP_EVENTS_FILE;
  }
  return BASE_EVENTS_FILE;
}

// Serialized write queue to prevent race conditions during rapid concurrent logging
let writeQueue: Promise<void> = Promise.resolve();

/**
 * Writes an event to persistent storage. Serialized and atomic. Never throws.
 */
export async function writeEvent(event: Partial<LogEvent> & { _isTest?: boolean }): Promise<void> {
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

      const targetFile = getEventsFilePath(fullEvent.sessionId, fullEvent.participantId, event._isTest);
      const dir = path.dirname(targetFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      let events: LogEvent[] = [];
      if (fs.existsSync(targetFile)) {
        try {
          const raw = fs.readFileSync(targetFile, "utf-8");
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
      const tempFile = `${targetFile}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(events, null, 2), "utf-8");
      try {
        fs.renameSync(tempFile, targetFile);
      } catch {
        // Fallback for Windows file lock edge case
        fs.copyFileSync(tempFile, targetFile);
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
export async function readEvents(sessionId?: string, forceTest?: boolean): Promise<LogEvent[]> {
  try {
    let filePath = BASE_EVENTS_FILE;
    if (process.env.DATA_DIR) {
      filePath = path.join(process.env.DATA_DIR, "events.json");
    } else if (
      forceTest ||
      (sessionId && isTestSession(sessionId)) ||
      (!fs.existsSync(BASE_EVENTS_FILE) || fs.readFileSync(BASE_EVENTS_FILE, "utf-8").trim() === "[]")
    ) {
      if (fs.existsSync(TEMP_EVENTS_FILE)) {
        filePath = TEMP_EVENTS_FILE;
      }
    }

    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, "utf-8");
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

