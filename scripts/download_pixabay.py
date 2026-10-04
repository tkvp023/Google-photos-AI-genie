#!/usr/bin/env python3
"""
scripts/download_pixabay.py
Downloads photos per theme across 10 diverse themes focused on PEOPLE from Pixabay into /public/library/
Extends library to 20 photos per theme (200 total).
Appends to data/credits.csv with photographer attribution without overwriting existing files.
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
    "pool": ["friends swimming pool party", "people swimming pool sunny", "family pool summer swimming", "kids pool water inflatable"],
    "beach": ["family beach vacation playing", "people walking beach ocean", "friends beach sunset laughing", "couple beach stroll waves"],
    "birthday": ["birthday party friends celebrating", "people birthday cake candles", "kids birthday party balloons", "family birthday celebration toast"],
    "restaurant": ["friends dinner restaurant eating", "people dining table food", "family dinner restaurant drinks", "couple dining restaurant romantic"],
    "festival": ["festival celebration dancing crowd", "people festival colorful celebration", "music festival concert cheering", "cultural festival street dancing"],
    "hiking": ["friends hiking mountain outdoor", "hikers trekking trail peak", "backpacking mountain trail hikers", "group hiking forest scenic"],
    "kids": ["children playing park happy", "kids running playground", "children drawing art classroom", "kids playing soccer lawn"],
    "graduation": ["students graduation campus celebration", "graduates cap toss ceremony", "university graduation diploma student", "graduate family portrait campus"],
    "pets": ["person with dog playing park", "woman dog pet owner smile", "man playing fetch dog park", "family puppy dog living room"],
    "roadtrip": ["friends road trip car travel", "people road trip scenic car", "family road trip camper highway", "couple road trip convertible adventure"],
}

PER_THEME = 20

def main():
    # Load .env.local
    env_local = PROJECT_ROOT / ".env.local"
    if env_local.exists():
        for line in env_local.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                if k not in os.environ:
                    os.environ[k] = v

    api_key = os.environ.get("PIXABAY_API_KEY", "")
    if not api_key:
        print("Error: PIXABAY_API_KEY environment variable is required.")
        return

    LIBRARY_DIR.mkdir(parents=True, exist_ok=True)
    CREDITS_CSV.parent.mkdir(parents=True, exist_ok=True)

    rows = []
    seen = set()
    if CREDITS_CSV.exists():
        try:
            with open(CREDITS_CSV, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                header = next(reader, None)
                for r in reader:
                    if r and len(r) >= 3:
                        rows.append(r)
                        seen.add(r[2])  # pexels_id / photo_id
            print(f"Loaded {len(rows)} existing credit rows from {CREDITS_CSV}")
        except Exception as e:
            print(f"Warning reading {CREDITS_CSV}: {e}")

    total_downloaded = 0
    print(f"Targeting {PER_THEME} photos per theme (200 total) into {LIBRARY_DIR} ...")

    for theme, query_list in THEMES.items():
        existing_files = sorted([f.name for f in LIBRARY_DIR.glob(f"{theme}_*.jpg")])
        theme_count = len(existing_files)
        print(f"\n[Theme: {theme}] Currently has {theme_count} photos. Target: {PER_THEME}...")

        if theme_count >= PER_THEME:
            print(f"  Already at {theme_count} >= {PER_THEME}, skipping.")
            continue

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
                        "per_page": 40,
                        "safesearch": "true",
                    },
                    timeout=15,
                )
                res.raise_for_status()
                hits = res.json().get("hits", [])
            except Exception as e:
                print(f"  [ERROR] Query '{query}' failed: {e}", file=sys.stderr)
                time.sleep(1.0)
                continue

            for photo in hits:
                if theme_count >= PER_THEME:
                    break
                photo_id = str(photo["id"])
                if photo_id in seen:
                    continue

                fn = f"{theme}_{theme_count + 1:02d}.jpg"
                img_path = LIBRARY_DIR / fn
                if img_path.exists():
                    theme_count += 1
                    continue

                seen.add(photo_id)
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
                            time.sleep(2.0 * attempt)
                    except Exception as e:
                        time.sleep(1.0)

                if not saved:
                    print(f"  [SKIP] Could not download photo {photo_id} after retries")

                time.sleep(0.4)  # Respect Pixabay rate limits

            time.sleep(0.5)

    # Save credits.csv
    with open(CREDITS_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["file", "theme", "pexels_id", "photographer", "url"])
        writer.writerows(rows)

    total_library_photos = len(list(LIBRARY_DIR.glob("*.jpg")))
    print(f"\n[DONE] Successfully downloaded {total_downloaded} new photos from Pixabay.")
    print(f"Total photos in library: {total_library_photos}")
    print(f"Credits saved to: {CREDITS_CSV}")

if __name__ == "__main__":
    main()
