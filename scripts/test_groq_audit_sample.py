import os
import json
import csv
import time
import requests
from pathlib import Path

env_file = Path(".env.local")
groq_key = ""
for line in env_file.read_text(encoding="utf-8").splitlines():
    if line.startswith("GROQ_API_KEY="):
        groq_key = line.split("=", 1)[1].strip()

tags_data = json.loads(Path("data/tags.json").read_text(encoding="utf-8"))
credits_data = {row["file"]: row for row in csv.DictReader(open("data/credits.csv", encoding="utf-8"))}

audit_before_rows = list(csv.DictReader(open("audit_before.csv", encoding="utf-8")))
notes_by_photo = {}
for r in audit_before_rows:
    pid = r["photo_id"]
    if pid not in notes_by_photo:
        notes_by_photo[pid] = []
    notes_by_photo[pid].append(f"- {r['field']} ('{r['value']}'): {r['verdict']} - {r['reason']}")

def audit_photo(pid):
    tag = tags_data.get(pid, {})
    cred = credits_data.get(pid, {})
    notes = "\n".join(notes_by_photo.get(pid, []))
    
    clothing_val = tag.get("clothing_colours") or tag.get("clothing")
    if isinstance(clothing_val, list):
        clothing_str = ", ".join([f"{c.get('colour', '')} {c.get('item', '')}".strip() if isinstance(c, dict) else str(c) for c in clothing_val])
    else:
        clothing_str = str(clothing_val)
        
    obj_val = tag.get("objects", [])
    obj_str = ", ".join(obj_val) if isinstance(obj_val, list) else str(obj_val)
    
    prompt = f"""You are an independent, strict, expert image tag auditor.
Audit the newly updated metadata tags for image {pid}.

GROUND TRUTH CONTEXT:
- Image file / Pixabay URL slug: {cred.get('url', '')}
- Baseline ground-truth inspection notes:
{notes}

NEW CANDIDATE TAGS TO AUDIT:
1. one_line: "{tag.get('one_line', '')}"
2. group_type: "{tag.get('group_type', '')}"
3. occasion: "{tag.get('occasion_guess', '')}"
4. activity: "{tag.get('activity', '')}"
5. clothing_colours: "{clothing_str}"
6. objects: "{obj_str}"

AUDIT RUBRIC:
- "correct": directly supported by ground truth, accurately described, or correctly null/empty when entity is absent.
- "unsupported": assumes, guesses, or speculates without visual evidence (e.g. assuming hikers or strangers are 'friends', guessing an unstated occasion, assuming relationships).
- "wrong": factually contradicted by the image (e.g. claiming people or objects when none exist, wrong activity, wrong color).

RULES:
- Evaluate each field strictly and independently. Do NOT default to correct.
- Return ONLY valid JSON:
{{
  "verdicts": [
    {{"field": "one_line", "verdict": "correct|unsupported|wrong", "reason": "brief explanation"}},
    {{"field": "group_type", "verdict": "correct|unsupported|wrong", "reason": "brief explanation"}},
    {{"field": "occasion", "verdict": "correct|unsupported|wrong", "reason": "brief explanation"}},
    {{"field": "activity", "verdict": "correct|unsupported|wrong", "reason": "brief explanation"}},
    {{"field": "clothing_colours", "verdict": "correct|unsupported|wrong", "reason": "brief explanation"}},
    {{"field": "objects", "verdict": "correct|unsupported|wrong", "reason": "brief explanation"}}
  ]
}}"""

    resp = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
        json={
            "model": "qwen/qwen3.8-27b",
            "temperature": 0.0,
            "messages": [{"role": "user", "content": prompt}]
        },
        timeout=25
    )
    return resp.json()["choices"][0]["message"]["content"]

print("=== Testing pool_01.jpg ===")
print(audit_photo("pool_01.jpg"))
time.sleep(2.5)
print("\n=== Testing hiking_15.jpg ===")
print(audit_photo("hiking_15.jpg"))
