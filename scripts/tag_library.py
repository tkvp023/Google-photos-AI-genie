#!/usr/bin/env python3
"""
scripts/tag_library.py
Tags photos in /public/library/ using Gemini Flash Vision.
Applies normalisation according to DATA_SCHEMAS.md and PROMPTS_REFERENCE.md.

Usage:
  python scripts/tag_library.py --limit 10 --output data/tags_sample.json
  python scripts/tag_library.py --output data/tags.json
"""

import argparse
import base64
import json
import os
import sys
import time
from pathlib import Path

# Resolve paths
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DEFAULT_LIBRARY_DIR = PROJECT_ROOT / "public" / "library"
DEFAULT_PROMPT_FILE = SCRIPT_DIR / "tag_prompt.txt"
DEFAULT_OUTPUT_FILE = PROJECT_ROOT / "data" / "tags.json"

BASE_COLOURS = {
    "red", "blue", "green", "yellow", "orange", "pink", "purple",
    "white", "black", "grey", "brown", "beige"
}

COLOUR_MAP = {
    "gray": "grey",
    "silver": "grey",
    "gold": "yellow",
    "navy": "blue",
    "turquoise": "blue",
    "teal": "blue",
    "maroon": "red",
    "coral": "orange",
    "cream": "beige",
    "tan": "beige",
    "khaki": "beige",
}

VALID_INDOOR_OUTDOOR = {"indoor", "outdoor", "unknown"}
VALID_GROUP_TYPE = {"solo", "couple", "family", "friends", "mixed", "unknown"}
VALID_TIME_OF_DAY = {"morning", "afternoon", "evening", "night", "unknown"}
VALID_AGES = {"child", "teen", "adult", "older adult"}

def normalise_colour(c: str) -> str:
    c = c.lower().strip()
    if c in BASE_COLOURS:
        return c
    return COLOUR_MAP.get(c, "unknown")

def parse_clothing(raw_list) -> list:
    if not isinstance(raw_list, list):
        return []
    result = []
    for item in raw_list:
        if not item:
            continue
        if isinstance(item, dict):
            col = normalise_colour(str(item.get("colour") or item.get("color") or "unknown"))
            it = str(item.get("item") or "").lower().strip()
            result.append({"colour": col, "item": it})
        elif isinstance(item, str):
            parts = item.strip().split(" ", 1)
            if len(parts) == 2:
                col = normalise_colour(parts[0])
                it = parts[1].lower().strip()
                result.append({"colour": col, "item": it})
            else:
                result.append({"colour": "unknown", "item": item.lower().strip()})
    return result

def compute_people_bucket(count: int) -> str:
    if count <= 1:
        return "1"
    if count == 2:
        return "2"
    if count <= 5:
        return "3-5"
    return "6+"

def normalise_tag(raw) -> dict:
    """Normalises raw tag output to adhere strictly to DATA_SCHEMAS.md."""
    if isinstance(raw, list) and len(raw) > 0:
        raw = raw[0]
    if not isinstance(raw, dict):
        raw = {}
    one_line = str(raw.get("one_line", "") or "").lower().strip()
    setting = str(raw.get("setting", "unknown")).lower().strip()
    indoor_outdoor = str(raw.get("indoor_outdoor", "unknown")).lower().strip()
    if indoor_outdoor not in VALID_INDOOR_OUTDOOR:
        indoor_outdoor = "unknown"

    activity = str(raw.get("activity", "unknown")).lower().strip()
    occasion_guess = str(raw.get("occasion_guess", "none")).lower().strip()
    occasion_basis = str(raw.get("occasion_basis", "none")).lower().strip()

    try:
        people_count = int(raw.get("people_count", 0))
    except (ValueError, TypeError):
        people_count = 0
    if people_count < 0:
        people_count = 0

    people_ages_raw = raw.get("people_ages", [])
    if isinstance(people_ages_raw, list):
        people_ages = [str(a).lower().strip() for a in people_ages_raw if str(a).lower().strip() in VALID_AGES]
    else:
        people_ages = []

    people_bucket = compute_people_bucket(people_count)

    group_type = str(raw.get("group_type", "unknown")).lower().strip()
    if group_type not in VALID_GROUP_TYPE:
        group_type = "unknown"

    clothing = parse_clothing(raw.get("clothing", []))

    raw_objects = raw.get("objects", [])
    if isinstance(raw_objects, list):
        objects = [str(o).lower().strip() for o in raw_objects if str(o).strip()]
    else:
        objects = []

    time_of_day = str(raw.get("time_of_day", "unknown")).lower().strip()
    if time_of_day not in VALID_TIME_OF_DAY:
        time_of_day = "unknown"

    weather_or_season = str(raw.get("weather_or_season", "unknown")).lower().strip()
    mood = str(raw.get("mood", "unknown")).lower().strip()
    text_in_image = str(raw.get("text_in_image", "none")).lower().strip()

    return {
        "one_line": one_line,
        "setting": setting,
        "indoor_outdoor": indoor_outdoor,
        "activity": activity,
        "occasion_guess": occasion_guess,
        "occasion_basis": occasion_basis,
        "people_count": people_count,
        "people_ages": people_ages,
        "people_bucket": people_bucket,
        "group_type": group_type,
        "clothing": clothing,
        "objects": objects,
        "time_of_day": time_of_day,
        "weather_or_season": weather_or_season,
        "mood": mood,
        "text_in_image": text_in_image,
    }

def call_gemini_vision(img_bytes: bytes, prompt_text: str, api_key: str, model_name: str) -> dict:
    import requests

    b64_img = base64.b64encode(img_bytes).decode("utf-8")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt_text},
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": b64_img
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.1,
            "maxOutputTokens": 2048,
        }
    }

    last_err = None
    for attempt in range(1, 6):
        try:
            resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=60)
            if resp.status_code == 429 or resp.status_code >= 500:
                resp_json = {}
                try:
                    resp_json = resp.json()
                except Exception:
                    pass
                msg = resp_json.get("error", {}).get("message", resp.text)
                if resp.status_code == 429:
                    time.sleep(20)
                raise RuntimeError(f"HTTP {resp.status_code}: {msg}")
            resp.raise_for_status()
            result = resp.json()

            candidates = result.get("candidates", [])
            if not candidates:
                raise ValueError(f"No candidates returned: {result}")

            text_part = candidates[0]["content"]["parts"][0]["text"].strip()
            if text_part.startswith("```"):
                lines = text_part.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]
                text_part = "\n".join(lines).strip()
            return json.loads(text_part)
        except Exception as e:
            last_err = e
            if attempt < 5:
                delay = 10 if "429" in str(e) else attempt * 5
                time.sleep(delay)
            else:
                raise last_err
    raise last_err

def main():
    parser = argparse.ArgumentParser(description="Tag library photos using Gemini Flash Vision.")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of photos to tag (e.g. 10 for sample)")
    parser.add_argument("--output", type=str, default=str(DEFAULT_OUTPUT_FILE), help="Output JSON path")
    parser.add_argument("--library-dir", type=str, default=str(DEFAULT_LIBRARY_DIR), help="Path to images directory")
    parser.add_argument("--force", action="store_true", help="Re-tag already tagged photos")
    args = parser.parse_args()

    # Auto-load .env.local if present
    env_local = PROJECT_ROOT / ".env.local"
    if env_local.exists():
        for line in env_local.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                if k not in os.environ:
                    os.environ[k] = v

    api_key = os.environ.get("GEMINI_API_KEY")
    model_name = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash")

    if not api_key:
        print("[ERROR] GEMINI_API_KEY environment variable is not set.", file=sys.stderr)
        print("Please set GEMINI_API_KEY before running this script:", file=sys.stderr)
        print("  Windows: $env:GEMINI_API_KEY=\"your_key\"", file=sys.stderr)
        sys.exit(1)

    lib_path = Path(args.library_dir)
    if not lib_path.exists():
        print(f"[ERROR] Library directory not found: {lib_path}", file=sys.stderr)
        sys.exit(1)

    prompt_file = DEFAULT_PROMPT_FILE
    if not prompt_file.exists():
        print(f"[ERROR] Prompt file not found: {prompt_file}", file=sys.stderr)
        sys.exit(1)

    prompt_text = prompt_file.read_text(encoding="utf-8")
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    tags = {}
    if output_path.exists() and not args.force:
        try:
            with open(output_path, "r", encoding="utf-8") as f:
                tags = json.load(f)
            print(f"Loaded {len(tags)} existing tags from {output_path}")
        except Exception as e:
            print(f"[WARN] Could not parse existing output file {output_path}: {e}")

    # Collect images
    image_files = sorted([p for p in lib_path.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}])
    if not image_files:
        print(f"[WARN] No image files found in {lib_path}")
        sys.exit(0)

    to_process = []
    for p in image_files:
        is_empty = p.name in tags and (not tags[p.name].get("one_line") and tags[p.name].get("setting") == "unknown")
        if args.force or p.name not in tags or is_empty:
            to_process.append(p)

    if args.limit and args.limit <= 10:
        # Select 1 photo per theme to ensure maximum diversity across themes
        theme_dict = {}
        for p in to_process:
            theme = p.name.split("_")[0]
            if theme not in theme_dict:
                theme_dict[theme] = p
        diverse_sample = list(theme_dict.values())
        if len(diverse_sample) < args.limit:
            for p in to_process:
                if p not in diverse_sample and len(diverse_sample) < args.limit:
                    diverse_sample.append(p)
        to_process = diverse_sample[:args.limit]
    elif args.limit:
        to_process = to_process[:args.limit]

    print(f"Total images found: {len(image_files)}")
    print(f"Images to process: {len(to_process)}")
    print(f"Selected sample files: {[p.name for p in to_process]}")
    print(f"Using Gemini model: {model_name}")

    count = 0
    for img_file in to_process:
        count += 1
        fn = img_file.name
        print(f"[{count}/{len(to_process)}] Tagging {fn} ...", end="", flush=True)

        try:
            img_bytes = img_file.read_bytes()
            raw_tag = None
            models_to_try = [model_name, "gemini-3.7-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash"]
            for m in models_to_try:
                try:
                    raw_tag = call_gemini_vision(img_bytes, prompt_text, api_key, m)
                    if raw_tag:
                        break
                except Exception as me:
                    if "429" in str(me) or "503" in str(me):
                        continue
                    else:
                        raise me
            if not raw_tag:
                raise RuntimeError("All models in pool throttled")
            norm_tag = normalise_tag(raw_tag)
            tags[fn] = norm_tag
            print(" [OK]")
        except Exception as e:
            print(f" [FAILED: {e}]")

        # Save progressively
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(tags, f, indent=2)

        time.sleep(7.5)

    print(f"\n[DONE] Saved {len(tags)} tags to {output_path}")
    coverage = len(tags) / len(image_files) if image_files else 0
    print(f"Tag coverage: {coverage * 100:.1f}% ({len(tags)}/{len(image_files)})")

if __name__ == "__main__":
    main()
