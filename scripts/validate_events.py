import json
from collections import Counter

with open("data/cast.json", "r", encoding="utf-8") as f:
    cast = json.load(f)
print(f"Cast count: {len(cast)}")
for c in cast:
    print(f"  {c['name']} ({c['relation']}): {c['notes']}")

with open("data/story_events.json", "r", encoding="utf-8") as f:
    events = json.load(f)
print(f"\nEvents count: {len(events)}")
theme_counts = Counter(e["theme"] for e in events)
city_counts = Counter(e["city"] for e in events)
print("Themes in events:", dict(theme_counts))
print("Cities in events:", dict(city_counts))

dates = [e["date_start"] for e in events] + [e["date_end"] for e in events]
print("Min date:", min(dates), "Max date:", max(dates))

cast_names = set(c["name"] for c in cast)
for e in events:
    assert e["theme"] in theme_counts
    assert all(n in cast_names for n in e["cast"]), f"Unknown cast name in {e['id']}: {e['cast']}"
    assert e["cast_relation_mix"] in ("family", "friends", "mixed", "solo")
    assert 2019 <= int(e["date_start"][:4]) <= 2026
    assert 2019 <= int(e["date_end"][:4]) <= 2026

print("ALL CAST AND EVENT CONSTRAINTS VALIDATED CLEANLY!")
