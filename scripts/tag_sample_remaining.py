import json
import time
from pathlib import Path
from scripts.tag_library import call_gemini_vision, normalise_tag

import os

key = os.environ.get("GEMINI_API_KEY")
model = os.environ.get("GEMINI_MODEL")

if os.path.exists(".env.local"):
    for line in open(".env.local", encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            if k == "GEMINI_API_KEY" and not key:
                key = v
            if k == "GEMINI_MODEL" and not model:
                model = v

if not key:
    raise ValueError("GEMINI_API_KEY not found in environment or .env.local")
if not model:
    raise ValueError("GEMINI_MODEL must come from environment variables only.")


prompt = Path("scripts/tag_prompt.txt").read_text(encoding="utf-8")
sample_file = Path("data/tags_sample.json")
tags = json.load(open(sample_file, encoding="utf-8"))

targets = ["pool_06.jpg", "festival_01.jpg", "hiking_01.jpg", "pets_01.jpg", "restaurant_01.jpg", "roadtrip_01.jpg"]

print(f"Using model: {model}")
for fn in targets:
    p = Path("public/library") / fn
    if not p.exists():
        print(f"File not found: {fn}")
        continue
    print(f"Tagging {fn} ... ", end="", flush=True)
    try:
        raw = call_gemini_vision(p.read_bytes(), prompt, key, model)
        if not raw or not isinstance(raw, dict):
            print(f"[INVALID RAW: {raw}]")
            continue
        norm = normalise_tag(raw)
        tags[fn] = norm
        with open(sample_file, "w", encoding="utf-8") as f:
            json.dump(tags, f, indent=2)
        desc = norm.get("one_line", "")[:60]
        print(f"[OK: {desc}]")
    except Exception as e:
        print(f"[FAILED: {e}]")
    time.sleep(5)

print(f"Sample tagging complete! Total tags: {len(tags)}")
