import urllib.request
import json

def test_api(query):
    req = urllib.request.Request(
        "http://localhost:3000/api/search",
        data=json.dumps({"query": query, "mode": "A"}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        top_file = data.get("results", [{}])[0].get("file") if data.get("results") else "None"
        top_score = data.get("results", [{}])[0].get("score") if data.get("results") else "0"
        print(f"Query: '{query}' -> count: {data.get('count')}, bucket: {data.get('bucket')}, top: {top_file} (score: {top_score})")

if __name__ == "__main__":
    print("Testing POST /api/search live on Next.js dev server:")
    test_api("pool")
    test_api("red swimsuit")
    test_api("silver racket")
    test_api("beach family")
    test_api("hiking")
    test_api("")
