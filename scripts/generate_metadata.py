#!/usr/bin/env python3
"""
scripts/generate_metadata.py
Deterministic, seeded, reproducible metadata generator for 200 library photos.
Assigns photos to story events, generates timestamps, GPS locations, and tagged people from cast.
Validates for contradictions and writes data/photo_meta.json, data/places.json, and reports/metadata_validation.txt.
"""

import json
import os
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Fix Windows console encoding
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TAGS_PATH = PROJECT_ROOT / "data" / "tags.json"
EVENTS_PATH = PROJECT_ROOT / "data" / "story_events.json"
CAST_PATH = PROJECT_ROOT / "data" / "cast.json"
OUTPUT_META_PATH = PROJECT_ROOT / "data" / "photo_meta.json"
OUTPUT_PLACES_PATH = PROJECT_ROOT / "data" / "places.json"
VALIDATION_REPORT_PATH = PROJECT_ROOT / "reports" / "metadata_validation.txt"

DEMO_TODAY = "2026-10-01"

MONTH_NAMES = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]

def get_season(month: int) -> str:
    # India season mapping:
    # summer: Mar-Jun (3-6)
    # monsoon: Jul-Sep (7-9)
    # post-monsoon: Oct-Nov (10-11)
    # winter: Dec-Feb (12, 1, 2)
    if month in (3, 4, 5, 6):
        return "summer"
    elif month in (7, 8, 9):
        return "monsoon"
    elif month in (10, 11):
        return "post-monsoon"
    else:
        return "winter"

def main():
    random.seed(42)

    with open(TAGS_PATH, "r", encoding="utf-8") as f:
        tags = json.load(f)

    with open(EVENTS_PATH, "r", encoding="utf-8") as f:
        events = json.load(f)

    with open(CAST_PATH, "r", encoding="utf-8") as f:
        cast_list = json.load(f)

    cast_by_name = {c["name"]: c for c in cast_list}
    events_by_theme = {}
    for ev in events:
        events_by_theme.setdefault(ev["theme"], []).append(ev)

    # Sort photos deterministically
    photos_by_theme = {}
    for fn, t in sorted(tags.items()):
        theme = fn.split("_")[0]
        photos_by_theme.setdefault(theme, []).append((fn, t))

    photo_metadata = {}
    event_assigned_photos = {ev["id"]: [] for ev in events}
    validation_issues = []

    # Map each theme's photos to its 3 events (target ~6-7 per event: 7, 7, 6 = 20)
    for theme, photo_items in sorted(photos_by_theme.items()):
        ev_list = events_by_theme.get(theme, [])
        if not ev_list:
            validation_issues.append(f"No events found for theme: {theme}")
            continue

        # Target capacities per event for this theme
        # E.g. for 20 photos across 3 events: 7, 7, 6
        target_caps = [7, 7, 6] if len(ev_list) == 3 else [len(photo_items) // len(ev_list)] * len(ev_list)

        # Prioritize matching photo attributes to specific events
        # E.g. snow photos -> snow/winter event
        # group_type: family -> family event, friends -> friends event
        assigned_to_ev = [[] for _ in ev_list]

        # First pass: special constraints
        unassigned = []
        for fn, t in photo_items:
            weather = t.get("weather_or_season", "")
            one_line = t.get("one_line", "")
            grp = t.get("group_type", "")

            target_idx = None
            if weather == "snow" or "snow" in one_line:
                # Find event in Manali or winter
                for idx, ev in enumerate(ev_list):
                    if "Manali" in ev.get("city", "") or "Snow" in ev.get("title", ""):
                        target_idx = idx
                        break

            if target_idx is not None and len(assigned_to_ev[target_idx]) < target_caps[target_idx]:
                assigned_to_ev[target_idx].append((fn, t))
            else:
                unassigned.append((fn, t))

        # Second pass: group_type affinity
        still_unassigned = []
        for fn, t in unassigned:
            grp = t.get("group_type", "")
            placed = False
            for idx, ev in enumerate(ev_list):
                if len(assigned_to_ev[idx]) >= target_caps[idx]:
                    continue
                mix = ev.get("cast_relation_mix", "")
                if (grp == "family" and mix in ("family", "mixed")) or \
                   (grp == "friends" and mix in ("friends", "mixed")) or \
                   (grp in ("solo", "couple", "crowd", "unknown") and mix in ("mixed", "solo")):
                    assigned_to_ev[idx].append((fn, t))
                    placed = True
                    break
            if not placed:
                still_unassigned.append((fn, t))

        # Third pass: fill remaining slots
        for fn, t in still_unassigned:
            for idx, ev in enumerate(ev_list):
                if len(assigned_to_ev[idx]) < target_caps[idx]:
                    assigned_to_ev[idx].append((fn, t))
                    break

        # Generate metadata for each assigned photo
        for idx, ev in enumerate(ev_list):
            event_id = ev["id"]
            event_title = ev["title"]
            d_start = datetime.strptime(ev["date_start"], "%Y-%m-%d")
            d_end = datetime.strptime(ev["date_end"], "%Y-%m-%d")
            ev_days = (d_end - d_start).days
            ev_cast = ev["cast"]
            ev_mix = ev["cast_relation_mix"]

            ev_photos = assigned_to_ev[idx]
            event_assigned_photos[event_id] = [p[0] for p in ev_photos]

            # Check capacity constraint (4-10 photos each)
            if len(ev_photos) < 4 or len(ev_photos) > 10:
                validation_issues.append(f"Event {event_id} has {len(ev_photos)} photos (outside 4-10 allowed range)")

            for photo_idx, (fn, tag) in enumerate(ev_photos):
                # Deterministic date within event range
                day_offset = (photo_idx % (ev_days + 1)) if ev_days > 0 else 0
                photo_date = d_start + timedelta(days=day_offset)

                # Time of day based on tag
                tod = tag.get("time_of_day", "unknown").lower()
                if tod == "morning":
                    hour = 7 + (photo_idx % 4)   # 07 to 10
                    minute = 10 + (photo_idx * 7) % 45
                elif tod == "afternoon":
                    hour = 12 + (photo_idx % 4)  # 12 to 15
                    minute = 5 + (photo_idx * 11) % 50
                elif tod in ("evening", "sunset"):
                    hour = 17 + (photo_idx % 3)  # 17 to 19
                    minute = (photo_idx * 13) % 55
                elif tod == "night":
                    hour = 21 + (photo_idx % 3)  # 21 to 23
                    minute = (photo_idx * 9) % 55
                else:
                    # Contextual fallback based on theme
                    if theme in ("festival", "birthday", "restaurant"):
                        hour = 19 + (photo_idx % 4)
                    else:
                        hour = 11 + (photo_idx % 5)
                    minute = (photo_idx * 8) % 50

                taken_at = photo_date.replace(hour=hour, minute=minute, second=0).isoformat() + "Z"
                year = photo_date.year
                month = photo_date.month
                month_name = MONTH_NAMES[month]
                season = get_season(month)

                # Check weather/season compatibility
                tag_weather = tag.get("weather_or_season", "unknown").lower()
                if tag_weather == "snow" and "Manali" not in ev["city"]:
                    validation_issues.append(f"{fn}: snow photo assigned to non-snow venue {ev['city']}")
                if tag_weather == "sunny" and season == "monsoon" and "sunny" not in ev.get("notes", "").lower():
                    # Check if coastal heavy monsoon
                    if ev["city"] in ("Goa", "Mumbai") and month == 7:
                        validation_issues.append(f"{fn}: sunny beach in heavy July monsoon in {ev['city']}")

                # Select people from event cast
                people_count = tag.get("people_count", 0)
                if not isinstance(people_count, int):
                    try:
                        people_count = int(people_count)
                    except:
                        people_count = 0

                num_names = min(people_count, 6)
                grp_type = tag.get("group_type", "unknown").lower()

                assigned_people = []
                if num_names > 0:
                    # Filter cast by relation if group_type is specific
                    candidate_cast = list(ev_cast)
                    if grp_type == "family":
                        family_cast = [n for n in ev_cast if cast_by_name.get(n, {}).get("relation") == "family"]
                        if family_cast: candidate_cast = family_cast
                    elif grp_type == "friends":
                        friend_cast = [n for n in ev_cast if cast_by_name.get(n, {}).get("relation") in ("friend", "colleague")]
                        if friend_cast: candidate_cast = friend_cast

                    # Pick deterministically without replacement
                    rnd = random.Random(hash(fn) & 0xffffffff)
                    shuffled = list(candidate_cast)
                    rnd.shuffle(shuffled)

                    # If needed, pad with other event cast members
                    while len(shuffled) < num_names:
                        for n in ev_cast:
                            if n not in shuffled:
                                shuffled.append(n)
                        if len(shuffled) < num_names:
                            break # Event cast exhausted

                    assigned_people = shuffled[:num_names]

                # GPS coordinates with minor realistic offset per photo (within ~200m)
                offset_lat = round(((photo_idx * 0.0004) - 0.001), 6)
                offset_lng = round(((photo_idx * 0.0003) - 0.0008), 6)
                photo_lat = round(ev["lat"] + offset_lat, 6)
                photo_lng = round(ev["lng"] + offset_lng, 6)

                place = {
                    "city": ev["city"],
                    "venue": ev["venue"],
                    "country": ev["country"],
                    "lat": photo_lat,
                    "lng": photo_lng,
                }

                photo_metadata[fn] = {
                    "synthetic": True,
                    "event_id": event_id,
                    "event_title": event_title,
                    "taken_at": taken_at,
                    "year": year,
                    "month": month,
                    "month_name": month_name,
                    "season": season,
                    "place": place,
                    "people": assigned_people,
                    "device": "Pixel 7",
                }

    # Save data/photo_meta.json
    with open(OUTPUT_META_PATH, "w", encoding="utf-8") as f:
        json.dump(photo_metadata, f, indent=2)
    print(f"Generated metadata for {len(photo_metadata)} photos -> {OUTPUT_META_PATH}")

    # Regenerate data/places.json from metadata
    cities = sorted(list(set(m["place"]["city"] for m in photo_metadata.values())))
    venues = sorted(list(set(m["place"]["venue"] for m in photo_metadata.values())))
    cast_names = sorted(list(set(c["name"] for c in cast_list)))

    places_data = {
        "namedPlaces": cities,
        "venues": venues,
        "people": cast_names,
    }

    with open(OUTPUT_PLACES_PATH, "w", encoding="utf-8") as f:
        json.dump(places_data, f, indent=2)
    print(f"Regenerated places.json with {len(cities)} cities, {len(venues)} venues, {len(cast_names)} cast names -> {OUTPUT_PLACES_PATH}")

    # Write reports/metadata_validation.txt
    validation_lines = [
        "================================================================================",
        "METADATA VALIDATION & AUDIT REPORT",
        "Generated deterministically from story_events.json and cast.json",
        f"DEMO_TODAY: {DEMO_TODAY}",
        "================================================================================\n",
        f"Total photos processed: {len(photo_metadata)}",
        f"Total story events: {len(events)}",
        f"Total cast members: {len(cast_list)}\n",
        "1. EVENT CAPACITY CHECK (4-10 photos each):",
    ]

    for ev in events:
        assigned = event_assigned_photos.get(ev["id"], [])
        status = "OK" if 4 <= len(assigned) <= 10 else "FAIL"
        validation_lines.append(f"  - {ev['id']:15s} [{ev['theme']:10s}] in {ev['city']:12s}: {len(assigned):2d} photos [{status}]")

    validation_lines.extend([
        "\n2. FIELD COVERAGE IN PHOTO_META.JSON:",
        f"  - synthetic: {sum(1 for m in photo_metadata.values() if m['synthetic'] is True)}/{len(photo_metadata)} (100.0%)",
        f"  - event_id: {sum(1 for m in photo_metadata.values() if m['event_id'])}/{len(photo_metadata)} (100.0%)",
        f"  - taken_at: {sum(1 for m in photo_metadata.values() if m['taken_at'])}/{len(photo_metadata)} (100.0%)",
        f"  - year/month/season: {sum(1 for m in photo_metadata.values() if m['year'] and m['month'] and m['season'])}/{len(photo_metadata)} (100.0%)",
        f"  - place (city, venue, lat, lng): {sum(1 for m in photo_metadata.values() if m['place']['city'] and m['place']['venue'] and m['place']['lat'])}/{len(photo_metadata)} (100.0%)",
        f"  - people assigned: {sum(1 for m in photo_metadata.values() if len(m['people']) > 0)}/{len(photo_metadata)}",
        "\n3. SEASONS DISTRIBUTION:",
    ])

    from collections import Counter
    seasons_c = Counter(m["season"] for m in photo_metadata.values())
    years_c = Counter(m["year"] for m in photo_metadata.values())
    cities_c = Counter(m["place"]["city"] for m in photo_metadata.values())

    for s, c in sorted(seasons_c.items()):
        validation_lines.append(f"  - {s:15s}: {c:3d} photos")

    validation_lines.append("\n4. YEARS DISTRIBUTION (2019-2026):")
    for y, c in sorted(years_c.items()):
        validation_lines.append(f"  - {y}: {c:3d} photos")

    validation_lines.append("\n5. CITIES DISTRIBUTION:")
    for city, c in sorted(cities_c.items()):
        validation_lines.append(f"  - {city:15s}: {c:3d} photos")

    validation_lines.append("\n6. CONTRADICTION & ERROR AUDIT:")
    if validation_issues:
        validation_lines.append(f"FAIL: {len(validation_issues)} validation issues detected:")
        for iss in validation_issues:
            validation_lines.append(f"  [X] {iss}")
    else:
        validation_lines.append("PASS: Zero contradictions detected. All constraints satisfied!")

    report_text = "\n".join(validation_lines)
    VALIDATION_REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(VALIDATION_REPORT_PATH, "w", encoding="utf-8") as f:
        f.write(report_text)
    print(f"Validation report saved -> {VALIDATION_REPORT_PATH}")

    if validation_issues:
        print(f"Validation failed with {len(validation_issues)} errors!")
        sys.exit(1)
    else:
        print("Metadata generation & validation SUCCEEDED with 0 errors!")

if __name__ == "__main__":
    main()
