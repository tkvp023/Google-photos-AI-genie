// Smoke test: search API + coach analyze API
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

function post(url, body) {
  return new Promise((res, rej) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: 'localhost',
      port: 3000,
      path: url,
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

console.log('=== SMOKE TESTS ===\n');

// 1. Health
const health = await get('http://localhost:3000/api/health');
const hj = JSON.parse(health.body);
console.log(`[HEALTH] ok=${hj.ok}, photoCount=${hj.photoCount}, tagCoverage=${hj.tagCoverage} ${hj.ok && hj.photoCount >= 200 ? 'PASS' : 'FAIL'}`);

// 2. Search for "pool"
const search = await get('http://localhost:3000/api/search?q=pool');
const sj = JSON.parse(search.body);
console.log(`[SEARCH "pool"] count=${sj.results?.length ?? 0} ${sj.results?.length >= 10 ? 'PASS' : 'FAIL'}`);

// 3. Genie for "pool" should TRIGGER
const coach1 = await post('/api/coach/analyze', { query: 'pool', genieOff: false });
const c1 = JSON.parse(coach1.body);
console.log(`[GENIE "pool"] triggered=${c1.triggered}, questions=${c1.questions?.length ?? 0} ${c1.triggered && c1.questions?.length >= 2 ? 'PASS' : 'FAIL'}`);

// 4. Genie for "me" should NOT trigger (stopword only)
const coach2 = await post('/api/coach/analyze', { query: 'me', genieOff: false });
const c2 = JSON.parse(coach2.body);
console.log(`[GENIE "me"] triggered=${c2.triggered} ${!c2.triggered ? 'PASS' : 'FAIL'}`);

// 5. Genie with ?genie=off should NOT trigger
const coach3 = await post('/api/coach/analyze', { query: 'pool', genieOff: true });
const c3 = JSON.parse(coach3.body);
console.log(`[GENIE off "pool"] triggered=${c3.triggered} ${!c3.triggered ? 'PASS' : 'FAIL'}`);

// 6. Genie for "elephant" (no matching photos) should show no_match
const coach4 = await post('/api/coach/analyze', { query: 'elephant', genieOff: false });
const c4 = JSON.parse(coach4.body);
console.log(`[GENIE "elephant"] no_match_state=${c4.no_match_state} ${c4.no_match_state === 'zero' ? 'PASS' : 'FAIL'}`);

// 7. Genie for "12 March 2021 Goa pool" should NOT trigger (2+ precise anchors)
const coach5 = await post('/api/coach/analyze', { query: '12 March 2021 Goa pool', genieOff: false });
const c5 = JSON.parse(coach5.body);
console.log(`[GENIE "12 March 2021 Goa pool"] triggered=${c5.triggered} ${!c5.triggered ? 'PASS' : 'FAIL'}`);

console.log('\nSmoke tests complete.');
