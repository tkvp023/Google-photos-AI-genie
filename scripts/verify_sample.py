import json

with open("data/tags_sample.json", "r", encoding="utf-8") as f:
    data = json.load(f)

print(f"Total tagged sample photos: {len(data)}\n")
for fn in sorted(data.keys()):
    t = data[fn]
    print(f"=== {fn} ===")
    print(f"  1-line: {t.get('one_line')}")
    print(f"  setting: {t.get('setting')} | in/out: {t.get('indoor_outdoor')}")
    print(f"  activity: {t.get('activity')}")
    print(f"  occasion: {t.get('occasion_guess')} ({t.get('occasion_basis')})")
    print(f"  people: {t.get('people_count')} ({t.get('people_bucket')}) | group: {t.get('group_type')} | ages: {t.get('people_ages')}")
    clothing_strs = [f"{c.get('colour', '')} {c.get('item', '')}".strip() for c in t.get('clothing', [])[:3]]
    print(f"  clothing: {clothing_strs}")
    print(f"  objects: {t.get('objects')}")
    print(f"  time: {t.get('time_of_day')} | weather: {t.get('weather_or_season')} | mood: {t.get('mood')}")
    print()
