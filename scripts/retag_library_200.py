#!/usr/bin/env python3
"""
scripts/retag_library_200.py
Re-tags all 200 photos in public/library/ using Gemini with strict schema.
Image-only, no folder/theme leakage.
Concurrency: 3 workers, exponential backoff, cache by photo ID.
"""

import os
import json
import base64
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import threading

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
primary_model = env_vars.get("GEMINI_TAG_MODEL", "gemini-3.5-flash")
fallback_model = env_vars.get("GEMINI_TAG_MODEL_FALLBACK", "gemini-3.5-flash-lite")

if not api_key:
    print("ERROR: GEMINI_API_KEY not found")
    exit(1)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
LIBRARY_DIR = PROJECT_ROOT / "public" / "library"
CACHE_FILE = PROJECT_ROOT / "data" / "tags_cache.json"
TAGS_JSON = PROJECT_ROOT / "data" / "tags.json"

VALID_SETTINGS = {"restaurant", "pool", "beach", "park", "home", "street", "outdoors nature", "venue", "other"}
VALID_INDOOR_OUTDOOR = {"indoor", "outdoor"}
VALID_GROUP_TYPE = {"solo", "couple", "friends", "family", "children"}
VALID_TIME_OF_DAY = {"morning", "afternoon", "evening", "night"}

SYSTEM_PROMPT = """You are an expert image tagger.
Tag ONLY what is directly visible in the image. Do NOT guess or extrapolate. Do NOT use folder or file names.
Use null for any field where the information is absent, unclear, or not directly visible.
NEVER output "none", "unknown", or empty strings. Use JSON null.

Schema:
- one_line: exactly one plain concise sentence describing ONLY what is visible. No repeated words.
- setting: one of ["restaurant", "pool", "beach", "park", "home", "street", "outdoors nature", "venue", "other"] or null.
- indoor_outdoor: "indoor", "outdoor", or null.
- activity: what people are visibly doing (e.g. "swimming", "eating", "hiking", "sitting"), or null.
- people_count: integer count of visible people (0 if no people).
- group_type: "solo", "couple", "friends", "family", "children" (children without adults = "children"), or null.
- occasion: ONLY if clearly visible evidence exists (e.g. birthday cake with candles, graduation gown and cap, wedding dress/garlands). Otherwise null. Never infer from context.
- clothing_colours: array of visible clothing colours (e.g. ["red", "blue"]) or null.
- objects: array of notable visible objects or null.
- time_of_day: "morning", "afternoon", "evening", "night", or null.
- mood: only if clearly visible from facial expressions/atmosphere, or null.
"""

def clean_json(text: str) -> dict:
    t = text.strip()
    if t.startswith("```"):
        lines = t.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        t = "\n".join(lines).strip()
    return json.loads(t)

def validate_schema(data: dict) -> bool:
    if not isinstance(data, dict):
        return False
    one_line = data.get("one_line")
    if not one_line or not isinstance(one_line, str) or len(one_line.strip()) < 5:
        return False
    # Check no forbidden strings
    for k, v in data.items():
        if isinstance(v, str) and v.lower() in ("none", "unknown", "null"):
            return False
        if isinstance(v, list):
            for item in v:
                if isinstance(item, str) and item.lower() in ("none", "unknown", "null"):
                    return False
    return True

cache_lock = threading.Lock()
cache_data = {}
if CACHE_FILE.exists():
    try:
        cache_data = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        print(f"Loaded {len(cache_data)} cached photo tags from {CACHE_FILE.name}")
    except Exception as e:
        print("Warning: could not read cache:", e)

def save_cache_entry(fn: str, tag: dict):
    with cache_lock:
        cache_data[fn] = tag
        CACHE_FILE.write_text(json.dumps(cache_data, indent=2, ensure_ascii=False), encoding="utf-8")

def call_gemini_api(img_b64: str, model: str):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": SYSTEM_PROMPT},
                    {"inline_data": {"mime_type": "image/jpeg", "data": img_b64}}
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.0,
            "maxOutputTokens": 2048
        }
    }
    return requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=40)

def tag_single_photo(img_path: Path):
    fn = img_path.name
    with cache_lock:
        if fn in cache_data and cache_data[fn].get("model_version"):
            return fn, cache_data[fn], 0, "cache"

    img_b64 = base64.b64encode(img_path.read_bytes()).decode("utf-8")
    
    current_model = primary_model
    attempts_on_primary = 0
    validation_failures = 0

    t0 = time.time()
    for total_attempt in range(1, 8):
        try:
            resp = call_gemini_api(img_b64, current_model)
            if resp.status_code == 200:
                data = resp.json()
                raw_text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                parsed = clean_json(raw_text)
                
                # Normalize values according to rules
                norm = normalize_tag_output(parsed, current_model)
                if validate_schema(norm):
                    dur = round(time.time() - t0, 2)
                    save_cache_entry(fn, norm)
                    return fn, norm, dur, current_model
                else:
                    validation_failures += 1
                    if validation_failures >= 2:
                        norm["needs_review"] = True
                        dur = round(time.time() - t0, 2)
                        save_cache_entry(fn, norm)
                        return fn, norm, dur, "needs_review"
            elif resp.status_code in (429, 503):
                # Backoff
                sleep_sec = 2 * total_attempt
                time.sleep(sleep_sec)
                attempts_on_primary += 1
            else:
                attempts_on_primary += 1
                time.sleep(1)
        except Exception as e:
            attempts_on_primary += 1
            time.sleep(1)

        # Fallback to secondary after 3 primary failures
        if attempts_on_primary >= 3 and current_model != fallback_model:
            current_model = fallback_model

    # If all attempts fail, mark needs_review
    fallback_res = {
        "one_line": None,
        "setting": None,
        "indoor_outdoor": None,
        "activity": None,
        "people_count": 0,
        "group_type": None,
        "occasion": None,
        "clothing_colours": None,
        "objects": None,
        "time_of_day": None,
        "mood": None,
        "model_version": "failed",
        "needs_review": True
    }
    dur = round(time.time() - t0, 2)
    save_cache_entry(fn, fallback_res)
    return fn, fallback_res, dur, "failed"

def normalize_tag_output(raw: dict, model_name: str) -> dict:
    def clean_val(v):
        if v is None: return None
        if isinstance(v, str):
            s = v.strip().lower()
            if s in ("none", "unknown", "null", ""): return None
            return v.strip()
        return v

    def clean_list(lst):
        if not lst or not isinstance(lst, list): return None
        cleaned = [x.strip().lower() for x in lst if isinstance(x, str) and x.strip().lower() not in ("none", "unknown", "null", "")]
        return cleaned if cleaned else None

    setting = clean_val(raw.get("setting"))
    if setting and setting.lower() not in VALID_SETTINGS:
        setting = "other" if setting else None

    indoor_outdoor = clean_val(raw.get("indoor_outdoor"))
    if indoor_outdoor and indoor_outdoor.lower() not in VALID_INDOOR_OUTDOOR:
        indoor_outdoor = None

    group_type = clean_val(raw.get("group_type"))
    if group_type and group_type.lower() not in VALID_GROUP_TYPE:
        group_type = None

    time_of_day = clean_val(raw.get("time_of_day"))
    if time_of_day and time_of_day.lower() not in VALID_TIME_OF_DAY:
        time_of_day = None

    try:
        people_count = int(raw.get("people_count", 0))
    except (ValueError, TypeError):
        people_count = 0
    if people_count < 0: people_count = 0

    clothing_colours = clean_list(raw.get("clothing_colours"))
    objects = clean_list(raw.get("objects"))

    # Legacy compatibility mappings
    clothing_compat = [{"colour": c, "item": ""} for c in (clothing_colours or [])] if clothing_colours else None
    people_bucket = "none" if people_count == 0 else ("1" if people_count == 1 else ("2" if people_count == 2 else ("3-5" if people_count <= 5 else "6+")))
    occasion = clean_val(raw.get("occasion"))

    return {
        "one_line": clean_val(raw.get("one_line")),
        "setting": setting,
        "indoor_outdoor": indoor_outdoor,
        "activity": clean_val(raw.get("activity")),
        "people_count": people_count,
        "people_bucket": people_bucket,
        "group_type": group_type,
        "occasion": occasion,
        "occasion_guess": occasion,
        "clothing_colours": clothing_colours,
        "clothing": clothing_compat,
        "objects": objects,
        "time_of_day": time_of_day,
        "mood": clean_val(raw.get("mood")),
        "model_version": model_name
    }

def main():
    all_photos = sorted(list(LIBRARY_DIR.glob("*.jpg")))
    print(f"Total photos to tag: {len(all_photos)}")
    print(f"Primary model: {primary_model}")
    print(f"Fallback model: {fallback_model}")
    print(f"Concurrency: 3 workers\n")

    start_time = time.time()
    completed_count = 0

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {executor.submit(tag_single_photo, p): p.name for p in all_photos}
        for future in as_completed(futures):
            fn = futures[future]
            try:
                fn, tag, dur, source = future.result()
                completed_count += 1
                status = f"[{completed_count}/{len(all_photos)}] {fn:<18} in {dur}s ({source})"
                if source == "cache":
                    status += " [cached]"
                print(status, flush=True)
            except Exception as e:
                print(f"[ERROR] {fn}: {e}", flush=True)

    elapsed = round(time.time() - start_time, 2)
    print(f"\nAll {completed_count} photos processed in {elapsed}s.")

    # Save to final data/tags.json
    TAGS_JSON.write_text(json.dumps(cache_data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Successfully updated {TAGS_JSON.resolve()}!")

if __name__ == "__main__":
    main()
