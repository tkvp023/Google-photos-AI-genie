import os
import requests
import json
from pathlib import Path

env_file = Path(".env.local")
groq_key = ""
for line in env_file.read_text(encoding="utf-8").splitlines():
    if line.startswith("GROQ_API_KEY="):
        groq_key = line.split("=", 1)[1].strip()

prompt = """You are an independent, strict visual tag auditor.
Audit the following candidate tag against ground truth context:
Context: Image shows two hikers from behind walking on a mountain trail.
Candidate tag: group_type = "friends"

Rubric:
- "correct": directly supported by ground truth visual facts without guessing.
- "unsupported": assumed or guessed without visible evidence (e.g., assuming two hikers are friends rather than co-hikers/strangers).
- "wrong": contradicted by the image (e.g. says solo when multiple people, or says friends when 0 people).

Return ONLY JSON:
{"verdict": "correct"|"unsupported"|"wrong", "reason": "brief explanation"}
"""

resp = requests.post(
    "https://api.groq.com/openai/v1/chat/completions",
    headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
    json={
        "model": "qwen/qwen3.8-27b",
        "temperature": 0.0,
        "messages": [{"role": "user", "content": prompt}]
    },
    timeout=20
)
print("Status:", resp.status_code)
print("Output:", resp.json()["choices"][0]["message"]["content"])
