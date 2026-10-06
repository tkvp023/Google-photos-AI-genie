import os
import json
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
model_name = env_vars.get("GEMINI_TAG_MODEL", "gemini-3.5-flash")
fallback_model = env_vars.get("GEMINI_TAG_MODEL_FALLBACK", "gemini-3.5-flash-lite")

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

def tag_image(img_path: Path, model: str):
    img_b64 = base64.b64encode(img_path.read_bytes()).decode("utf-8")
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
    t0 = time.time()
    for attempt in range(1, 4):
        try:
            resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=35)
            latency = round(time.time() - t0, 3)
            if resp.status_code == 200:
                data = resp.json()
                raw_text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                parsed = clean_json(raw_text)
                parsed["model_version"] = model
                return parsed, latency, None
            elif resp.status_code in (429, 503):
                time.sleep(2 * attempt)
            else:
                return None, latency, f"HTTP {resp.status_code}: {resp.text[:120]}"
        except Exception as e:
            if attempt == 3:
                return None, round(time.time() - t0, 3), str(e)
            time.sleep(2)
    return None, round(time.time() - t0, 3), "Max attempts reached"

test_photos = [
    Path("public/library/pool_01.jpg"),
    Path("public/library/beach_01.jpg"),
    Path("public/library/restaurant_01.jpg"),
    Path("public/library/birthday_01.jpg"),
    Path("public/library/hiking_01.jpg"),
]

print(f"=== 5-PHOTO VALIDATION TEST ===")
print(f"Primary: {model_name}")
print(f"Fallback: {fallback_model}\n")

results = []
for p in test_photos:
    print(f"Testing {p.name} with {model_name}...")
    res, lat, err = tag_image(p, model_name)
    used_model = model_name
    if err or not res:
        print(f"  Primary model failed ({err}), trying fallback {fallback_model}...")
        res, lat, err = tag_image(p, fallback_model)
        used_model = fallback_model
    
    assert res is not None, f"Failed to tag {p.name}: {err}"
    assert "one_line" in res, "Missing one_line"
    assert "setting" in res, "Missing setting"
    assert "people_count" in res, "Missing people_count"
    
    # Check no 'unknown' or 'none' strings
    for k, v in res.items():
        if isinstance(v, str):
            assert v.lower() not in ("none", "unknown", ""), f"Forbidden string '{v}' in field '{k}'"
        elif isinstance(v, list):
            for item in v:
                if isinstance(item, str):
                    assert item.lower() not in ("none", "unknown", ""), f"Forbidden item '{item}' in list '{k}'"

    print(f"  SUCCESS in {lat}s (model: {used_model}):")
    print(f"    one_line: {res.get('one_line')}")
    print(f"    setting: {res.get('setting')}, indoor_outdoor: {res.get('indoor_outdoor')}")
    print(f"    activity: {res.get('activity')}, group_type: {res.get('group_type')}")
    print(f"    occasion: {res.get('occasion')}, people_count: {res.get('people_count')}")
    print(f"    clothing_colours: {res.get('clothing_colours')}")
    print(f"    objects: {res.get('objects')}")
    print(f"    time_of_day: {res.get('time_of_day')}, mood: {res.get('mood')}")
    print()
    results.append((p.name, lat, used_model, res))

print("ALL 5 PHOTOS PASSED SCHEMA & STRICT NULL CHECKS!")
