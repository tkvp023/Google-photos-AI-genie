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
img_b64 = base64.b64encode(test_img_path.read_bytes()).decode("utf-8")

candidate_models = [
    "gemini-3.1-pro-preview",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite",
    "gemini-3.1-flash-lite-preview",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
    "gemini-omni-1.1-flash"
]

prompt = "Describe what you see in this photo. Return JSON with key 'description'."

print(f"Testing all candidate models with {test_img_path.name}...\n")
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
            print(f"SUCCESS [200]: {model:<30} ({dur}s)")
            print(f"  {text[:100]}...\n")
        else:
            code = resp.status_code
            err_msg = resp.json().get("error", {}).get("message", resp.text[:80])
            print(f"FAILED [{code}]: {model:<30} ({dur}s) - {err_msg[:80]}")
    except Exception as e:
        dur = round(time.time() - t0, 3)
        print(f"ERROR: {model:<30} ({dur}s) - {e}")
    time.sleep(0.5)
