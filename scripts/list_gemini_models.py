import os
import json
import requests
from pathlib import Path

env_file = Path(".env.local")
api_key = ""
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("GEMINI_API_KEY="):
            api_key = line.split("=", 1)[1].strip().strip("\"'")

if not api_key:
    print("ERROR: GEMINI_API_KEY not found in .env.local")
    exit(1)

url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
resp = requests.get(url, timeout=30)
if resp.status_code != 200:
    print(f"ERROR: status {resp.status_code}: {resp.text}")
    exit(1)

data = resp.json()
models = data.get("models", [])
print(f"Total models returned: {len(models)}\n")
gen_models = []
for m in models:
    methods = m.get("supportedGenerationMethods", [])
    if "generateContent" in methods:
        name = m.get("name", "").replace("models/", "")
        disp = m.get("displayName", "")
        desc = m.get("description", "")
        version = m.get("version", "")
        gen_models.append((name, disp, desc, version))

print("MODELS SUPPORTING generateContent:")
print("-" * 80)
for name, disp, desc, version in sorted(gen_models):
    print(f"Model ID: {name:<35} | Display: {disp}")
print("-" * 80)
