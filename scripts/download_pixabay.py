#!/usr/bin/env python3
"""
scripts/download_pixabay.py
Downloads 10 photos per theme across 10 diverse themes focused on PEOPLE from Pixabay into /public/library/
Generates data/credits.csv with photographer attribution.
"""

import csv
import os
import sys
import time
from pathlib import Path
import requests

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
LIBRARY_DIR = PROJECT_ROOT / "public" / "library"
CREDITS_CSV = PROJECT_ROOT / "data" / "credits.csv"

# Diverse queries emphasizing people, activities, and settings
THEMES = {
    "pool": ["friends swimming pool party", "people swimming pool sunny"],
    "beach": ["family beach vacation playing", "people walking beach ocean"],
    "birthday": ["birthday party friends celebrating", "people birthday cake candles"],
    "restaurant": ["friends dinner restaurant eating", "people dining table food"],
    "festival": ["festival celebration dancing crowd", "people festival colorful celebration"],
    "hiking": ["friends hiking mountain outdoor", "hikers trekking trail peak"],
    "kids": ["children playing park happy", "kids running playground"],
    "graduation": ["students graduation campus celebration", "graduates cap toss ceremony"],
    "pets": ["person with dog playing park", "woman dog pet owner smile"],
    "roadtrip": ["friends road trip car travel", "people road trip scenic car"],
}

PER_THEME = 10

def main():
    api_key = os.environ.get("PIXABAY_API_KEY", "")
    if not api_key:
        print("Error: PIXABAY_API_KEY environment variable is required.")
        return
    LIBRARY_DIR.mkdir(parents=True, exist_ok=True)
    CREDITS_CSV.parent.mkdir(parents=True, exist_ok=True)

    rows = []
    seen = set()
    total_downloaded = 0

    print(f"Starting Pixabay download (people-focused diversity) into {LIBRARY_DIR} ...")

    for theme, query_list in THEMES.items():
        theme_count = 0
        print(f"\n[Theme: {theme}] Downloading {PER_THEME} photos...")

        for query in query_list:
            if theme_count >= PER_THEME:
                break
            try:
                res = requests.get(
                    "https://pixabay.com/api/",
                    params={
                        "key": api_key,
                        "q": query,
                        "image_type": "photo",
                        "orientation": "horizontal",
                        "per_page": 20,
                        "safesearch": "true",
                    },
                    timeout=15,
                )
                res.raise_for_status()
                hits = res.json().get("hits", [])
            except Exception as e:
                print(f"  [ERROR] Query '{query}' failed: {e}", file=sys.stderr)
                continue

            for photo in hits:
                if theme_count >= PER_THEME:
                    break
                photo_id = photo["id"]
                if photo_id in seen:
                    continue
                seen.add(photo_id)

                fn = f"{theme}_{theme_count + 1:02d}.jpg"
                img_path = LIBRARY_DIR / fn
                img_url = photo.get("webformatURL") or photo.get("largeImageURL")
                photographer = photo.get("user", "Unknown")
                page_url = photo.get("pageURL", f"https://pixabay.com/photos/{photo_id}/")

                img_headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
                saved = False
                for attempt in range(1, 4):
                    try:
                        img_res = requests.get(img_url, headers=img_headers, timeout=20)
                        if img_res.status_code == 200 and len(img_res.content) > 1000:
                            with open(img_path, "wb") as f:
                                f.write(img_res.content)
                            rows.append([fn, theme, photo_id, photographer, page_url])
                            theme_count += 1
                            total_downloaded += 1
                            print(f"  [OK] Saved {fn} ({photographer}) — Query: '{query}'")
                            saved = True
                            break
                        elif img_res.status_code == 429:
                            time.sleep(1.5 * attempt)
                    except Exception as e:
                        time.sleep(1.0)

                if not saved:
                    print(f"  [SKIP] Could not download photo {photo_id} after retries")

                time.sleep(0.3)

    # Save credits.csv
    with open(CREDITS_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["file", "theme", "pexels_id", "photographer", "url"])
        writer.writerows(rows)

    print(f"\n[DONE] Successfully downloaded {total_downloaded} diverse photos from Pixabay.")
    print(f"Credits saved to: {CREDITS_CSV}")

if __name__ == "__main__":
    main()
