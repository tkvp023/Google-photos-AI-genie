import os
import json
import base64
import time
import requests
from pathlib import Path

env_file = Path(".env.local")
api_key = ""
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("GEMINI_API_KEY="):
            api_key = line.split("=", 1)[1].strip().strip("\"'")

test_img_path = Path("public/library/pool_01.jpg")
if not test_img_path.exists():
    test_img_path = list(Path("public/library").glob("*.jpg"))[0]

img_b64 = base64.b64encode(test_img_path.read_bytes()).decode("utf-8")

candidate_models = [
    "gemini-3.1-pro-preview",
    "gemini-2.5-pro",
    "gemini-pro-latest",
    "gemini-2.5-flash",
    "gemini-flash-latest"
]

prompt = "Describe what you see in this photo. Return JSON with key 'description'."

print(f"Testing models with image {test_img_path.name}...\n")
for model in candidate_models:
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
    t0 = time.time()
    try:
        resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=20)
        dur = round(time.time() - t0, 3)
        if resp.status_code == 200:
            data = resp.json()
            text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            print(f"SUCCESS [200]: {model} ({dur}s)")
            print(f"  Output: {text[:120]}...\n")
        else:
            print(f"FAILED [{resp.status_code}]: {model} ({dur}s) - {resp.text[:150]}\n")
    except Exception as e:
        dur = round(time.time() - t0, 3)
        print(f"ERROR: {model} ({dur}s) - {e}\n")
