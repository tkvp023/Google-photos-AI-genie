import json
from pathlib import Path

tags = json.loads(Path("data/tags.json").read_text(encoding="utf-8"))
forbidden_count = 0
for fn, t in tags.items():
    for k, v in t.items():
        if isinstance(v, str) and v.lower() in ("none", "unknown", "null"):
            print(f"Forbidden: {fn} -> {k}: {v}")
            forbidden_count += 1
        elif isinstance(v, list):
            for item in v:
                if isinstance(item, str) and item.lower() in ("none", "unknown", "null"):
                    print(f"Forbidden in list: {fn} -> {k}: {item}")
                    forbidden_count += 1

print(f"Total photos: {len(tags)}")
print(f"Total forbidden strings ('none', 'unknown', 'null'): {forbidden_count}")
