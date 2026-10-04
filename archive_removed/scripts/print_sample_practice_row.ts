import { computeSessionMetrics, metricsToCsv } from "../src/lib/metrics";
import { LogEvent } from "../src/types";

const now = Date.now();
const sessionId = "practice_sess_001";

const samplePracticeEvents: LogEvent[] = [
  {
    sessionId,
    participantId: "P01_practice",
    mode: "B",
    targetId: "T01",
    isPractice: true,
    timestamp: now,
    type: "search_keystroke",
    payload: { query: "p" },
  },
  {
    sessionId,
    participantId: "P01_practice",
    mode: "B",
    targetId: "T01",
    isPractice: true,
    timestamp: now + 450,
    type: "search_keystroke",
    payload: { query: "pool" },
  },
  {
    sessionId,
    participantId: "P01_practice",
    mode: "B",
    targetId: "T01",
    isPractice: true,
    timestamp: now + 780,
    type: "coach_triggered",
    payload: {
      query: "pool",
      layer: "library",
      isVague: true,
      candidateCount: 15,
      coachShownQuestions: ["q_who", "q_where", "q_look"],
    },
  },
  {
    sessionId,
    participantId: "P01_practice",
    mode: "B",
    targetId: "T01",
    isPractice: true,
    timestamp: now + 2500,
    type: "chip_tapped",
    payload: {
      questionId: "q_who",
      cueType: "who",
      phrase: "with friends",
      query: "pool, with friends",
    },
  },
  {
    sessionId,
    participantId: "P01_practice",
    mode: "B",
    targetId: "T01",
    isPractice: true,
    timestamp: now + 4200,
    type: "chip_tapped",
    payload: {
      questionId: "q_where",
      cueType: "where",
      phrase: "outdoors",
      query: "pool, with friends, outdoors",
    },
  },
  {
    sessionId,
    participantId: "P01_practice",
    mode: "B",
    targetId: "T01",
    isPractice: true,
    timestamp: now + 5800,
    type: "search_submitted",
    payload: {
      query: "pool, with friends, outdoors",
      typedTextAtTrigger: "pool",
      finalSubmittedText: "pool, with friends, outdoors",
      firstQuerySource: "typed_plus_chips",
      resultsForFirstTyped: 15,
      resultsPerFirstQuery: 4,
      narrowingRatio: 0.27,
      secondsFirstKeystrokeToSubmit: 5.8,
      coachTriggered: true,
      coachLayer: "library",
      coachDismissed: false,
      coachShownQuestions: ["q_who", "q_where", "q_look"],
      questionsIgnored: 1,
      coachAccepted: true,
      chipsTappedCount: 2,
      chipsSelectedAtSubmit: 2,
      textEditedAfterChip: false,
      secondsFirstChipTapFromTrigger: 2,
      composer: "template",
    },
  },
  {
    sessionId,
    participantId: "P01_practice",
    mode: "B",
    targetId: "T01",
    isPractice: true,
    timestamp: now + 9800,
    type: "photo_opened",
    payload: { photoId: "pool_01", rank: 1 },
  },
  {
    sessionId,
    participantId: "P01_practice",
    mode: "B",
    targetId: "T01",
    isPractice: true,
    timestamp: now + 12400,
    type: "found",
    payload: {
      photoId: "pool_01",
    },
  },
];

const metrics = computeSessionMetrics(samplePracticeEvents);
const csvLines = metricsToCsv(metrics, { includePractice: true }).split("\n");

console.log("--- CSV HEADER ---");
console.log(csvLines[1]);
console.log("--- SAMPLE PRACTICE ROW ---");
console.log(csvLines[2]);
