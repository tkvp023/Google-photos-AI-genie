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
env_vars = {}
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env_vars[k.strip()] = v.strip().strip("\"'")

api_key = env_vars.get("GEMINI_API_KEY", "")
if not api_key:
    print("ERROR: GEMINI_API_KEY not found")
    exit(1)

TAGS_FILE = Path("data/tags.json")
tags_data = json.loads(TAGS_FILE.read_text(encoding="utf-8"))
photos_dir = Path("public/library")

# Pick 40 photos across categories (fixed seed 999, different from audit_before's 42)
random.seed(999)
themes = ["pool", "beach", "birthday", "restaurant", "festival", "hiking", "kids", "graduation", "pets", "roadtrip"]
all_keys = sorted(tags_data.keys())
audit_keys = []
for th in themes:
    th_photos = [k for k in all_keys if k.startswith(th + "_")]
    audit_keys.extend(random.sample(th_photos, 4))

print(f"Selected {len(audit_keys)} photos for post-tagging audit across 10 categories (seed 999).")

def audit_photo_with_gemini(img_path: Path, current_tag: dict, model="gemini-3.5-flash-lite"):
    img_b64 = base64.b64encode(img_path.read_bytes()).decode("utf-8")
    
    clothing_summary = ", ".join(current_tag.get("clothing_colours") or [])
    objects_summary = ", ".join(current_tag.get("objects") or [])
    
    prompt = f"""You are an expert image audit validator.
Inspect the attached image carefully and audit the following candidate tags:

New tags:
- one_line (scene sentence): "{current_tag.get('one_line') or 'null'}"
- group_type: "{current_tag.get('group_type') or 'null'}"
- occasion: "{current_tag.get('occasion') or 'null'}"
- activity: "{current_tag.get('activity') or 'null'}"
- clothing_colours: "{clothing_summary or 'null'}"
- objects: "{objects_summary or 'null'}"

For EACH of the 6 fields above, evaluate whether it is:
- "correct": directly visible and accurately described in the image (or appropriately null when not visible/applicable).
- "unsupported": claims something that cannot be seen or verified in the photo, or provides an invalid value.
- "wrong": factually contradicted by what is visible in the photo.

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
                time.sleep(1)
        except Exception as e:
            time.sleep(1)
    return []

audit_results = []
print("Auditing 40 re-tagged photos with Gemini...")
for idx, fn in enumerate(audit_keys, 1):
    img_file = photos_dir / fn
    cur_tag = tags_data.get(fn, {})
    print(f"[{idx}/40] Auditing {fn}...", flush=True)
    verdicts = audit_photo_with_gemini(img_file, cur_tag)
    if not verdicts:
        verdicts = audit_photo_with_gemini(img_file, cur_tag, model="gemini-3.5-flash")
    for v in verdicts:
        audit_results.append({
            "photo_id": fn,
            "field": v.get("field", ""),
            "value": v.get("value", ""),
            "verdict": v.get("verdict", "unsupported"),
            "reason": v.get("reason", "")
        })
    time.sleep(0.3)

audit_after_path = Path("audit_after.csv")
with open(audit_after_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["photo_id", "field", "value", "verdict", "reason"])
    writer.writeheader()
    writer.writerows(audit_results)

print(f"\nAudit complete! Wrote {len(audit_results)} rows to {audit_after_path.resolve()}")

# Compute stats after
field_stats = {}
for r in audit_results:
    f = r["field"]
    if f not in field_stats:
        field_stats[f] = {"total": 0, "correct": 0, "unsupported": 0, "wrong": 0}
    field_stats[f]["total"] += 1
    v = r["verdict"].lower()
    if v in field_stats[f]:
        field_stats[f][v] += 1

print("\n--- PER-FIELD ERROR RATE (AFTER) ---")
for f, s in sorted(field_stats.items()):
    err_count = s["unsupported"] + s["wrong"]
    err_rate = (err_count / s["total"] * 100) if s["total"] > 0 else 0
    print(f"{f:<18}: {err_rate:5.1f}% error/unsupported ({err_count}/{s['total']}) [correct={s['correct']}, unsupported={s['unsupported']}, wrong={s['wrong']}]")
