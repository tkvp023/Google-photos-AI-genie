#!/usr/bin/env python3
"""
scripts/download_pexels.py
Downloads ~14 photos per theme across 10 themes from Pexels into /public/library/
Generates data/credits.csv with attribution.
"""

import csv
import os
import sys
import time
import requests
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Resolve project root from script location
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
LIBRARY_DIR = PROJECT_ROOT / "public" / "library"
CREDITS_CSV = PROJECT_ROOT / "data" / "credits.csv"

THEMES = {
    "pool": "friends swimming pool",
    "beach": "family beach vacation",
    "birthday": "birthday party cake",
    "restaurant": "friends dinner restaurant",
    "festival": "family festival celebration",
    "hiking": "friends hiking mountain trip",
    "kids": "children playing park",
    "graduation": "graduation friends campus",
    "pets": "dog with owner",
    "roadtrip": "road trip friends car",
}

PER_THEME = 14

def main():
    api_key = os.environ.get("PEXELS_API_KEY")
    if not api_key:
        print("[ERROR] PEXELS_API_KEY environment variable is not set.", file=sys.stderr)
        print("Please set PEXELS_API_KEY before running this script:", file=sys.stderr)
        print("  Windows (PowerShell): $env:PEXELS_API_KEY=\"your_key_here\"", file=sys.stderr)
        print("  Linux/macOS: export PEXELS_API_KEY=\"your_key_here\"", file=sys.stderr)
        sys.exit(1)

    LIBRARY_DIR.mkdir(parents=True, exist_ok=True)
    CREDITS_CSV.parent.mkdir(parents=True, exist_ok=True)

    rows = []
    seen = set()

    # Load existing credits if available to prevent duplicates across runs
    if CREDITS_CSV.exists():
        try:
            with open(CREDITS_CSV, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                header = next(reader, None)
                for r in reader:
                    if len(r) >= 3:
                        seen.add(int(r[2]))
                        rows.append(r)
        except Exception as e:
            print(f"[WARN] Could not parse existing credits.csv: {e}")

    print(f"Starting Pexels download into {LIBRARY_DIR} ...")
    total_downloaded = 0

    headers = {"Authorization": api_key}

    for theme, query in THEMES.items():
        print(f"\n[Theme: {theme}] Query: '{query}'")
        try:
            res = requests.get(
                "https://api.pexels.com/v1/search",
                headers=headers,
                params={"query": query, "per_page": PER_THEME, "orientation": "landscape"},
                timeout=30,
            )
            res.raise_for_status()
            data = res.json()
            photos = data.get("photos", [])
        except Exception as e:
            print(f"[ERROR] Failed fetching photos for theme '{theme}': {e}", file=sys.stderr)
            continue

        theme_count = 0
        for i, photo in enumerate(photos):
            photo_id = photo["id"]
            if photo_id in seen:
                continue

            seen.add(photo_id)
            fn = f"{theme}_{theme_count + 1:02d}.jpg"
            img_path = LIBRARY_DIR / fn

            try:
                img_url = photo["src"]["large"]
                img_res = requests.get(img_url, timeout=60)
                img_res.raise_for_status()
                with open(img_path, "wb") as f:
                    f.write(img_res.content)

                photographer = photo.get("photographer", "Unknown")
                p_url = photo.get("url", f"https://www.pexels.com/photo/{photo_id}/")
                rows.append([fn, theme, photo_id, photographer, p_url])
                theme_count += 1
                total_downloaded += 1
                print(f"  [OK] Saved {fn} ({photographer})")
            except Exception as e:
                print(f"  [ERROR] Failed downloading {fn}: {e}", file=sys.stderr)

        time.sleep(1)

    with open(CREDITS_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["file", "theme", "pexels_id", "photographer", "url"])
        writer.writerows(rows)

    print(f"\n[DONE] Successfully downloaded {total_downloaded} photos.")
    print(f"Credits saved to: {CREDITS_CSV}")

if __name__ == "__main__":
    main()
