import os
import json
import random
import csv
import base64
import time
import requests
from pathlib import Path

# Load .env.local
env_file = Path(".env.local")
api_key = ""
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("GEMINI_API_KEY="):
            api_key = line.split("=", 1)[1].strip().strip("\"'")

if not api_key:
    print("ERROR: GEMINI_API_KEY not found")
    exit(1)

TAGS_FILE = Path("data/tags.json")
tags_data = json.loads(TAGS_FILE.read_text(encoding="utf-8"))
photos_dir = Path("public/library")

# 1. Generate manual_check_sheet.csv (20 random photo IDs with current tags)
random.seed(100)
all_keys = sorted(tags_data.keys())
manual_keys = random.sample(all_keys, 20)

manual_sheet_path = Path("manual_check_sheet.csv")
with open(manual_sheet_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow([
        "photo_id", "one_line", "setting", "indoor_outdoor", "activity",
        "occasion_guess", "people_count", "group_type", "clothing", "objects", "mood"
    ])
    for k in manual_keys:
        t = tags_data[k]
        clothing_str = "; ".join([f"{c.get('colour', '')} {c.get('item', '')}".strip() for c in t.get("clothing", [])]) if isinstance(t.get("clothing"), list) else str(t.get("clothing", ""))
        objects_str = "; ".join(t.get("objects", [])) if isinstance(t.get("objects"), list) else str(t.get("objects", ""))
        writer.writerow([
            k,
            t.get("one_line", ""),
            t.get("setting", ""),
            t.get("indoor_outdoor", ""),
            t.get("activity", ""),
            t.get("occasion_guess", ""),
            t.get("people_count", 0),
            t.get("group_type", ""),
            clothing_str,
            objects_str,
            t.get("mood", "")
        ])

print(f"Wrote manual check sheet with 20 photos to: {manual_sheet_path.resolve()}")

# 2. Pick 40 photos across categories (fixed seed 42)
# Ensure representation across all 10 themes: 4 per theme = 40 photos
random.seed(42)
themes = ["pool", "beach", "birthday", "restaurant", "festival", "hiking", "kids", "graduation", "pets", "roadtrip"]
audit_keys = []
for th in themes:
    th_photos = [k for k in all_keys if k.startswith(th + "_")]
    audit_keys.extend(random.sample(th_photos, 4))

print(f"Selected {len(audit_keys)} photos for pre-tagging audit across 10 categories.")

# Function to call Gemini
def audit_photo_with_gemini(img_path: Path, current_tag: dict, model="gemini-3.5-flash-lite"):
    img_b64 = base64.b64encode(img_path.read_bytes()).decode("utf-8")
    
    clothing_summary = ", ".join([f"{c.get('colour', '')} {c.get('item', '')}".strip() for c in current_tag.get("clothing", [])])
    objects_summary = ", ".join(current_tag.get("objects", []))
    
    prompt = f"""You are an expert image audit validator.
Inspect the attached image carefully and audit the following candidate tags:

Current tags:
- one_line (scene sentence): "{current_tag.get('one_line', '')}"
- group_type: "{current_tag.get('group_type', '')}"
- occasion: "{current_tag.get('occasion_guess', '')}"
- activity: "{current_tag.get('activity', '')}"
- clothing_colours: "{clothing_summary}"
- objects: "{objects_summary}"

For EACH of the 6 fields above, evaluate whether it is:
- "correct": directly visible and accurately described in the image.
- "unsupported": assumed, guessed without visible evidence, or generic placeholder like 'unknown'/'none' when something IS visible, or claims an occasion/group that cannot be verified.
- "wrong": factually contradicted by the image (e.g. says swimming when they are sitting, wrong objects, wrong clothes, wrong scene).

Return ONLY valid JSON matching this schema:
{{
  "verdicts": [
    {{ "field": "one_line", "value": "...", "verdict": "correct|unsupported|wrong", "reason": "brief explanation" }},
    {{ "field": "group_type", "value": "...", "verdict": "correct|unsupported|wrong", "reason": "brief explanation" }},
    {{ "field": "occasion", "value": "...", "verdict": "correct|unsupported|wrong", "reason": "brief explanation" }},
    {{ "field": "activity", "value": "...", "verdict": "correct|unsupported|wrong", "reason": "brief explanation" }},
    {{ "field": "clothing_colours", "value": "...", "verdict": "correct|unsupported|wrong", "reason": "brief explanation" }},
    {{ "field": "objects", "value": "...", "verdict": "correct|unsupported|wrong", "reason": "brief explanation" }}
  ]
}}"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": "image/jpeg", "data": img_b64}}
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.0
        }
    }
    
    for attempt in range(1, 4):
        try:
            resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=30)
            if resp.status_code == 200:
                data = resp.json()
                raw_text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                parsed = json.loads(raw_text)
                return parsed.get("verdicts", [])
            elif resp.status_code in (429, 503):
                time.sleep(2 * attempt)
            else:
                print(f"API error {resp.status_code}: {resp.text[:100]}")
                time.sleep(2)
        except Exception as e:
            time.sleep(2)
    return []

# Run audit
audit_results = []
print("Auditing 40 photos with Gemini...")
for idx, fn in enumerate(audit_keys, 1):
    img_file = photos_dir / fn
    cur_tag = tags_data.get(fn, {})
    print(f"[{idx}/40] Auditing {fn}...", flush=True)
    verdicts = audit_photo_with_gemini(img_file, cur_tag)
    if not verdicts:
        # Fallback to flash
        verdicts = audit_photo_with_gemini(img_file, cur_tag, model="gemini-3.5-flash")
    for v in verdicts:
        audit_results.append({
            "photo_id": fn,
            "field": v.get("field", ""),
            "value": v.get("value", ""),
            "verdict": v.get("verdict", "unsupported"),
            "reason": v.get("reason", "")
        })
    time.sleep(0.5)

# Write audit_before.csv
audit_before_path = Path("audit_before.csv")
with open(audit_before_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["photo_id", "field", "value", "verdict", "reason"])
    writer.writeheader()
    writer.writerows(audit_results)

print(f"\nAudit complete! Wrote {len(audit_results)} rows to {audit_before_path.resolve()}")

# Compute stats
field_stats = {}
for r in audit_results:
    f = r["field"]
    if f not in field_stats:
        field_stats[f] = {"total": 0, "correct": 0, "unsupported": 0, "wrong": 0}
    field_stats[f]["total"] += 1
    v = r["verdict"].lower()
    if v in field_stats[f]:
        field_stats[f][v] += 1

print("\n--- PER-FIELD ERROR RATE (BEFORE) ---")
for f, s in sorted(field_stats.items()):
    err_count = s["unsupported"] + s["wrong"]
    err_rate = (err_count / s["total"] * 100) if s["total"] > 0 else 0
    print(f"{f:<18}: {err_rate:5.1f}% error/unsupported ({err_count}/{s['total']}) [correct={s['correct']}, unsupported={s['unsupported']}, wrong={s['wrong']}]")

# Count none/unknown per field across all 200 photos
none_unknown_stats = {}
total_photos = len(tags_data)
for fn, t in tags_data.items():
    for k, v in t.items():
        if k not in none_unknown_stats:
            none_unknown_stats[k] = 0
        if v is None:
            none_unknown_stats[k] += 1
        elif isinstance(v, str) and (v.lower() in ("none", "unknown", "") or v.strip() == ""):
            none_unknown_stats[k] += 1
        elif isinstance(v, list) and len(v) == 0:
            none_unknown_stats[k] += 1

print(f"\n--- 'NONE' / 'UNKNOWN' / EMPTY VALUES ACROSS ALL {total_photos} PHOTOS ---")
for k, cnt in sorted(none_unknown_stats.items()):
    pct = cnt / total_photos * 100
    print(f"{k:<20}: {cnt}/{total_photos} ({pct:.1f}%)")
