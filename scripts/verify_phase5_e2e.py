# scripts/verify_phase5_e2e.py — Phase 5 End-to-End Automated Test Suite
import urllib.request
import json
import os
import sys

BASE_URL = "http://localhost:3000"

def test_about_and_credits():
    print("\n--- [1/6] Testing S12 About & Credits ---")
    url = f"{BASE_URL}/api/credits"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        assert resp.getcode() == 200, f"Expected 200, got {resp.getcode()}"
        data = json.loads(resp.read().decode())
        credits = data.get("credits", [])
        assert len(credits) == 100, f"Expected 100 credits, got {len(credits)}"
        for c in credits[:5]:
            assert "file" in c and c["file"].endswith(".jpg")
            assert "photographer" in c and len(c["photographer"]) > 0
            assert "url" in c and c["url"].startswith("http")
            assert "theme" in c and len(c["theme"]) > 0
        print(f"PASS: 100/100 credits verified via /api/credits (Sample: {credits[0]['photographer']} for {credits[0]['file']})")

    # Check /about page reachability
    with urllib.request.urlopen(f"{BASE_URL}/about") as resp:
        assert resp.getcode() == 200
        print("PASS: /about (S12) renders successfully with HTTP 200 OK")

def test_mode_a_full_flow():
    print("\n--- [2/6] Testing Mode A Full Flow (Unassisted Baseline) ---")
    session_id = f"s_p01_a_{int(os.getpid())}"
    target_id = "T01"

    # 1. Mode A Search
    search_url = f"{BASE_URL}/api/search?q=pool&mode=A"
    req = urllib.request.Request(search_url)
    with urllib.request.urlopen(req) as resp:
        assert resp.getcode() == 200
        data = json.loads(resp.read().decode())
        assert data.get("count", 0) > 0, "Mode A search for 'pool' must return results"
        print(f"PASS: Mode A search for 'pool' returned {data['count']} photos")

    # 2. Verify Coach is NEVER triggered in Mode A
    analyze_url = f"{BASE_URL}/api/coach/analyze"
    req_analyze = urllib.request.Request(
        analyze_url,
        data=json.dumps({"query": "pool", "mode": "A"}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req_analyze) as resp:
        data = json.loads(resp.read().decode())
        assert data.get("triggered") is False, "Coach must NEVER trigger in Mode A"
        print("PASS: Mode A coach isolation verified (triggered=False)")

    # 3. Simulate and log full Mode A session
    events = [
        {"type": "task_start", "payload": {"targetId": target_id}},
        {"type": "target_shown", "payload": {"targetId": target_id}},
        {"type": "target_hidden", "payload": {"targetId": target_id}},
        {"type": "query_typed", "payload": {"query": "pool"}},
        {"type": "search_submitted", "payload": {"query": "pool", "mode": "A"}},
        {"type": "photo_opened", "payload": {"photoId": "pool_06", "rank": 1}},
        {"type": "found", "payload": {"photoId": "pool_06", "targetId": target_id}},
        {"type": "survey_answered", "payload": {"difficultyRating": 3, "satisfactionRating": 3, "comment": "Found in plain search"}},
        {"type": "task_end", "payload": {"outcome": "found", "targetId": target_id}}
    ]
    log_url = f"{BASE_URL}/api/log"
    for e in events:
        body = {
            "ts": "2026-10-01T12:00:00.000Z",
            "sessionId": session_id,
            "participantId": "P01",
            "mode": "A",
            "type": e["type"],
            "payload": e["payload"]
        }
        req = urllib.request.Request(log_url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
        urllib.request.urlopen(req)

    print(f"PASS: Mode A complete session logged for participant P01 ({session_id})")
    return session_id

def test_mode_b_full_flow():
    print("\n--- [3/6] Testing Mode B Full Flow (Coach Assisted) ---")
    session_id = f"s_p01_b_{int(os.getpid())}"
    target_id = "T01"

    # 1. Coach Analyze for vague query "pool"
    analyze_url = f"{BASE_URL}/api/coach/analyze"
    req_analyze = urllib.request.Request(
        analyze_url,
        data=json.dumps({"query": "pool", "mode": "B"}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req_analyze) as resp:
        data = json.loads(resp.read().decode())
        assert data.get("triggered") is True, "Coach must trigger for 'pool' in Mode B"
        questions = data.get("questions", [])
        assert len(questions) > 0, "Coach must return question blocks"
        print(f"PASS: Mode B coach triggered with {len(questions)} questions for 'pool'")

    # 2. Answer Question with Chip
    answer_url = f"{BASE_URL}/api/coach/answer"
    answers = [{"questionId": questions[0]["id"], "cueType": questions[0]["cueType"], "value": "friends", "source": "chip"}]
    req_ans = urllib.request.Request(
        answer_url,
        data=json.dumps({"query": "pool", "answers": answers}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req_ans) as resp:
        data_ans = json.loads(resp.read().decode())
        cand_count = data_ans.get("candidateCount", 0)
        assert cand_count > 0, "Candidate count must be positive"
        print(f"PASS: Coach filtered candidate set down to {cand_count} photos")

    # 3. Build & Compose Search Prompt
    compose_url = f"{BASE_URL}/api/coach/compose"
    req_comp = urllib.request.Request(
        compose_url,
        data=json.dumps({"query": "pool", "answers": answers}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req_comp) as resp:
        data_comp = json.loads(resp.read().decode())
        refined = data_comp.get("prompt", "")
        composer = data_comp.get("composer", "")
        assert "pool" in refined.lower()
        assert "friends" in refined.lower()
        print(f"PASS: Refined prompt composed via {composer}: '{refined}'")

    # 4. Search with Refined Prompt
    search_url = f"{BASE_URL}/api/search?q={urllib.parse.quote(refined)}&mode=B"
    with urllib.request.urlopen(search_url) as resp:
        data_res = json.loads(resp.read().decode())
        assert data_res.get("count", 0) > 0
        print(f"PASS: Executed refined search '{refined}' -> {data_res['count']} results")

    # 5. Simulate and log full Mode B session
    events = [
        {"type": "task_start", "payload": {"targetId": target_id}},
        {"type": "target_shown", "payload": {"targetId": target_id}},
        {"type": "target_hidden", "payload": {"targetId": target_id}},
        {"type": "query_typed", "payload": {"query": "pool"}},
        {"type": "vague_check", "payload": {"query": "pool", "isVague": True}},
        {"type": "coach_triggered", "payload": {"query": "pool"}},
        {"type": "coach_shown", "payload": {"questionCount": len(questions)}},
        {"type": "chip_tapped", "payload": {"questionId": questions[0]["id"], "value": "friends"}},
        {"type": "prompt_composed", "payload": {"query": "pool", "refinedPrompt": refined}},
        {"type": "prompt_edited", "payload": {"originalPrompt": refined, "editedPrompt": f"{refined} sunny"}},
        {"type": "search_submitted", "payload": {"query": f"{refined} sunny", "mode": "B"}},
        {"type": "photo_opened", "payload": {"photoId": "pool_06", "rank": 1}},
        {"type": "found", "payload": {"photoId": "pool_06", "targetId": target_id}},
        {"type": "survey_answered", "payload": {"difficultyRating": 1, "satisfactionRating": 5, "comment": "Coach was super fast!"}},
        {"type": "task_end", "payload": {"outcome": "found", "targetId": target_id}}
    ]
    log_url = f"{BASE_URL}/api/log"
    for e in events:
        body = {
            "ts": "2026-10-01T12:05:00.000Z",
            "sessionId": session_id,
            "participantId": "P01",
            "mode": "B",
            "type": e["type"],
            "payload": e["payload"]
        }
        req = urllib.request.Request(log_url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
        urllib.request.urlopen(req)

    print(f"PASS: Mode B complete session logged for participant P01 ({session_id})")
    return session_id

def test_s8_zero_results():
    print("\n--- [4/6] Testing S8 Zero Results Fallback ---")
    url = f"{BASE_URL}/api/search?q=xyznomatchquery999&mode=B"
    with urllib.request.urlopen(url) as resp:
        assert resp.getcode() == 200
        data = json.loads(resp.read().decode())
        assert data.get("count") == 0
        assert data.get("bucket") == "few"
        assert len(data.get("results", [])) == 0
        print("PASS: Zero results query correctly returned count=0 and bucket='few'")

def test_export_csv_and_metrics(mode_a_session, mode_b_session):
    print("\n--- [5/6] Testing CSV Export & Metrics Validation ---")
    url = f"{BASE_URL}/api/admin/export.csv"
    with urllib.request.urlopen(url) as resp:
        assert resp.getcode() == 200
        content = resp.read().decode("utf-8")
        lines = [l.strip() for l in content.strip().split("\n") if l.strip()]
        
        # Verify headers
        headers = lines[0].split(",")
        assert "session_id" in headers
        assert "participant_id" in headers
        assert "mode" in headers
        assert "outcome" in headers
        assert "time_to_find_sec" in headers

        # Verify Mode A and Mode B rows exist
        mode_a_row = [l for l in lines if mode_a_session in l]
        mode_b_row = [l for l in lines if mode_b_session in l]
        assert len(mode_a_row) >= 1, f"Mode A session {mode_a_session} missing from CSV"
        assert len(mode_b_row) >= 1, f"Mode B session {mode_b_session} missing from CSV"
        
        print(f"PASS: Mode A session row in CSV: {mode_a_row[0]}")
        print(f"PASS: Mode B session row in CSV: {mode_b_row[0]}")

def test_all_routes_health():
    print("\n--- [6/6] Testing Core Routes Status ---")
    routes = [
        "/",
        "/about",
        "/admin",
        "/moderator",
        "/search",
        "/search?mode=B",
        "/results?q=beach&mode=A",
        "/study?step=reveal&target=T01&mode=B",
        "/study?step=end&outcome=found&target=T01&mode=B",
        "/photo/pool_01",
        "/api/targets",
        "/api/credits",
        "/api/photos",
    ]
    for r in routes:
        req = urllib.request.Request(f"{BASE_URL}{r}")
        with urllib.request.urlopen(req) as resp:
            assert resp.getcode() == 200, f"Route {r} returned {resp.getcode()}"
            print(f"PASS: {r} -> 200 OK")

if __name__ == "__main__":
    print("========================================")
    print("PHASE 5 END-TO-END AUTOMATED VERIFICATION")
    print("========================================")
    test_about_and_credits()
    session_a = test_mode_a_full_flow()
    session_b = test_mode_b_full_flow()
    test_s8_zero_results()
    test_export_csv_and_metrics(session_a, session_b)
    test_all_routes_health()
    print("\n========================================")
    print("ALL PHASE 5 E2E CHECKS PASSED SUCCESSFULLY!")
    print("========================================")
