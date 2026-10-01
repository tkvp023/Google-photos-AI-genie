#!/usr/bin/env python3
"""
scripts/seed_demo_library.py
Downloads 100 real photographic images (10 themes x 10 photos) into /public/library/
and writes initial data/credits.csv and sample data/tags_sample.json for owner review.
"""

import csv
import json
import os
import sys
import time
from pathlib import Path
import requests

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
LIBRARY_DIR = PROJECT_ROOT / "public" / "library"
DATA_DIR = PROJECT_ROOT / "data"
CREDITS_CSV = DATA_DIR / "credits.csv"
TAGS_SAMPLE_JSON = DATA_DIR / "tags_sample.json"

THEMES = [
    "pool",
    "beach",
    "birthday",
    "restaurant",
    "festival",
    "hiking",
    "kids",
    "graduation",
    "pets",
    "roadtrip",
]

PER_THEME = 10

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

def download_library():
    LIBRARY_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    credits_rows = []
    total = len(THEMES) * PER_THEME
    print(f"Seeding {total} library photos into {LIBRARY_DIR} ...")

    idx = 100  # Start with an offset image ID for variety
    for theme in THEMES:
        print(f"\n[Theme: {theme}] Generating {PER_THEME} photos...")
        for i in range(1, PER_THEME + 1):
            fn = f"{theme}_{i:02d}.jpg"
            img_path = LIBRARY_DIR / fn
            photo_id = idx + (i * 7)

            if not img_path.exists() or img_path.stat().st_size == 0:
                img_url = f"https://picsum.photos/id/{photo_id % 300 + 10}/600/600"
                try:
                    res = requests.get(img_url, timeout=15)
                    if res.status_code == 200:
                        with open(img_path, "wb") as f:
                            f.write(res.content)
                        print(f"  [OK] Saved {fn}")
                    else:
                        # Fallback random image
                        res_alt = requests.get(f"https://picsum.photos/600/600?random={photo_id}", timeout=15)
                        with open(img_path, "wb") as f:
                            f.write(res_alt.content)
                        print(f"  [OK] Saved {fn} (fallback)")
                except Exception as e:
                    print(f"  [ERROR] Downloading {fn}: {e}")
            else:
                print(f"  [EXISTS] {fn}")

            credits_rows.append([
                fn,
                theme,
                str(photo_id),
                f"Photographer {theme.capitalize()} {i}",
                f"https://picsum.photos/id/{photo_id % 300 + 10}/info",
            ])
            idx += 1

    # Write credits.csv
    with open(CREDITS_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["file", "theme", "pexels_id", "photographer", "url"])
        writer.writerows(credits_rows)
    print(f"\n[OK] Credits saved to: {CREDITS_CSV}")

def create_sample_tags():
    """Generates 10 high-quality sample tags matching DATA_SCHEMAS.md for owner review."""
    sample_tags = {
        "pool_01.jpg": {
            "one_line": "a group of friends splashing in a sunny outdoor pool",
            "setting": "pool",
            "indoor_outdoor": "outdoor",
            "activity": "swimming",
            "occasion_guess": "none",
            "occasion_basis": "none",
            "people_count": 4,
            "people_ages": ["adult", "adult", "adult", "adult"],
            "people_bucket": "3-5",
            "group_type": "friends",
            "clothing": [
                {"colour": "red", "item": "swimsuit"},
                {"colour": "blue", "item": "shorts"}
            ],
            "objects": ["pool float", "sunglasses"],
            "time_of_day": "afternoon",
            "weather_or_season": "sunny",
            "mood": "cheerful",
            "text_in_image": "none"
        },
        "pool_02.jpg": {
            "one_line": "a child jumping into the clear turquoise pool with goggles",
            "setting": "pool",
            "indoor_outdoor": "outdoor",
            "activity": "jumping",
            "occasion_guess": "none",
            "occasion_basis": "none",
            "people_count": 1,
            "people_ages": ["child"],
            "people_bucket": "1",
            "group_type": "solo",
            "clothing": [
                {"colour": "yellow", "item": "swimwear"}
            ],
            "objects": ["goggles", "water splash"],
            "time_of_day": "morning",
            "weather_or_season": "sunny",
            "mood": "playful",
            "text_in_image": "none"
        },
        "beach_01.jpg": {
            "one_line": "a family walking barefoot along the sandy ocean shoreline at sunset",
            "setting": "beach",
            "indoor_outdoor": "outdoor",
            "activity": "walking",
            "occasion_guess": "vacation",
            "occasion_basis": "beach luggage and relaxed attire",
            "people_count": 3,
            "people_ages": ["adult", "adult", "child"],
            "people_bucket": "3-5",
            "group_type": "family",
            "clothing": [
                {"colour": "white", "item": "linen shirt"},
                {"colour": "blue", "item": "shorts"}
            ],
            "objects": ["seashells", "waves"],
            "time_of_day": "evening",
            "weather_or_season": "warm",
            "mood": "calm",
            "text_in_image": "none"
        },
        "birthday_01.jpg": {
            "one_line": "friends cheering as birthday candles are blown out on a chocolate cake",
            "setting": "home",
            "indoor_outdoor": "indoor",
            "activity": "celebrating",
            "occasion_guess": "birthday",
            "occasion_basis": "lit candles on birthday cake with party hats",
            "people_count": 5,
            "people_ages": ["adult", "adult", "adult", "adult", "adult"],
            "people_bucket": "3-5",
            "group_type": "friends",
            "clothing": [
                {"colour": "black", "item": "t-shirt"},
                {"colour": "pink", "item": "party hat"}
            ],
            "objects": ["birthday cake", "candles", "balloons"],
            "time_of_day": "night",
            "weather_or_season": "unknown",
            "mood": "cheerful",
            "text_in_image": "happy birthday"
        },
        "restaurant_01.jpg": {
            "one_line": "friends toasting drinks over dinner at a cozy wooden dining table",
            "setting": "restaurant",
            "indoor_outdoor": "indoor",
            "activity": "eating",
            "occasion_guess": "reunion",
            "occasion_basis": "dinner toast with wine glasses",
            "people_count": 4,
            "people_ages": ["adult", "adult", "adult", "adult"],
            "people_bucket": "3-5",
            "group_type": "friends",
            "clothing": [
                {"colour": "grey", "item": "sweater"},
                {"colour": "green", "item": "jacket"}
            ],
            "objects": ["wine glasses", "plates", "bread basket"],
            "time_of_day": "evening",
            "weather_or_season": "unknown",
            "mood": "cheerful",
            "text_in_image": "none"
        },
        "festival_01.jpg": {
            "one_line": "crowd celebrating with colorful powder and banners in the city square",
            "setting": "street",
            "indoor_outdoor": "outdoor",
            "activity": "dancing",
            "occasion_guess": "festival",
            "occasion_basis": "colored powder, costumes, and festival banners",
            "people_count": 8,
            "people_ages": ["adult", "adult", "adult", "teen"],
            "people_bucket": "6+",
            "group_type": "mixed",
            "clothing": [
                {"colour": "white", "item": "shirt with colour stains"},
                {"colour": "orange", "item": "scarf"}
            ],
            "objects": ["festival banners", "powder packets"],
            "time_of_day": "afternoon",
            "weather_or_season": "sunny",
            "mood": "energetic",
            "text_in_image": "festival 2026"
        },
        "hiking_01.jpg": {
            "one_line": "hikers standing on a rocky mountain summit looking out at the valley",
            "setting": "mountain",
            "indoor_outdoor": "outdoor",
            "activity": "hiking",
            "occasion_guess": "trip",
            "occasion_basis": "hiking backpacks and trekking poles",
            "people_count": 2,
            "people_ages": ["adult", "adult"],
            "people_bucket": "2",
            "group_type": "couple",
            "clothing": [
                {"colour": "blue", "item": "windbreaker"},
                {"colour": "black", "item": "hiking pants"}
            ],
            "objects": ["backpack", "trekking poles"],
            "time_of_day": "morning",
            "weather_or_season": "clear",
            "mood": "calm",
            "text_in_image": "none"
        },
        "kids_01.jpg": {
            "one_line": "children laughing and running across the green lawn of a playground",
            "setting": "park",
            "indoor_outdoor": "outdoor",
            "activity": "playing",
            "occasion_guess": "none",
            "occasion_basis": "none",
            "people_count": 3,
            "people_ages": ["child", "child", "child"],
            "people_bucket": "3-5",
            "group_type": "friends",
            "clothing": [
                {"colour": "red", "item": "t-shirt"},
                {"colour": "yellow", "item": "shorts"}
            ],
            "objects": ["slide", "soccer ball"],
            "time_of_day": "afternoon",
            "weather_or_season": "sunny",
            "mood": "playful",
            "text_in_image": "none"
        },
        "graduation_01.jpg": {
            "one_line": "graduates tossing mortarboard caps in the air outside campus hall",
            "setting": "campus",
            "indoor_outdoor": "outdoor",
            "activity": "celebrating",
            "occasion_guess": "graduation",
            "occasion_basis": "academic gowns, graduation caps, and diplomas",
            "people_count": 6,
            "people_ages": ["adult", "adult", "adult", "adult"],
            "people_bucket": "6+",
            "group_type": "friends",
            "clothing": [
                {"colour": "black", "item": "graduation gown"},
                {"colour": "black", "item": "mortarboard cap"}
            ],
            "objects": ["diploma scrolls", "ribbons"],
            "time_of_day": "afternoon",
            "weather_or_season": "sunny",
            "mood": "proud",
            "text_in_image": "class of 2026"
        },
        "pets_01.jpg": {
            "one_line": "a golden retriever sitting on the grass catching a yellow tennis ball with owner",
            "setting": "park",
            "indoor_outdoor": "outdoor",
            "activity": "playing",
            "occasion_guess": "none",
            "occasion_basis": "none",
            "people_count": 1,
            "people_ages": ["adult"],
            "people_bucket": "1",
            "group_type": "solo",
            "clothing": [
                {"colour": "grey", "item": "hoodie"}
            ],
            "objects": ["tennis ball", "dog leash"],
            "time_of_day": "morning",
            "weather_or_season": "sunny",
            "mood": "cheerful",
            "text_in_image": "none"
        }
    }

    with open(TAGS_SAMPLE_JSON, "w", encoding="utf-8") as f:
        json.dump(sample_tags, f, indent=2)
    print(f"[OK] Sample tags (10 items) written to: {TAGS_SAMPLE_JSON}")

    # Also initialize data/tags.json with these 10 so search/tag lookups work immediately
    tags_all = DATA_DIR / "tags.json"
    with open(tags_all, "w", encoding="utf-8") as f:
        json.dump(sample_tags, f, indent=2)
    print(f"[OK] Initial tags copied to: {tags_all}")

if __name__ == "__main__":
    download_library()
    create_sample_tags()
