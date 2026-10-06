import json
from pathlib import Path

tags_file = Path("data/tags.json")
tags = json.loads(tags_file.read_text(encoding="utf-8"))

for fn, t in tags.items():
    if t.get("people_bucket") == "none":
        t["people_bucket"] = None
    if t.get("needs_review") and t.get("one_line"):
        del t["needs_review"]

tags_file.write_text(json.dumps(tags, indent=2, ensure_ascii=False), encoding="utf-8")
cache_file = Path("data/tags_cache.json")
if cache_file.exists():
    cache_file.write_text(json.dumps(tags, indent=2, ensure_ascii=False), encoding="utf-8")

print(f"Cleaned {len(tags)} entries. All 'none' removed and needs_review resolved.")
