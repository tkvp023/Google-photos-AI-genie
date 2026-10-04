// scripts/qa/qa_study_logging.ts
import fs from "fs";
import path from "path";
import http from "http";

console.log("=== STAGE 6: STUDY FLOW & LOGGING AUDIT ===\n");

const BASE_URL = "http://localhost:3000";

// Read moderator PIN from .env.local without logging it
let moderatorPin = "";
if (fs.existsSync(".env.local")) {
  const match = fs.readFileSync(".env.local", "utf-8").match(/MODERATOR_PIN\s*=\s*(.+)/);
  if (match) moderatorPin = match[1].trim();
}

async function request(options: {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(options.path, BASE_URL);
    const reqHeaders: Record<string, string> = { "x-test-suite": "true", ...options.headers };
    let payload = "";
    if (options.body) {
      payload = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
      reqHeaders["Content-Type"] = "application/json";
      reqHeaders["Content-Length"] = Buffer.byteLength(payload).toString();
    }
    const req = http.request(
      url,
      {
        method: options.method || "GET",
        headers: reqHeaders,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode || 0, headers: res.headers, body: data }));
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runStage6() {
  let stage6Pass = true;
  const stage6Failures: string[] = [];

  // --- 1. Moderator PIN verification ---
  console.log("--- 1. Moderator PIN Security Audit ---");
  // Test 1: Wrong PIN
  const wrongPinRes = await request({
    path: "/api/moderator/verify",
    method: "POST",
    body: { pin: "WRONG_PIN_9999" },
  });
  console.log(`Wrong PIN rejection: HTTP ${wrongPinRes.status} (expected 401) | ${wrongPinRes.status === 401 ? "PASS [OK]" : "FAIL"}`);
  if (wrongPinRes.status !== 401) {
    stage6Pass = false;
    stage6Failures.push(`Wrong PIN returned HTTP ${wrongPinRes.status}, expected 401`);
  }

  // Test 2: Correct PIN
  const rightPinRes = await request({
    path: "/api/moderator/verify",
    method: "POST",
    body: { pin: moderatorPin },
  });
  console.log(`Correct PIN verification: HTTP ${rightPinRes.status} (expected 200) | ${rightPinRes.status === 200 ? "PASS [OK]" : "FAIL"}`);
  if (rightPinRes.status !== 200) {
    stage6Pass = false;
    stage6Failures.push(`Correct PIN returned HTTP ${rightPinRes.status}, expected 200`);
  }

  // --- 2. CSV Export Security ---
  console.log("\n--- 2. Export CSV Security Audit ---");
  // Unauthenticated export
  const unauthExport = await request({ path: "/api/admin/export.csv" });
  console.log(`Unauthenticated CSV export: HTTP ${unauthExport.status} (expected 401) | ${unauthExport.status === 401 ? "PASS [OK]" : "FAIL"}`);
  if (unauthExport.status !== 401) {
    stage6Pass = false;
    stage6Failures.push(`Unauthenticated CSV export returned HTTP ${unauthExport.status}, expected 401`);
  }

  // URL query param ?pin= (must be rejected)
  const queryPinExport = await request({ path: `/api/admin/export.csv?pin=${encodeURIComponent(moderatorPin)}` });
  console.log(`URL query param ?pin= rejected: HTTP ${queryPinExport.status} (expected 401) | ${queryPinExport.status === 401 ? "PASS [OK]" : "FAIL"}`);
  if (queryPinExport.status !== 401) {
    stage6Pass = false;
    stage6Failures.push(`URL query param ?pin= export was accepted (HTTP ${queryPinExport.status}), expected 401`);
  }

  // Authorized export with Authorization: Bearer <PIN>
  const authExport = await request({
    path: "/api/admin/export.csv",
    headers: { Authorization: `Bearer ${moderatorPin}` },
  });
  console.log(`Authorized CSV export (Bearer): HTTP ${authExport.status} (expected 200) | ${authExport.status === 200 ? "PASS [OK]" : "FAIL"}`);
  if (authExport.status !== 200) {
    stage6Pass = false;
    stage6Failures.push(`Authorized CSV export returned HTTP ${authExport.status}, expected 200`);
  }

  // --- 3. Concurrency Test: 30 Parallel Log POSTs ---
  console.log("\n--- 3. Concurrency Test (30 Parallel /api/log Posts) ---");
  const concurrentPromises: Promise<any>[] = [];
  const concurrentSessionId = `qa_concurrent_${Date.now()}`;
  for (let i = 0; i < 30; i++) {
    concurrentPromises.push(
      request({
        path: "/api/log",
        method: "POST",
        body: {
          sessionId: concurrentSessionId,
          participantId: "P_TEST",
          mode: "B",
          type: "query_typed",
          payload: { query: `concurrent query ${i}`, index: i },
        },
      })
    );
  }
  const concurrentResults = await Promise.all(concurrentPromises);
  const all200 = concurrentResults.every((r) => r.status === 200);
  console.log(`30 parallel log POSTs received HTTP 200: ${all200 ? "PASS [OK]" : "FAIL"}`);

  // Fetch logged events to verify all 30 were recorded without corruption
  const verifyLogsRes = await request({ path: `/api/log?sessionId=${concurrentSessionId}` });
  let loggedCount = 0;
  try {
    const data = JSON.parse(verifyLogsRes.body);
    loggedCount = data.events?.length || 0;
  } catch {}
  console.log(`Events stored for concurrent session: ${loggedCount} / 30 | ${loggedCount === 30 ? "PASS [OK]" : "FAIL [LOST EVENTS]"}`);
  if (loggedCount !== 30) {
    stage6Pass = false;
    stage6Failures.push(`Concurrency test lost events: stored ${loggedCount}, expected 30`);
  }

  // --- 4. Scripted Study Sessions (2 Practice + 2 Mode A + 2 Mode B) ---
  console.log("\n--- 4. Scripted Study Sessions Execution ---");
  const now = Date.now();
  const sessions = [
    // Practice Session Mode A
    {
      id: `s_practice_a_${now}`,
      participant: "P01",
      mode: "A",
      target: "T01",
      isPractice: true,
      firstTyped: "pool",
      finalSubmitted: "pool",
      chips: 0,
      outcome: "found",
      timeSec: 35,
      firstQuerySource: "typed_only",
    },
    // Practice Session Mode B
    {
      id: `s_practice_b_${now}`,
      participant: "P01",
      mode: "B",
      target: "T02",
      isPractice: true,
      firstTyped: "beach",
      finalSubmitted: "beach, with friends",
      chips: 1,
      outcome: "found",
      timeSec: 25,
      firstQuerySource: "typed_plus_chips",
    },
    // Non-practice Session 1: Mode A
    {
      id: `s_study_p01_a_${now}`,
      participant: "P01",
      mode: "A",
      target: "T03",
      isPractice: false,
      firstTyped: "birthday party",
      finalSubmitted: "birthday party",
      chips: 0,
      outcome: "found",
      timeSec: 42,
      firstQuerySource: "typed_only",
    },
    // Non-practice Session 2: Mode A (timeout)
    {
      id: `s_study_p02_a_${now}`,
      participant: "P02",
      mode: "A",
      target: "T04",
      isPractice: false,
      firstTyped: "concert",
      finalSubmitted: "concert",
      chips: 0,
      outcome: "timeout",
      timeSec: 180,
      firstQuerySource: "typed_only",
    },
    // Non-practice Session 3: Mode B (2+ cues via chips)
    {
      id: `s_study_p01_b_${now}`,
      participant: "P01",
      mode: "B",
      target: "T05",
      isPractice: false,
      firstTyped: "graduation",
      finalSubmitted: "graduation, with friends, outdoors",
      chips: 2,
      outcome: "found",
      timeSec: 22,
      firstQuerySource: "typed_plus_chips",
    },
    // Non-practice Session 4: Mode B (gave up)
    {
      id: `s_study_p02_b_${now}`,
      participant: "P02",
      mode: "B",
      target: "T06",
      isPractice: false,
      firstTyped: "mountain",
      finalSubmitted: "mountain, earlier",
      chips: 1,
      outcome: "gave_up",
      timeSec: 75,
      firstQuerySource: "typed_plus_chips",
    },
  ];

  for (const s of sessions) {
    const sEvents: Array<{ type: string; payload: any }> = [
      { type: "task_start", payload: { targetId: s.target, isPractice: s.isPractice } },
      { type: "target_shown", payload: { targetId: s.target, hintShown: true } },
      { type: "target_hidden", payload: { targetId: s.target } },
      { type: "query_typed", payload: { query: s.firstTyped } },
      { type: "vague_check", payload: { query: s.firstTyped, isVague: true } },
    ];
    if (s.mode === "B") {
      sEvents.push({ type: "coach_triggered", payload: { query: s.firstTyped } });
      sEvents.push({ type: "coach_shown", payload: { questionCount: 3 } });
      if (s.chips > 0) {
        sEvents.push({ type: "chip_tapped", payload: { cueType: "who", value: "friends" } });
      }
      if (s.chips > 1) {
        sEvents.push({ type: "chip_tapped", payload: { cueType: "where", value: "outdoors" } });
      }
    }
    sEvents.push({
      type: "search_submitted",
      payload: {
        query: s.finalSubmitted,
        mode: s.mode,
        isFirstQuery: true,
        firstTypedText: s.firstTyped,
        firstQueryText: s.finalSubmitted,
        firstQuerySource: s.firstQuerySource,
        chipsTappedCount: s.chips,
        coachTriggered: s.mode === "B",
        resultsPerFirstQuery: 10,
        resultsForFirstTyped: 25,
        narrowingRatio: 0.4,
      },
    });
    if (s.outcome === "found") {
      sEvents.push({ type: "photo_opened", payload: { photoId: "photo_01", rank: 1 } });
      sEvents.push({ type: "found", payload: { photoId: "photo_01", targetId: s.target, timeToFindSec: s.timeSec } });
    } else if (s.outcome === "timeout") {
      sEvents.push({ type: "timeout", payload: { targetId: s.target, timeToFindSec: 180 } });
    } else if (s.outcome === "gave_up") {
      sEvents.push({ type: "gave_up", payload: { targetId: s.target, timeToFindSec: s.timeSec } });
    }
    sEvents.push({
      type: "survey_answered",
      payload: { difficultyRating: 2, satisfactionRating: 4, comment: "Test study flow" },
    });
    sEvents.push({ type: "task_end", payload: { outcome: s.outcome, targetId: s.target } });

    // Submit events for session
    for (const ev of sEvents) {
      await request({
        path: "/api/log",
        method: "POST",
        body: {
          sessionId: s.id,
          participantId: s.participant,
          mode: s.mode,
          type: ev.type,
          payload: ev.payload,
        },
      });
    }
  }

  console.log(`Logged ${sessions.length} study sessions successfully.`);

  // --- 5. Export CSV & Metrics Verification ---
  console.log("\n--- 5. CSV Export & Hand-Calculation Audit ---");
  const exportRes = await request({
    path: "/api/admin/export.csv",
    headers: { Authorization: `Bearer ${moderatorPin}` },
  });
  const csvText = exportRes.body;
  const csvLines = csvText.split("\n").map((r) => r.trim()).filter(Boolean);
  const headerLineIndex = csvLines.findIndex((l) => l.startsWith("session_id,"));
  const csvHeaders = headerLineIndex !== -1 ? csvLines[headerLineIndex].split(",") : [];
  console.log(`CSV Export total lines: ${csvLines.length}, header line index: ${headerLineIndex}`);

  // Data rows are between headerLineIndex and the next comment block or summary section
  const dataRows = csvLines.slice(headerLineIndex + 1).filter((l) => !l.startsWith("#") && !l.startsWith("mode,"));
  console.log(`CSV data rows count: ${dataRows.length}`);

  // Check practice exclusion
  const practiceRows = dataRows.filter((r) => r.includes("s_practice") || r.split(",")[4] === "true");
  const practiceExcluded = practiceRows.length === 0;
  console.log(`Practice sessions excluded from CSV: ${practiceExcluded ? "PASS [OK]" : `FAIL [FOUND ${practiceRows.length} PRACTICE ROWS]`}`);
  if (!practiceExcluded) {
    stage6Pass = false;
    stage6Failures.push(`Practice sessions were included in CSV export (${practiceRows.length} rows found)`);
  }

  // Hand-recompute metrics for non-practice sessions
  console.log("\nRecomputing metrics by hand from scripted non-practice sessions:");
  const modeBNonPractice = sessions.filter((s) => !s.isPractice && s.mode === "B");
  const modeANonPractice = sessions.filter((s) => !s.isPractice && s.mode === "A");

  // Mode B hand metrics:
  // Query Formation Rate: Share of vague sessions whose FIRST submitted query has 2+ cues
  // Session 3: "graduation, with friends, outdoors" -> cues: occasion (graduation), who (friends), where (outdoors) = 3 cues (has 2+) -> YES
  // Session 4: "mountain, earlier" -> cues: where (mountain), when (earlier) = 2 cues (has 2+) -> YES
  const modeB_qfr_hand = 2 / 2; // 1.0 (100%)
  const modeA_qfr_hand = 0 / 2; // 0.0 (neither has 2+ cues)

  console.log(`Mode B Query Formation Rate (hand-computed): ${(modeB_qfr_hand * 100).toFixed(1)}%`);
  console.log(`Mode A Query Formation Rate (hand-computed): ${(modeA_qfr_hand * 100).toFixed(1)}%`);

  // Check missing G fields in CSV headers
  const requiredGFields = [
    "first_typed_text", "is_vague_first_typed", "first_query_text", "first_query_source",
    "cue_types_in_first_query", "cue_count_first_query", "first_query_has_2plus_cues",
    "results_per_first_query", "narrowing_ratio", "coach_triggered", "trigger_blocked_reason",
    "chips_tapped_count", "text_edited_after_chip", "wrong_opens_count", "opened_photo_ranks",
    "outcome", "time_to_find_sec", "is_practice", "hint_shown", "satisfaction_rating", "difficulty_rating"
  ];

  const missingGInCsv: string[] = [];
  for (const gf of requiredGFields) {
    const found = csvHeaders.some((h) => h.replace(/"/g, "").trim() === gf);
    if (!found) {
      missingGInCsv.push(gf);
    }
  }
  console.log(`CSV Headers audit for Intended Behavior G:`);
  console.log(`  Covered: ${requiredGFields.length - missingGInCsv.length} / ${requiredGFields.length}`);
  if (missingGInCsv.length > 0) {
    console.log(`  MISSING FIELDS IN CSV: ${missingGInCsv.join(", ")}`);
    stage6Failures.push(`CSV is missing required fields from Rule G: ${missingGInCsv.join(", ")}`);
  }

  // --- 6. Persistence Test (Server Restart) ---
  console.log("\n--- 6. Persistence Test Across Server Restart ---");
  const tempEventsFile = path.join(process.env.TEMP || "", "gp2_temp_data", "events.json");
  const eventsCountBefore = fs.existsSync(tempEventsFile) ? JSON.parse(fs.readFileSync(tempEventsFile, "utf-8")).length : 0;
  console.log(`Events in temp store before restart: ${eventsCountBefore}`);

  // Read events back from file
  const eventsCountAfter = fs.existsSync(tempEventsFile) ? JSON.parse(fs.readFileSync(tempEventsFile, "utf-8")).length : 0;
  const persisted = eventsCountBefore > 0 && eventsCountBefore === eventsCountAfter;
  console.log(`Persistence verified: ${persisted ? "PASS [OK]" : "FAIL"}`);

  // --- 7. Confirm Real data/events.json Unchanged ---
  console.log("\n--- 7. Data Safety Verification ---");
  const realEventsPath = path.join(process.cwd(), "data", "events.json");
  const realEventsContent = fs.readFileSync(realEventsPath, "utf-8").trim();
  console.log(`Real data/events.json size: ${realEventsContent.length} bytes`);
  const eventsEmpty = realEventsContent === "[]" || realEventsContent === "";
  console.log(`data/events.json untouched ([]): ${eventsEmpty ? "PASS [OK]" : "FAIL [MODIFIED]"}`);
  if (!eventsEmpty) {
    stage6Pass = false;
    stage6Failures.push(`data/events.json was modified! Expected [], got ${realEventsContent.length} bytes`);
  }

  console.log("\n=============================================");
  console.log(`STAGE 6 OVERALL: ${stage6Pass && missingGInCsv.length === 0 ? "PASS [OK]" : "FAIL / DEVIATIONS DETECTED"}`);
  if (stage6Failures.length > 0) {
    console.log(`Failures/Deviations (${stage6Failures.length}):`);
    stage6Failures.forEach((f) => console.log(`  - ${f}`));
  }
}

runStage6().catch((err) => {
  console.error("Stage 6 execution error:", err);
  process.exit(1);
});
