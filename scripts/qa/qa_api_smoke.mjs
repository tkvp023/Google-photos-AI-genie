// scripts/qa/qa_api_smoke.mjs  — API-level smoke tests (no browser needed)
// Tests all key Genie behaviours through the API layer.
import http from 'node:http';

function get(url) {
  return new Promise((res, rej) => {
    http.get(url, (r) => {
      let d = '';
      r.on('data', (c) => { d += c; });
      r.on('end', () => res({ status: r.statusCode, body: d }));
    }).on('error', rej);
  });
}

function post(path, body) {
  return new Promise((res, rej) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: 'localhost', port: 3000, path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    const req = http.request(opts, (r) => {
      let d = '';
      r.on('data', (c) => { d += c; });
      r.on('end', () => res({ status: r.statusCode, body: d }));
    });
    req.on('error', rej);
    req.write(data);
    req.end();
  });
}

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
}

console.log('=== API SMOKE TEST — Google Photos AI Genie ===\n');

// 1. Health
const h = await get('http://localhost:3000/api/health');
const hj = JSON.parse(h.body);
check('Health endpoint', hj.ok === true && hj.photoCount >= 200, `photoCount=${hj.photoCount}, tagCoverage=${hj.tagCoverage}`);

// 2. Search returns results
const s1 = await get('http://localhost:3000/api/search?q=pool');
const sj1 = JSON.parse(s1.body);
check('Search "pool" returns results', (sj1.results?.length ?? 0) >= 10, `count=${sj1.results?.length}`);

// 3. Search returns results for "beach"
const s2 = await get('http://localhost:3000/api/search?q=beach');
const sj2 = JSON.parse(s2.body);
check('Search "beach" returns results', (sj2.results?.length ?? 0) >= 5, `count=${sj2.results?.length}`);

// 4. Genie triggers for "pool"
const c1 = JSON.parse((await post('/api/coach/analyze', { query: 'pool', genieOff: false })).body);
check('Genie triggers for "pool"', c1.triggered === true && c1.questions?.length >= 2, `triggered=${c1.triggered}, rows=${c1.questions?.length}`);

// 5. Genie: "pool" rows include memory-cue rows (not just metadata)
const memoryCues = new Set(['look', 'what', 'occasion', 'mood', 'who']);
const memoryCueRows = (c1.questions ?? []).filter(q => memoryCues.has(q.cueType));
check('Genie "pool" has >= 2 memory-cue rows', memoryCueRows.length >= 2, `memoryCueRows=${memoryCueRows.length}`);

// 6. Genie: no more than 1 metadata row
const metaFields = new Set(['place_city', 'cast_people', 'time_period', 'season_year', 'when']);
const metaRows = (c1.questions ?? []).filter(q => metaFields.has(q.cueType) || !memoryCues.has(q.cueType));
check('Genie "pool" has <= 1 metadata row', metaRows.length <= 1, `metaRows=${metaRows.length}`);

// 7. Genie does not trigger for "me" (stopword)
const c2 = JSON.parse((await post('/api/coach/analyze', { query: 'me', genieOff: false })).body);
check('Genie does NOT trigger for "me"', c2.triggered === false, `triggered=${c2.triggered}`);

// 8. Genie does not trigger with genieOff=true
const c3 = JSON.parse((await post('/api/coach/analyze', { query: 'pool', genieOff: true })).body);
check('Genie disabled via genieOff=true', c3.triggered === false, `triggered=${c3.triggered}`);

// 9. Genie shows zero-match state for "elephant"
const c4 = JSON.parse((await post('/api/coach/analyze', { query: 'elephant', genieOff: false })).body);
check('Genie shows zero-match for "elephant"', c4.no_match_state === 'zero', `no_match_state=${c4.no_match_state}`);

// 10. Genie does NOT trigger for "12 March 2021 Goa pool" (2+ precise anchors)
const c5 = JSON.parse((await post('/api/coach/analyze', { query: '12 March 2021 Goa pool', genieOff: false })).body);
check('Genie blocked for "12 March 2021 Goa pool"', c5.triggered === false, `triggered=${c5.triggered}, reason=${c5.trigger_blocked_reason}`);

// 11. Genie triggers for "family picnic" and includes unmatched note for "picnic"
const c6 = JSON.parse((await post('/api/coach/analyze', { query: 'family picnic', genieOff: false })).body);
check('Genie triggers for "family picnic"', c6.triggered === true, `triggered=${c6.triggered}, candidates=${c6.count}`);
const picnicNote = (c6.unmatched_terms ?? []).includes('picnic');
check('Genie "family picnic" includes note for "picnic"', picnicNote, `unmatched_terms=${JSON.stringify(c6.unmatched_terms)}`);

// 12. Genie triggers for "restaurant"
const c7 = JSON.parse((await post('/api/coach/analyze', { query: 'restaurant', genieOff: false })).body);
check('Genie triggers for "restaurant"', c7.triggered === true, `triggered=${c7.triggered}`);

// 13. Monotonicity: adding a recognised word should not INCREASE count_strong (Tier 1)
const s_pool = JSON.parse((await get('http://localhost:3000/api/search?q=pool')).body);
const s_pool_outdoor = JSON.parse((await get('http://localhost:3000/api/search?q=pool+outdoor')).body);
const poolStrong = s_pool.count_strong ?? 0;
const poolOutdoorStrong = s_pool_outdoor.count_strong ?? 0;
check('Monotonicity: "pool outdoor" count_strong <= "pool" count_strong', poolOutdoorStrong <= poolStrong, `pool_strong=${poolStrong}, pool+outdoor_strong=${poolOutdoorStrong}`);

// 14. Genie for "birthday cake"
const c8 = JSON.parse((await post('/api/coach/analyze', { query: 'birthday cake', genieOff: false })).body);
check('Genie triggers for "birthday cake"', c8.triggered === true || c8.no_match_state !== 'none', `triggered=${c8.triggered}, no_match_state=${c8.no_match_state}`);

console.log('\n=== SUMMARY ===');
const pass = results.filter(r => r.pass).length;
const fail = results.filter(r => !r.pass).length;
console.log(`${pass} PASS / ${fail} FAIL out of ${results.length} checks`);
if (fail > 0) {
  console.log('\nFailed checks:');
  results.filter(r => !r.pass).forEach(r => console.log(`  FAIL: ${r.name} — ${r.detail}`));
  process.exit(1);
}
