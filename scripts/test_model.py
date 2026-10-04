import os, requests
api_key = ''
for line in open('.env.local'):
    if line.startswith('GEMINI_API_KEY='): api_key = line.strip().split('=', 1)[1]
for m in ['gemini-3.5-flash', 'gemini-3.1-pro-preview', 'gemini-3-flash-preview']:
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={api_key}'
    try:
        r = requests.post(url, json={'contents': [{'parts': [{'text': 'hello'}]}]}, timeout=10)
        print(m, r.status_code)
    except Exception as e:
        print(m, e)
