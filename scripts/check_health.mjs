import http from 'node:http';
http.get('http://localhost:3000/api/health', (r) => {
  let d = '';
  r.on('data', (c) => { d += c; });
  r.on('end', () => console.log(d));
}).on('error', (e) => console.log('Server not up:', e.code));
