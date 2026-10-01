# STUDY_PROTOCOL.md — Moderator Guide & Session Protocol
## Pre-Search "Narrow It Down" Coach — Google Photos MVP

> **Audience:** Tharun (moderator) and any co-facilitator.  
> **Purpose:** Run consistent, comparable study sessions so data is valid.  
> **Do not improvise.** If something unexpected happens, see the "Handling Problems" section.

---

## Overview

- **Study:** Compare two search modes — plain search (Mode A) vs coach-assisted search (Mode B)
- **Target:** ≥ 3 participants, ideally 5, from the target segment
- **Per participant:** 2 tasks (one Mode A, one Mode B), with different target photos
- **Task:** Find a specific photo from memory within 3 minutes
- **Time per participant:** ~20–25 minutes total (briefing + 2 tasks + debrief)

---

## Before the Session

### Setup Checklist (do once, before first participant)

- [ ] Open the app on the **participant's device** (or the study device): `https://<app>.vercel.app`
- [ ] Open the **moderator console** on your device: `https://<app>.vercel.app/moderator`
- [ ] Enter moderator PIN → console unlocked
- [ ] Verify the photo library loads (S1 grid shows ~100 photos)
- [ ] Do a quick test session yourself to confirm the full flow works
- [ ] Confirm `targets.json` has ≥ 2 paired targets ready
- [ ] Have a notepad for qualitative notes (the app logs the quantitative data)
- [ ] Turn off notifications on the participant's device
- [ ] Set screen brightness to consistent level
- [ ] If recording (optional): get verbal consent first

### Participant Screening

The participant should match the target segment:
- Uses Google Photos (or similar) regularly
- Has searched for a specific old photo they remembered vaguely
- Is comfortable using a smartphone

---

## Session Script

### Part 1 — Welcome & Consent (~3 minutes)

**Say:**
> "Thank you for being here. We're testing a prototype — it's not a real Google product. We're studying how people search for photos they remember, not testing you. There are no wrong answers.  
>  
> Your interactions will be logged anonymously for a product-management case study. No names or personal information are stored. You can stop at any time.  
>  
> Do you have any questions before we start?"

**Give the participant the device.**

**Say:**
> "The app shows a library of photos. Think of it like your own photo collection. You'll try to find specific photos from memory."

---

### Part 2 — Warm-up (~2 minutes)

**Say:**
> "First, just browse around for a minute. Get familiar with the app."

Let them tap photos, scroll, explore S1. Do NOT show them the Search tab yet.

After ~1 minute:
> "Great. Now we'll start the actual tasks."

---

### Part 3 — Tasks

Run **2 tasks** per participant. Use the **counterbalance order** from the table below.

#### Counterbalance Order

| Participant | Task 1 | Task 2 |
|---|---|---|
| P01 | Mode A, Target T01 | Mode B, Target T02 |
| P02 | Mode B, Target T03 | Mode A, Target T04 |
| P03 | Mode A, Target T05 | Mode B, Target T06 |
| P04 | Mode B, Target T01 | Mode A, Target T03 |
| P05 | Mode A, Target T02 | Mode B, Target T05 |

*(Update this table when Tharun finalises the 10 targets in `targets.json`)*

---

### Task Flow (repeat for each task)

#### Step 1 — Moderator Setup (on your device)

1. On moderator console: enter participant ID (e.g. `P01`)
2. Select mode (A or B) per the counterbalance table
3. Select target photo per the table
4. Click **"Start task"** → the study page opens on the participant's device

#### Step 2 — Target Reveal (on participant's device)

The target photo is shown for **5 seconds** automatically.

**Say (as the photo appears):**
> "Look carefully. You have 5 seconds to remember this photo."

**Do not describe the photo.** Let the participant look.

After 5 seconds, the photo hides and the screen shows **"Now find this photo from memory."**

**Say:**
> "Now find that photo using the search. You have 3 minutes. Search however feels natural to you. Think out loud if you can — tell me what you're doing and why."

Click **"Find it"** on the participant's device to start the timer.

#### Step 3 — During the Task

**Do NOT:**
- Suggest search terms
- Point to the coach or chips
- Tell them if they're warm/cold
- Intervene unless they are completely stuck and say "I give up"

**DO:**
- Nod encouragingly
- If they ask "Should I use this?", say: "Whatever feels natural to you."
- If they ask "Am I doing it right?", say: "There's no right way. Just try what seems natural."
- Take brief notes on what they say and do (qualitative observations)

#### Step 4 — Task Ends

Task ends when:
- Participant taps **"This is the photo"** → S11 survey shown automatically
- Participant says **"I give up"** → you tap "End task" on moderator console → S11 shown
- **3-minute timer expires** → S11 shown automatically

#### Step 5 — Survey (S11)

The survey appears automatically. Let the participant fill it in themselves.

**Say:**
> "Please answer these two questions about the task you just did."

Do NOT explain the scale. Let them interpret it naturally.

After submission → moderator console shown.

#### Step 6 — Between Tasks (~2 minutes break)

**Say:**
> "Great, that's the first task done. Let's take a 2-minute break. We'll do one more task."

Do NOT tell them which mode they used or how well they did. Do NOT compare modes.

---

### Part 4 — Debrief (~5 minutes)

After both tasks:

**Say:**
> "That's everything. Thank you so much. Do you have any questions about what you just did?"

Optional open questions (qualitative, not logged):
- "What was going through your mind when you searched?"
- "Was there a moment where you felt stuck?"
- "Did anything surprise you about how the app works?"

Take notes. Do not discuss specific metrics or compare Mode A vs B with the participant.

---

## Handling Problems

### "The app is broken / won't load"

1. Refresh the page
2. If still broken: check your internet connection
3. If still broken: apologise, reschedule, and report the issue immediately

### "The coach didn't appear in Mode B"

- Do NOT tell the participant it was supposed to appear
- Let them search naturally
- After the session: check the event log to understand why (`triggered: false` might mean few matches or a precise query)

### "The participant is stuck and getting frustrated"

After ~2 minutes of no progress:
- **Say:** "It's totally fine if you can't find it. You can say 'I give up' at any time."
- If they say "I give up": click **"End task"** on your console

### "The timer expired but S11 didn't appear"

- Wait 10 seconds (network delay)
- If still not shown: click **"End task"** on moderator console
- Note the issue in your qualitative notes

### "The participant accidentally tapped 'This is the photo' on the wrong photo"

- The event is logged as `found { photoId }`
- Note in your qualitative notes: "P01, Task 1: tapped found on wrong photo [pool_01.jpg]"
- The CSV analysis will show the actual photoId; you can correct the outcome manually

### "The participant refreshes the page mid-task"

- The session ID resets; the task becomes incomplete
- Note in qualitative notes
- Do NOT run the same target again (participant has now seen it twice)
- Skip to the next task or end session

---

## Data Export (after all sessions)

1. Go to moderator console → click **"Export CSV"**
2. Open in Excel or Google Sheets
3. Verify:
   - One row per session (task)
   - All participant IDs present
   - `outcome` field filled for all rows
   - `first_query_text` not empty
4. Save the CSV file with today's date: `study_export_2026-10-06.csv`
5. Back up to Google Drive immediately

---

## Metrics to Report

From the CSV, compute and report:

| Metric | Mode A | Mode B |
|---|---|---|
| Query Formation Rate | % sessions with 2+ cue types in first query | same |
| Results per first query (mean) | — | — |
| Time to find (mean, found sessions only) | — | — |
| Success rate | % tasks ended with `found` | — |
| Coach trigger rate | N/A | % Mode B sessions where coach appeared |
| Prompt edit rate | N/A | % sessions where user edited the composed prompt |

---

## Participant ID Convention

- Anonymous IDs: `P01`, `P02`, `P03`, etc.
- Never use real names
- If a session is aborted and restarted, use a new session but same participant ID

---

## Session Log (fill in manually)

| Participant | Date | Task 1 Mode | Task 1 Target | Task 1 Outcome | Task 2 Mode | Task 2 Target | Task 2 Outcome | Notes |
|---|---|---|---|---|---|---|---|---|
| P01 | Oct 5 | A | T01 | | B | T02 | | |
| P02 | Oct 5 | B | T03 | | A | T04 | | |
| P03 | Oct 6 | A | T05 | | B | T06 | | |

---

*End of STUDY_PROTOCOL.md*
