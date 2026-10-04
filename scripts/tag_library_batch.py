#!/usr/bin/env python3
"""
scripts/tag_library_batch.py
Batches 4-5 images per request to tag untagged photos in public/library/
using Gemini (minimum 3.5 Flash / Flash-Lite / 3 Flash Preview).
Saves incrementally to data/tags.json.
Reports final field coverage across all 200 photos.
"""

import base64
import json
import os
import sys
import time
from pathlib import Path
import requests

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
LIBRARY_DIR = PROJECT_ROOT / "public" / "library"
TAGS_JSON = PROJECT_ROOT / "data" / "tags.json"

# Load .env.local
env_local = PROJECT_ROOT / ".env.local"
if env_local.exists():
    for line in env_local.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ[k] = v

api_key = os.environ.get("GEMINI_API_KEY", "")
if not api_key:
    print("Error: GEMINI_API_KEY not set")
    sys.exit(1)

MODELS = [
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite"
]

BASE_COLOURS = {
    "red", "blue", "green", "yellow", "orange", "pink", "purple",
    "white", "black", "grey", "brown", "beige"
}
COLOUR_MAP = {
    "gray": "grey", "silver": "grey", "gold": "yellow", "navy": "blue",
    "turquoise": "blue", "teal": "blue", "maroon": "red", "coral": "orange",
    "cream": "beige", "tan": "beige", "khaki": "beige",
}

def normalise_colour(c: str) -> str:
    c = c.lower().strip()
    return c if c in BASE_COLOURS else COLOUR_MAP.get(c, "unknown")

def parse_clothing(raw_list):
    if not isinstance(raw_list, list): return []
    result = []
    for item in raw_list:
        if not item: continue
        if isinstance(item, dict):
            col = normalise_colour(str(item.get("colour") or item.get("color") or "unknown"))
            it = str(item.get("item") or "").lower().strip()
            result.append({"colour": col, "item": it})
        elif isinstance(item, str):
            parts = item.strip().split(" ", 1)
            if len(parts) == 2:
                result.append({"colour": normalise_colour(parts[0]), "item": parts[1].lower().strip()})
            else:
                result.append({"colour": "unknown", "item": item.lower().strip()})
    return result

def normalise_tag(raw: dict) -> dict:
    people_count = int(raw.get("people_count", 0)) if str(raw.get("people_count", 0)).isdigit() else 0
    if people_count == 0: bucket = "none"
    elif people_count == 1: bucket = "1"
    elif people_count == 2: bucket = "2"
    elif 3 <= people_count <= 5: bucket = "3-5"
    else: bucket = "6+"

    return {
        "one_line": str(raw.get("one_line", "")).strip().lower(),
        "setting": str(raw.get("setting", "unknown")).strip().lower(),
        "indoor_outdoor": str(raw.get("indoor_outdoor", "unknown")).strip().lower(),
        "activity": str(raw.get("activity", "none")).strip().lower(),
        "occasion_guess": str(raw.get("occasion_guess", "none")).strip().lower(),
        "occasion_basis": str(raw.get("occasion_basis", "none")).strip().lower(),
        "people_count": people_count,
        "people_ages": [str(a).strip().lower() for a in raw.get("people_ages", []) if a],
        "people_bucket": bucket,
        "group_type": str(raw.get("group_type", "unknown")).strip().lower(),
        "clothing": parse_clothing(raw.get("clothing", [])),
        "objects": [str(o).strip().lower() for o in raw.get("objects", []) if o],
        "time_of_day": str(raw.get("time_of_day", "unknown")).strip().lower(),
        "weather_or_season": str(raw.get("weather_or_season", "unknown")).strip().lower(),
        "mood": str(raw.get("mood", "calm")).strip().lower(),
        "text_in_image": str(raw.get("text_in_image", "none")).strip().lower(),
    }

def call_gemini_batch(batch_files, model_idx=0):
    prompt_intro = (
        "You are tagging photos for a photo search engine. Describe ONLY what is directly visible.\n"
        "Do NOT guess names or identities. For people, give counts and rough age bands only (child, teen, adult, senior).\n"
        f"For each image provided, output a JSON object where the keys are the exact filenames: {batch_files}.\n"
        "Each value must follow this schema:\n"
        "{\n"
        '  "one_line": "concise factual sentence describing the scene",\n'
        '  "setting": "e.g. pool, beach, restaurant, park, home, street, mountain",\n'
        '  "indoor_outdoor": "indoor | outdoor | unknown",\n'
        '  "activity": "e.g. swimming, eating, hiking, walking, none",\n'
        '  "occasion_guess": "e.g. birthday, graduation, festival, none",\n'
        '  "occasion_basis": "visual evidence or none",\n'
        '  "people_count": 0,\n'
        '  "people_ages": ["child", "adult"],\n'
        '  "group_type": "solo | couple | family | friends | crowd | unknown",\n'
        '  "clothing": [{"colour": "red", "item": "swimsuit"}],\n'
        '  "objects": ["key objects visible"],\n'
        '  "time_of_day": "morning | afternoon | sunset | night | unknown",\n'
        '  "weather_or_season": "sunny | overcast | rainy | snow | unknown",\n'
        '  "mood": "cheerful | calm | energetic | formal | none",\n'
        '  "text_in_image": "visible text or none"\n'
        "}\n"
    )

    parts = [{"text": prompt_intro}]
    for fn in batch_files:
        p = LIBRARY_DIR / fn
        b64 = base64.b64encode(p.read_bytes()).decode("utf-8")
        parts.append({"text": f"Image filename: {fn}"})
        parts.append({"inline_data": {"mime_type": "image/jpeg", "data": b64}})

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.1,
            "maxOutputTokens": 4096,
        }
    }

    current_idx = model_idx
    while current_idx < len(MODELS):
        m_name = MODELS[current_idx]
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{m_name}:generateContent?key={api_key}"
        print(f"[{m_name}] ", end="", flush=True)

        for attempt in range(1, 4):
            try:
                r = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=55)
                if r.status_code == 200:
                    data = r.json()
                    candidates = data.get("candidates", [])
                    if not candidates:
                        raise ValueError("No candidates returned")
                    text = candidates[0]["content"]["parts"][0]["text"].strip()
                    if text.startswith("```"):
                        lines = text.splitlines()
                        if lines[0].startswith("```"): lines = lines[1:]
                        if lines and lines[-1].strip() == "```": lines = lines[:-1]
                        text = "\n".join(lines).strip()
                    parsed = json.loads(text)
                    return parsed, current_idx
                elif r.status_code in (429, 404):
                    err_msg = r.json().get("error", {}).get("message", "")
                    print(f"[status {r.status_code}: {err_msg[:60]}] -> switching model... ", flush=True)
                    break  # Break inner loop to try next model
                elif r.status_code in (500, 503):
                    print(f"[status {r.status_code}, retry {attempt}] ", flush=True)
                    time.sleep(6 * attempt)
                else:
                    print(f"[HTTP {r.status_code}] ", flush=True)
                    time.sleep(5)
            except Exception as e:
                print(f"[err: {e}] ", flush=True)
                time.sleep(5)

        current_idx += 1

    raise RuntimeError("All models exhausted or failed for batch")

def report_coverage(tags):
    all_files = sorted([f.name for f in LIBRARY_DIR.glob("*.jpg")])
    total = len(all_files)
    fields = [
        "one_line", "setting", "indoor_outdoor", "activity", "occasion_guess",
        "people_count", "people_bucket", "group_type", "clothing", "objects",
        "time_of_day", "weather_or_season", "mood"
    ]
    print(f"\n================ TAG COVERAGE REPORT ================")
    print(f"Total library images: {total}")
    print(f"Total tagged images: {len([f for f in all_files if f in tags])}")
    print("Field coverage across library:")
    for fld in fields:
        cov = sum(1 for f in all_files if f in tags and tags[f].get(fld) not in (None, "", [], "unknown", "none"))
        pct = (cov / total) * 100
        print(f"  - {fld:18s}: {cov:3d}/{total} ({pct:5.1f}%)")
    print("====================================================\n")

def main():
    with open(TAGS_JSON, "r", encoding="utf-8") as f:
        tags = json.load(f)

    all_files = sorted([f.name for f in LIBRARY_DIR.glob("*.jpg")])
    missing = [f for f in all_files if f not in tags or not tags[f].get("one_line")]

    print(f"Total photos: {len(all_files)}, Already tagged: {len(all_files) - len(missing)}, Missing: {len(missing)}")

    BATCH_SIZE = 5
    model_idx = 0

    for i in range(0, len(missing), BATCH_SIZE):
        batch = missing[i:i + BATCH_SIZE]
        print(f"\nBatch {i//BATCH_SIZE + 1}/{(len(missing) + BATCH_SIZE - 1)//BATCH_SIZE} ({len(batch)} photos): {batch}")

        try:
            results, model_idx = call_gemini_batch(batch, model_idx)
            for fn in batch:
                if fn in results:
                    norm = normalise_tag(results[fn])
                    tags[fn] = norm
                    print(f"  + {fn}: {norm['one_line'][:65]}...")
                else:
                    print(f"  ! Warning: {fn} missing in response keys ({list(results.keys())})")

            with open(TAGS_JSON, "w", encoding="utf-8") as f:
                json.dump(tags, f, indent=2)
            print("  [Saved to data/tags.json]")

        except Exception as e:
            print(f"  [ERROR processing batch: {e}]")
            # If batch fails completely, try smaller sub-batch or pause
            time.sleep(15)

        time.sleep(10)  # Rate limit safety between batches

    report_coverage(tags)

if __name__ == "__main__":
    main()
