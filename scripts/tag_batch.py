#!/usr/bin/env python3
"""
scripts/tag_batch.py
Tags specific photos into data/tags.json with rate-limit safety.
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
TAG_PROMPT = PROJECT_ROOT / "scripts" / "tag_prompt.txt"
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
model_name = "gemini-3.5-flash"
print(f"Using Gemini model: {model_name}")

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

def call_gemini(img_bytes, prompt):
    b64_img = base64.b64encode(img_bytes).decode("utf-8")
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": "image/jpeg", "data": b64_img}}
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.1,
            "maxOutputTokens": 2048,
        }
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
    for attempt in range(1, 6):
        try:
            resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=40)
            print(f" status={resp.status_code} ", end="", flush=True)
            if resp.status_code == 429:
                delay = 15 * attempt
                print(f"[Rate limited, sleeping {delay}s] ", end="", flush=True)
                time.sleep(delay)
                continue
            resp.raise_for_status()
            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates: raise ValueError("No candidate")
            text = candidates[0]["content"]["parts"][0]["text"].strip()
            if text.startswith("```"):
                lines = text.splitlines()
                if lines[0].startswith("```"): lines = lines[1:]
                if lines and lines[-1].strip() == "```": lines = lines[:-1]
                text = "\n".join(lines).strip()
            return json.loads(text)
        except Exception as e:
            print(f"[err: {e}] ", end="", flush=True)
            if attempt < 5:
                time.sleep(5 * attempt)
            else:
                raise e

def tag_files(file_names):
    prompt_text = TAG_PROMPT.read_text(encoding="utf-8")
    tags = {}
    if TAGS_JSON.exists():
        with open(TAGS_JSON, "r", encoding="utf-8") as f:
            tags = json.load(f)

    for fn in file_names:
        if fn in tags and tags[fn].get("one_line"):
            print(f"Skipping {fn} (already tagged)")
            continue

        img_path = LIBRARY_DIR / fn
        if not img_path.exists():
            print(f"File not found: {img_path}")
            continue

        print(f"Tagging {fn} ... ", end="", flush=True)
        try:
            raw = call_gemini(img_path.read_bytes(), prompt_text)
            norm = normalise_tag(raw)
            tags[fn] = norm
            with open(TAGS_JSON, "w", encoding="utf-8") as f:
                json.dump(tags, f, indent=2)
            print("[OK]")
        except Exception as e:
            print(f"[ERROR: {e}]")

        time.sleep(12)  # Generous pause to prevent 429

if __name__ == "__main__":
    files = sys.argv[1:] if len(sys.argv) > 1 else [
        "kids_11.jpg", "pets_11.jpg", "pool_11.jpg", "restaurant_11.jpg", "roadtrip_11.jpg"
    ]
    tag_files(files)
