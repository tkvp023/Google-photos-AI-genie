import urllib.request
import json

def test_analyze(query, mode="B"):
    req = urllib.request.Request(
        "http://localhost:3000/api/coach/analyze",
        data=json.dumps({"query": query, "mode": mode}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        print(f"[Analyze] query='{query}' mode='{mode}' -> isVague={data.get('isVague')}, triggered={data.get('triggered')}, count={data.get('count')}, questions={len(data.get('questions', []))}")
        return data

def test_answer(query, answers):
    req = urllib.request.Request(
        "http://localhost:3000/api/coach/answer",
        data=json.dumps({"query": query, "answers": answers}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        print(f"[Answer] query='{query}' -> remaining candidates={data.get('candidateCount')}, remaining questions={len(data.get('questions', []))}")
        return data

def test_compose(query, answers):
    req = urllib.request.Request(
        "http://localhost:3000/api/coach/compose",
        data=json.dumps({"query": query, "answers": answers}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        print(f"[Compose] query='{query}' -> prompt='{data.get('prompt')}', composer={data.get('composer')}")
        return data

if __name__ == "__main__":
    print("Testing Coach API endpoints live on Next.js dev server:\n")
    # 1. Mode A: coach should NOT trigger
    test_analyze("pool", mode="A")

    # 2. Mode B: coach SHOULD trigger for pool
    d1 = test_analyze("pool", mode="B")

    # 3. Mode B: answer who = friends
    d2 = test_answer("pool", [{"questionId": "q_group_type", "cueType": "who", "value": "friends", "source": "chip"}])

    # 4. Mode B: compose prompt
    test_compose("pool", [
        {"questionId": "q1", "cueType": "who", "value": "friends", "source": "chip"},
        {"questionId": "q2", "cueType": "look", "value": "red swimsuit", "source": "chip"},
    ])
