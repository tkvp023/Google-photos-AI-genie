import json
from pathlib import Path

tags = json.loads(Path("data/tags.json").read_text(encoding="utf-8"))
needs_review = [fn for fn, t in tags.items() if t.get("needs_review")]
print(f"Total needs_review: {len(needs_review)}")

for fn in needs_review[:5]:
    print(f"\n--- {fn} ---")
    t = tags[fn]
    print("one_line:", t.get("one_line"))
    print("setting:", t.get("setting"))
    print("people_count:", t.get("people_count"))
    print("people_bucket:", t.get("people_bucket"))
    print("activity:", t.get("activity"))
    print("objects:", t.get("objects"))
