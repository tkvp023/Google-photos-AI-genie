import os
import json
import csv
import time
import re
import requests
from pathlib import Path

env_file = Path(".env.local")
groq_key = ""
for line in env_file.read_text(encoding="utf-8").splitlines():
    if line.startswith("GROQ_API_KEY="):
        groq_key = line.split("=", 1)[1].strip()

if not groq_key:
    print("ERROR: GROQ_API_KEY not found in .env.local")
    exit(1)

tags_data = json.loads(Path("data/tags.json").read_text(encoding="utf-8"))
credits_data = {row["file"]: row for row in csv.DictReader(open("data/credits.csv", encoding="utf-8"))}

audit_before_rows = list(csv.DictReader(open("audit_before.csv", encoding="utf-8")))

# Group baseline data by photo
notes_by_photo = {}
before_by_photo_field = {}
for r in audit_before_rows:
    pid = r["photo_id"]
    fld = r["field"]
    before_by_photo_field[(pid, fld)] = r
    if pid not in notes_by_photo:
        notes_by_photo[pid] = []
    notes_by_photo[pid].append(f"- {fld} (was '{r['value']}'): {r['verdict']} - {r['reason']}")

pids_40 = list(dict.fromkeys(r["photo_id"] for r in audit_before_rows))
print(f"Loaded {len(pids_40)} photos to audit across {len(audit_before_rows)} fields.")

progress_file = Path("data/groq_audit_progress.json")
cached_results = {}
if progress_file.exists():
    try:
        cached_results = json.loads(progress_file.read_text(encoding="utf-8"))
        print(f"Loaded {len(cached_results)} already audited photos from {progress_file}")
    except Exception:
        cached_results = {}

def call_groq_with_retry(prompt, max_retries=10):
    for attempt in range(max_retries):
        try:
            resp = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                json={
                    "model": "qwen/qwen3.8-27b",
                    "temperature": 0.0,
                    "max_tokens": 350,
                    "messages": [{"role": "user", "content": prompt}]
                },
                timeout=35
            )
            if resp.status_code == 200:
                data = resp.json()
                return data["choices"][0]["message"]["content"]
            elif resp.status_code == 429:
                retry_header = resp.headers.get("retry-after")
                wait_sec = 25.0
                if retry_header:
                    try:
                        wait_sec = float(retry_header) + 2.0
                    except Exception:
                        pass
                else:
                    match = re.search(r"try again in ([0-9\.]+)s", resp.text)
                    if match:
                        wait_sec = float(match.group(1)) + 2.0
                    else:
                        wait_sec = 25.0
                print(f" [Rate limit 429, waiting {wait_sec:.1f}s...]", end="", flush=True)
                time.sleep(wait_sec)
            else:
                print(f" [Groq API error {resp.status_code}: {resp.text[:80]} - waiting 5s]", end="", flush=True)
                time.sleep(5)
        except Exception as e:
            print(f" [Exception {e}, waiting 5s...]", end="", flush=True)
            time.sleep(5)
    raise RuntimeError("Failed to get Groq response after retries")

print("\nRunning Independent Paired Audit with Groq qwen/qwen3.8-27b...")
for idx, pid in enumerate(pids_40, 1):
    tag = tags_data.get(pid, {})
    cred = credits_data.get(pid, {})
    notes = "\n".join(notes_by_photo.get(pid, []))
    
    clothing_val = tag.get("clothing_colours") or tag.get("clothing")
    if isinstance(clothing_val, list):
        clothing_str = ", ".join([f"{c.get('colour', '')} {c.get('item', '')}".strip() if isinstance(c, dict) else str(c) for c in clothing_val])
    elif clothing_val is None:
        clothing_str = "null"
    else:
        clothing_str = str(clothing_val)
        
    obj_val = tag.get("objects", [])
    if isinstance(obj_val, list):
        obj_str = ", ".join(obj_val)
    elif obj_val is None:
        obj_str = "null"
    else:
        obj_str = str(obj_val)
        
    tag_fields = {
        "one_line": tag.get("one_line", "null") or "null",
        "group_type": tag.get("group_type", "null") or "null",
        "occasion": tag.get("occasion_guess", "null") or "null",
        "activity": tag.get("activity", "null") or "null",
        "clothing_colours": clothing_str,
        "objects": obj_str
    }
    
    if pid in cached_results and len(cached_results[pid]) == 6:
        print(f"[{idx:02d}/40] {pid:16s} (cached)", flush=True)
        continue

    prompt = f"""You are an independent, strict, expert image tag auditor.
Audit the newly updated metadata tags for image {pid}.

GROUND TRUTH CONTEXT:
- Image file / Pixabay URL slug: {cred.get('url', '')}
- Baseline ground-truth inspection notes:
{notes}

NEW CANDIDATE TAGS TO AUDIT:
1. one_line: "{tag_fields['one_line']}"
2. group_type: "{tag_fields['group_type']}"
3. occasion: "{tag_fields['occasion']}"
4. activity: "{tag_fields['activity']}"
5. clothing_colours: "{tag_fields['clothing_colours']}"
6. objects: "{tag_fields['objects']}"

AUDIT RUBRIC:
- "correct": directly supported by ground truth, accurately described, or correctly null/empty when entity is absent in the image.
- "unsupported": assumes, guesses, or speculates without visual evidence (e.g. assuming hikers, graduates or strangers are 'friends', guessing an unstated occasion, assuming relationships).
- "wrong": factually contradicted by the image (e.g. claiming people or objects when none exist, wrong activity, wrong color, claiming solo when multiple people).

RULES:
- Evaluate each field strictly and independently. Do NOT default to correct.
- CRITICAL: Keep each "reason" under 15 words. Do NOT include thinking or deliberations.
- Return ONLY valid JSON:
{{
  "verdicts": [
    {{"field": "one_line", "verdict": "correct|unsupported|wrong", "reason": "brief explanation under 15 words"}},
    {{"field": "group_type", "verdict": "correct|unsupported|wrong", "reason": "brief explanation under 15 words"}},
    {{"field": "occasion", "verdict": "correct|unsupported|wrong", "reason": "brief explanation under 15 words"}},
    {{"field": "activity", "verdict": "correct|unsupported|wrong", "reason": "brief explanation under 15 words"}},
    {{"field": "clothing_colours", "verdict": "correct|unsupported|wrong", "reason": "brief explanation under 15 words"}},
    {{"field": "objects", "verdict": "correct|unsupported|wrong", "reason": "brief explanation under 15 words"}}
  ]
}}"""

    print(f"[{idx:02d}/40] Auditing {pid:16s} ...", end="", flush=True)
    raw_response = call_groq_with_retry(prompt)
    
    # Parse JSON
    try:
        clean_json = raw_response.strip()
        if clean_json.startswith("```json"):
            clean_json = clean_json[7:]
        if clean_json.startswith("```"):
            clean_json = clean_json[3:]
        if clean_json.endswith("```"):
            clean_json = clean_json[:-3]
        parsed = json.loads(clean_json.strip())
        verdicts_list = parsed.get("verdicts", [])
        verdict_dict = {v["field"]: v for v in verdicts_list}
    except Exception as e:
        print(f" [JSON parse error: {e}]", end="")
        verdict_dict = {}

    cached_results[pid] = verdict_dict
    progress_file.write_text(json.dumps(cached_results, indent=2), encoding="utf-8")
    print(" Done.", flush=True)
    time.sleep(2.0)

# Build full results
paired_results = []
non_correct_rows = []

for pid in pids_40:
    tag = tags_data.get(pid, {})
    clothing_val = tag.get("clothing_colours") or tag.get("clothing")
    if isinstance(clothing_val, list):
        clothing_str = ", ".join([f"{c.get('colour', '')} {c.get('item', '')}".strip() if isinstance(c, dict) else str(c) for c in clothing_val])
    elif clothing_val is None:
        clothing_str = "null"
    else:
        clothing_str = str(clothing_val)
        
    obj_val = tag.get("objects", [])
    if isinstance(obj_val, list):
        obj_str = ", ".join(obj_val)
    elif obj_val is None:
        obj_str = "null"
    else:
        obj_str = str(obj_val)
        
    tag_fields = {
        "one_line": tag.get("one_line", "null") or "null",
        "group_type": tag.get("group_type", "null") or "null",
        "occasion": tag.get("occasion_guess", "null") or "null",
        "activity": tag.get("activity", "null") or "null",
        "clothing_colours": clothing_str,
        "objects": obj_str
    }
    
    v_dict = cached_results.get(pid, {})
    for fld in ["one_line", "group_type", "occasion", "activity", "clothing_colours", "objects"]:
        bef = before_by_photo_field.get((pid, fld), {})
        v_info = v_dict.get(fld)
        if v_info and "verdict" in v_info:
            v_aft = v_info["verdict"].strip().lower()
            reason = v_info.get("reason", "")
        else:
            v_aft = "unsupported"
            reason = "Auditor verdict could not be verified"
            
        row_data = {
            "photo_id": pid,
            "field": fld,
            "value_before": bef.get("value", ""),
            "verdict_before": bef.get("verdict", ""),
            "value_after": tag_fields[fld],
            "verdict_after": v_aft,
            "reason": reason
        }
        paired_results.append(row_data)
        if v_aft != "correct":
            non_correct_rows.append(row_data)

# Save to paired_audit_comparison.csv
out_path = Path("paired_audit_comparison.csv")
with open(out_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["photo_id", "field", "value_before", "verdict_before", "value_after", "verdict_after", "reason"])
    writer.writeheader()
    writer.writerows(paired_results)

print(f"\nSuccessfully wrote {len(paired_results)} audit checks to {out_path.resolve()}")

# Statistics
bef_stats = {"correct": 0, "unsupported": 0, "wrong": 0}
aft_stats = {"correct": 0, "unsupported": 0, "wrong": 0}
for r in paired_results:
    vb = r["verdict_before"].lower()
    va = r["verdict_after"].lower()
    bef_stats[vb] = bef_stats.get(vb, 0) + 1
    aft_stats[va] = aft_stats.get(va, 0) + 1

total = len(paired_results)
print("\n" + "="*80)
print("AUDIT SUMMARY (40 photos, 240 field checks)")
print("="*80)
print(f"BEFORE Retagging: Correct: {bef_stats['correct']}/{total} ({bef_stats['correct']/total*100:.1f}%), "
      f"Unsupported: {bef_stats['unsupported']}/{total} ({bef_stats['unsupported']/total*100:.1f}%), "
      f"Wrong: {bef_stats['wrong']}/{total} ({bef_stats['wrong']/total*100:.1f}%)")
print(f"AFTER (Audited by Groq qwen/qwen3.8-27b): "
      f"Correct: {aft_stats['correct']}/{total} ({aft_stats['correct']/total*100:.1f}%), "
      f"Unsupported: {aft_stats['unsupported']}/{total} ({aft_stats['unsupported']/total*100:.1f}%), "
      f"Wrong: {aft_stats['wrong']}/{total} ({aft_stats['wrong']/total*100:.1f}%)")
print("="*80)

print(f"\nNON-CORRECT ROWS ({len(non_correct_rows)} total):")
print(f"{'PHOTO ID':<18} | {'FIELD':<16} | {'VALUE AFTER':<25} | {'VERDICT':<11} | {'REASON'}")
print("-" * 115)
for r in non_correct_rows:
    val_disp = (r['value_after'][:22] + '...') if len(r['value_after']) > 25 else r['value_after']
    print(f"{r['photo_id']:<18} | {r['field']:<16} | {val_disp:<25} | {r['verdict_after']:<11} | {r['reason']}")
