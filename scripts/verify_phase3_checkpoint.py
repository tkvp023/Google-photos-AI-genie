import urllib.request
import json

def post(url, data):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

print("=== Phase 3 Checkpoint Verification ===\n")

# Check 1: Type 'pool' in Mode B -> Coach triggered with <= 3 questions
r1 = post("http://localhost:3000/api/coach/analyze", {"query": "pool", "mode": "B"})
q_count = len(r1.get("questions", []))
p1 = r1.get("triggered") is True and q_count > 0 and q_count <= 3
print(f"[{'PASS' if p1 else 'FAIL'}] 1. Type 'pool' in Mode B -> triggered={r1.get('triggered')}, questions={q_count}")

# Check 2: Chip tap -> Candidates reduce, questions re-rank
r2 = post("http://localhost:3000/api/coach/answer", {
    "query": "pool",
    "answers": [{"questionId": "q_group_type", "cueType": "who", "value": "friends", "source": "chip"}]
})
p2 = r2.get("candidateCount") < r1.get("count")
print(f"[{'PASS' if p2 else 'FAIL'}] 2. Chip tap 'friends' -> candidates reduced from {r1.get('count')} to {r2.get('candidateCount')}")

# Check 3: 'silver racket' in Mode B -> Coach does NOT appear
r3 = post("http://localhost:3000/api/coach/analyze", {"query": "silver racket", "mode": "B"})
p3 = r3.get("triggered") is False
print(f"[{'PASS' if p3 else 'FAIL'}] 3. 'silver racket' Mode B -> triggered={r3.get('triggered')}")

# Check 4: Any query in Mode A -> Coach NEVER appears
r4 = post("http://localhost:3000/api/coach/analyze", {"query": "pool", "mode": "A"})
p4 = r4.get("triggered") is False
print(f"[{'PASS' if p4 else 'FAIL'}] 4. Query in Mode A -> triggered={r4.get('triggered')}")

# Check 5: Question already answered in query ('pool friends') -> 'who' question NOT shown
r5 = post("http://localhost:3000/api/coach/analyze", {"query": "pool friends", "mode": "B"})
has_who = any(q.get("cueType") == "who" for q in r5.get("questions", []))
p5 = not has_who
print(f"[{'PASS' if p5 else 'FAIL'}] 5. Query contains 'friends' -> who question excluded={'who' not in [q.get('cueType') for q in r5.get('questions', [])]}")

# Check 6: Prompt composer Groq integration
r6 = post("http://localhost:3000/api/coach/compose", {
    "query": "pool",
    "answers": [
        {"questionId": "q1", "cueType": "who", "value": "friends", "source": "chip"},
        {"questionId": "q2", "cueType": "look", "value": "red swimsuit", "source": "chip"}
    ]
})
p6 = len(r6.get("prompt", "")) > 0 and r6.get("composer") in ["groq", "fallback"]
print(f"[{'PASS' if p6 else 'FAIL'}] 6. Prompt composer -> prompt='{r6.get('prompt')}', composer={r6.get('composer')}")

all_passed = p1 and p2 and p3 and p4 and p5 and p6
print("\n=============================================")
print(f"Phase 3 Checkpoint: {'ALL PASS [READY]' if all_passed else 'SOME FAILED'}")
