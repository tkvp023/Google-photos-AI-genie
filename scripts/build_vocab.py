import json
import re
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TAGS_PATH = PROJECT_ROOT / "data" / "tags.json"
META_PATH = PROJECT_ROOT / "data" / "photo_meta.json"
OUTPUT_VOCAB = PROJECT_ROOT / "data" / "vocab.json"

STOPWORDS = {
    "a", "an", "the", "and", "or", "in", "on", "at", "to", "for", "of", "with",
    "by", "from", "up", "about", "into", "over", "after", "is", "are", "was",
    "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "this", "that", "these", "those", "my", "your", "his", "her", "its", "our",
    "their", "me", "him", "them", "us", "i", "you", "he", "she", "it", "we", "they"
}

def clean_token(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    return s.strip()

def main():
    tags = json.loads(TAGS_PATH.read_text(encoding="utf-8"))
    meta = json.loads(META_PATH.read_text(encoding="utf-8")) if META_PATH.exists() else {}

    vocab_terms = set()

    for fn, t in tags.items():
        # setting
        if t.get("setting"):
            vocab_terms.add(clean_token(t["setting"]))
        # indoor_outdoor
        if t.get("indoor_outdoor"):
            vocab_terms.add(clean_token(t["indoor_outdoor"]))
        # activity
        if t.get("activity"):
            for act in t["activity"].split(","):
                w = clean_token(act)
                if w and w not in STOPWORDS:
                    vocab_terms.add(w)
        # group_type
        if t.get("group_type"):
            vocab_terms.add(clean_token(t["group_type"]))
        # occasion
        if t.get("occasion"):
            vocab_terms.add(clean_token(t["occasion"]))
        # clothing_colours
        if t.get("clothing_colours"):
            for col in t["clothing_colours"]:
                w = clean_token(col)
                if w: vocab_terms.add(w)
        # objects
        if t.get("objects"):
            for obj in t["objects"]:
                w = clean_token(obj)
                if w and len(w) > 2:
                    vocab_terms.add(w)
                    for part in w.split():
                        part_clean = clean_token(part)
                        if part_clean and len(part_clean) > 2 and part_clean not in STOPWORDS:
                            vocab_terms.add(part_clean)
        # time_of_day
        if t.get("time_of_day"):
            vocab_terms.add(clean_token(t["time_of_day"]))
        # mood
        if t.get("mood"):
            vocab_terms.add(clean_token(t["mood"]))
        # content words from one_line
        if t.get("one_line"):
            for word in re.findall(r"[a-z0-9]+", t["one_line"].lower()):
                if len(word) > 2 and word not in STOPWORDS:
                    vocab_terms.add(word)

    # Synthetic places, people, seasons
    places_set = set()
    people_set = set()
    for fn, m in meta.items():
        if m.get("place", {}).get("city"):
            places_set.add(clean_token(m["place"]["city"]))
        if m.get("place", {}).get("venue"):
            places_set.add(clean_token(m["place"]["venue"]))
        if m.get("people"):
            for p in m["people"]:
                people_set.add(clean_token(p))
        if m.get("season"):
            vocab_terms.add(clean_token(m["season"]))

    vocab_list = sorted(list(vocab_terms.union(places_set).union(people_set)))
    # filter out empty or single char
    vocab_list = [v for v in vocab_list if len(v) > 1 and v not in STOPWORDS and v not in ("none", "unknown", "null")]

    payload = {
        "total_terms": len(vocab_list),
        "terms": vocab_list,
        "places": sorted(list(places_set)),
        "people": sorted(list(people_set))
    }

    OUTPUT_VOCAB.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Generated {OUTPUT_VOCAB} with {len(vocab_list)} vocabulary terms.")

if __name__ == "__main__":
    main()
