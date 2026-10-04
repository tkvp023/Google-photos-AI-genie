import base64, json, os, requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv('.env.local')
key = os.getenv('GEMINI_API_KEY')
model = 'gemini-3.5-flash-lite'

p1 = Path('public/library/beach_12.jpg')
p2 = Path('public/library/beach_13.jpg')

prompt = '''You are tagging photos for a search engine. For each image provided, output a JSON object where the keys are the image filenames 'beach_12.jpg' and 'beach_13.jpg'.
Each value must follow this schema:
{
  "one_line": "single-sentence factual description",
  "setting": "setting (beach, pool, etc)",
  "indoor_outdoor": "indoor|outdoor|unknown",
  "activity": "action verb phrase or none",
  "occasion_guess": "occasion or none",
  "occasion_basis": "visual reason or none",
  "people_count": 0,
  "people_ages": ["adult"],
  "group_type": "solo|couple|family|friends|crowd|unknown",
  "clothing": [{"colour": "red", "item": "shirt"}],
  "objects": ["object1"],
  "time_of_day": "morning|afternoon|sunset|night|unknown",
  "weather_or_season": "sunny|overcast|rainy|snow|unknown",
  "mood": "cheerful|calm|energetic|formal|none",
  "text_in_image": "none"
}
'''

payload = {
    'contents': [{
        'parts': [
            {'text': prompt},
            {'text': 'Image 1: beach_12.jpg'},
            {'inline_data': {'mime_type': 'image/jpeg', 'data': base64.b64encode(p1.read_bytes()).decode('utf-8')}},
            {'text': 'Image 2: beach_13.jpg'},
            {'inline_data': {'mime_type': 'image/jpeg', 'data': base64.b64encode(p2.read_bytes()).decode('utf-8')}},
        ]
    }],
    'generationConfig': {
        'responseMimeType': 'application/json',
        'temperature': 0.1
    }
}

url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}'
r = requests.post(url, json=payload, headers={'Content-Type': 'application/json'}, timeout=40)
print('STATUS:', r.status_code)
if r.status_code == 200:
    data = r.json()
    print(data['candidates'][0]['content']['parts'][0]['text'])
else:
    print(r.text)
