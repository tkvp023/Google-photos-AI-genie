#!/usr/bin/env python3
"""
scripts/smoke_test_deployed.py — Automated Smoke Test for Deployed Gp2-solution

Usage:
    python scripts/smoke_test_deployed.py [--url <BASE_URL>] [--pin <MODERATOR_PIN>]

Checks:
    1. /api/health -> returns 200, ok == True, tagCoverage, composerAvailable
    2. /api/search?q=pool -> returns > 12 results
    3. /api/coach/analyze (Mode B, query="pool") -> returns up to 3 questions with distinct cue types
    4. /api/coach/compose -> returns composed prompt (groq or fallback)
    5. /api/log -> persists an event and retrieves it
    6. /api/admin/export.csv -> returns 401 without PIN, and returns CSV (200) with Bearer PIN
"""

import sys
import os
import argparse
import json
import urllib.request
import urllib.error
import uuid

def http_get(url: str, headers: dict = None):
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return res.getcode(), res.read().decode("utf-8"), res.headers
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8"), e.headers
    except Exception as e:
        return 0, str(e), {}

def http_post(url: str, json_data: dict, headers: dict = None):
    data_bytes = json.dumps(json_data).encode("utf-8")
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, data=data_bytes, headers=req_headers)
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return res.getcode(), res.read().decode("utf-8"), res.headers
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8"), e.headers
    except Exception as e:
        return 0, str(e), {}

def run_smoke_tests(base_url: str, pin: str):
    print(f"=== Smoke Testing Deployed Application ===")
    print(f"Target Base URL: {base_url}\n")
    
    passed = 0
    total = 6
    
    # 1. /api/health (with retry for cold-start compilation)
    c1 = False
    details = ""
    for attempt in range(3):
        code, body, _ = http_get(f"{base_url}/api/health")
        try:
            data = json.loads(body)
            if code == 200 and data.get("ok") is True:
                c1 = True
                details = f"ok={data.get('ok')}, version={data.get('version')}, tagCoverage={data.get('tagCoverage')}, composerAvailable={data.get('composerAvailable')}"
                break
            else:
                details = f"code={code}, body={body[:100]}"
        except Exception as e:
            details = f"HTTP {code}, error: {e}"
        import time
        time.sleep(2)

    
    print(f"[{'PASS' if c1 else 'FAIL'}] Test 1: /api/health returns ok -> {details}")
    if c1: passed += 1
    
    # 2. search 'pool' returns > 12 results
    code, body, _ = http_get(f"{base_url}/api/search?q=pool&mode=A")
    try:
        data = json.loads(body)
        count = data.get("count", 0)
        c2 = code == 200 and count > 12
        details = f"count={count} (> 12 expected)"
    except Exception as e:
        c2 = False
        details = f"HTTP {code}, error: {e}"
        
    print(f"[{'PASS' if c2 else 'FAIL'}] Test 2: /api/search?q=pool returns > 12 results -> {details}")
    if c2: passed += 1
    
    # 3. Mode B coach/analyze for 'pool' returns up to 3 questions with distinct cue types
    code, body, _ = http_post(f"{base_url}/api/coach/analyze", {"query": "pool", "mode": "B"})
    try:
        data = json.loads(body)
        questions = data.get("questions", [])
        cues = [q.get("cueType") for q in questions]
        distinct_cues = len(set(cues)) == len(cues)
        c3 = code == 200 and data.get("triggered") is True and 0 < len(questions) <= 3 and distinct_cues
        details = f"triggered={data.get('triggered')}, questionCount={len(questions)}, distinctCues={cues}"
    except Exception as e:
        c3 = False
        details = f"HTTP {code}, error: {e}"
        
    print(f"[{'PASS' if c3 else 'FAIL'}] Test 3: Mode B /api/coach/analyze for 'pool' returns <= 3 distinct questions -> {details}")
    if c3: passed += 1
    
    composer_mode = os.environ.get("COMPOSER_MODE", "template").lower()
    total = 5 if composer_mode == "template" else 6

    # 4. coach/compose check (only when COMPOSER_MODE=groq)
    if composer_mode != "template":
        compose_payload = {
            "query": "pool",
            "answers": [
                {"cueType": "who", "label": "Friends", "value": "friends"},
                {"cueType": "where", "label": "Outdoors", "value": "outdoors"}
            ]
        }
        code, body, _ = http_post(f"{base_url}/api/coach/compose", compose_payload)
        try:
            data = json.loads(body)
            prompt = data.get("prompt", "")
            composer = data.get("composer", "")
            c4 = code == 200 and len(prompt) > 0 and composer in ["groq", "fallback"]
            details = f"prompt='{prompt}', composer={composer}, latency={data.get('latencyMs')}ms"
        except Exception as e:
            c4 = False
            details = f"HTTP {code}, error: {e}"
            
        print(f"[{'PASS' if c4 else 'FAIL'}] Test 4: /api/coach/compose returns prompt (groq or fallback) -> {details}")
        if c4: passed += 1
    else:
        print("[INFO] Test 4: /api/coach/compose check skipped (COMPOSER_MODE=template; zero-friction interaction active)")
    
    # 5. /api/log persists an event
    test_session_id = f"smoke_test_{uuid.uuid4().hex[:8]}"
    test_event = {
        "sessionId": test_session_id,
        "participantId": "smoke_tester",
        "mode": "B",
        "targetId": "T01",
        "type": "smoke_test_ping",
        "isPractice": True,
        "payload": {"status": "testing_persisted_events"}
    }
    code, body, _ = http_post(f"{base_url}/api/log", test_event)
    c5_post = code == 200
    
    # verify persistence
    code_get, body_get, _ = http_get(f"{base_url}/api/log?sessionId={test_session_id}")
    try:
        events_data = json.loads(body_get)
        events = events_data.get("events", [])
        c5 = c5_post and len(events) >= 1 and events[-1].get("sessionId") == test_session_id
        details = f"posted={c5_post}, readCount={len(events)}"
    except Exception as e:
        c5 = False
        details = f"verify failed: {e}"
        
    print(f"[{'PASS' if c5 else 'FAIL'}] Test 5: /api/log persists and retrieves an event -> {details}")
    if c5: passed += 1
    
    # 6. /api/admin/export.csv returns 401 without PIN and CSV with PIN
    # 6a. Without PIN
    code_no_pin, _, _ = http_get(f"{base_url}/api/admin/export.csv")
    # 6b. With Bearer PIN
    code_with_pin, body_csv, headers_csv = http_get(
        f"{base_url}/api/admin/export.csv",
        headers={"Authorization": f"Bearer {pin}"}
    )
    
    c6_401 = code_no_pin == 401
    c6_csv = code_with_pin == 200 and ("text/csv" in headers_csv.get("content-type", "") or "session_id" in body_csv)
    c6 = c6_401 and c6_csv
    details = f"unauthCode={code_no_pin} (expected 401), authCode={code_with_pin} (expected 200), hasCsvHeader={'session_id' in body_csv}"
    
    print(f"[{'PASS' if c6 else 'FAIL'}] Test 6: /api/admin/export.csv returns 401 without PIN and CSV with PIN -> {details}")
    if c6: passed += 1
    
    print("\n" + "=" * 45)
    print(f"Smoke Test Summary: {passed}/{total} Passed")
    if passed == total:
        print("ALL SMOKE TESTS PASSED [OK]")
        return 0
    else:
        print(f"SOME SMOKE TESTS FAILED ({total - passed} failed)")
        return 1

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Smoke test deployed Gp2-solution")
    parser.add_argument("--url", default=os.environ.get("DEPLOYED_URL", "http://localhost:3000"), help="Base URL to test")
    parser.add_argument("--pin", default=os.environ.get("MODERATOR_PIN", "1234"), help="Moderator PIN")
    args = parser.parse_args()
    
    target_url = args.url.rstrip("/")
    sys.exit(run_smoke_tests(target_url, args.pin))
