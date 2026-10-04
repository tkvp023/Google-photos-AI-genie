import os, sys, base64, requests, json
from pathlib import Path

api_key = ''
for line in open('.env.local'):
    if line.startswith('GEMINI_API_KEY='): api_key = line.strip().split('=', 1)[1]

img_path = Path('public/library/kids_11.jpg')
b64 = base64.b64encode(img_path.read_bytes()).decode('utf-8')
prompt = Path('scripts/tag_prompt.txt').read_text()
payload = {
    'contents': [{'parts': [{'text': prompt}, {'inline_data': {'mime_type': 'image/jpeg', 'data': b64}}]}],
    'generationConfig': {'responseMimeType': 'application/json', 'temperature': 0.1, 'maxOutputTokens': 2048}
}

for m in ['gemini-3-flash-preview', 'gemini-3.7-flash', 'gemini-3.8-flash', 'gemini-3.5-flash']:
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={api_key}'
    try:
        r = requests.post(url, json=payload, timeout=20)
        print(m, r.status_code)
        if r.status_code == 200:
            print('SUCCESS:', m)
            print(r.json()['candidates'][0]['content']['parts'][0]['text'][:200])
            break
        else:
            print(r.text[:120])
    except Exception as e:
        print(m, e)
