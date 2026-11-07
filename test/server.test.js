import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server/index.js';

async function fixture(t, options = {}) {
  const calls = [];
  const server = createApp({ apiKey: 'test-secret-never-public', fetchImpl: async (url, init) => {
    calls.push({ url: new URL(url), init });
    return new Response(JSON.stringify(url.pathname.includes('/events/') ? { bookmakers: [] } : []), { headers: { 'x-requests-last': '3' } });
  }, ...options });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { calls, base, get: (path, init) => fetch(`${base}${path}`, init) };
}
test('serves the app with security headers and never exposes private files', async t => {
  const { get } = await fixture(t);
  for (const path of ['/', '/app.js', '/styles.css', '/domain.js', '/leagues.js', '/matchup.js', '/identities.js', '/sample.js']) {
    const response = await get(path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-security-policy'), /connect-src 'self'/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.doesNotMatch(await response.text(), /test-secret-never-public/);
  }
  for (const path of ['/.env', '/%2eenv', '/server/index.js', '/package.json', '/nba-dashboard.html', '/..%2f.env', '/.git/config', '/assets/..%2f..%2f.env', '/assets/sources.json']) {
    assert.equal((await get(path)).status, 404, path);
  }
  const logo = await get('/assets/nfl-buf.png');
  assert.equal(logo.headers.get('content-type'), 'image/png');
  assert.equal(Buffer.from(await logo.arrayBuffer()).subarray(1, 4).toString(), 'PNG');
  const font = await get('/assets/barlow-regular.ttf');
  assert.equal(font.status, 200); assert.equal(font.headers.get('content-type'), 'font/ttf');
});
test('proxies allowlisted leagues, regions and markets with server-only credentials', async t => {
  const { get, calls } = await fixture(t);
  for (const league of ['nba', 'nfl']) {
    assert.equal((await get(`/api/${league}/events`)).status, 200);
    const response = await get(`/api/${league}/odds?region=uk`);
    assert.equal(response.status, 200);
    const body = await response.json(); assert.equal(body.usage.last, 3);
    assert.doesNotMatch(JSON.stringify(body), /test-secret/);
  }
  assert.equal((await get('/api/nba/events/abc123/props?region=us&markets=player_points,player_rebounds')).status, 200);
  assert.equal(calls.at(-1).url.host, 'api.the-odds-api.com');
  assert.equal(calls.at(-1).url.searchParams.get('apiKey'), 'test-secret-never-public');
  assert.equal(calls.at(-1).url.searchParams.get('markets'), 'player_points,player_rebounds');
  assert.equal(calls.at(-1).init.redirect, 'manual');
  for (const call of calls) assert.equal(call.url.origin, 'https://api.the-odds-api.com');
});
test('rejects unexpected endpoints, query injection, cross-site calls and wrong methods before forwarding', async t => {
  const { get, calls } = await fixture(t);
  for (const path of ['/api/nba/odds?region=nope', '/api/nba/odds?apiKey=attacker', '/api/nba/odds?region=us&region=uk',
    '/api/nba/events/abc/props?markets=player_pass_yds', '/api/nba/events/abc/props?markets=', '/api/nba/events?url=https://example.com']) {
    assert.equal((await get(path)).status, 400, path);
  }
  assert.equal((await get('/api/mlb/events')).status, 404);
  for (const path of ['/api/nba/events/https:%2f%2fevil.example/props?markets=player_points',
    '/api/nba/events/..%2f..%2fother/props?markets=player_points',
    '/api/nba/events/evil.example@internal/props?markets=player_points']) {
    assert.equal((await get(path)).status, 404);
  }
  assert.equal((await get('/api/nba/odds', { method: 'POST' })).status, 405);
  assert.equal((await get('/api/nba/events', { headers: { Origin: 'https://attacker.example' } })).status, 403);
  assert.equal((await get('/api/nba/events', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal(calls.length, 0);
});
test('keeps missing credentials and upstream failures safe', async t => {
  const missing = await fixture(t, { apiKey: '' });
  assert.deepEqual(await (await missing.get('/api/health')).json(), { status: 'ok', configured: false });
  assert.equal((await missing.get('/api/nfl/events')).status, 503);
  const rejected = await fixture(t, { fetchImpl: async () => new Response('apiKey=test-secret-never-public', { status: 401 }) });
  const response = await rejected.get('/api/nfl/events');
  assert.equal(response.status, 502); assert.doesNotMatch(await response.text(), /test-secret/);
  const failed = await fixture(t, { fetchImpl: async () => { throw new Error('https://provider/?apiKey=test-secret-never-public'); } });
  assert.doesNotMatch(await (await failed.get('/api/nfl/events')).text(), /test-secret/);
  const unexpected = await fixture(t, { fetchImpl: async () => new Response('{"apiKey":"test-secret-never-public"}') });
  assert.equal((await unexpected.get('/api/nfl/events')).status, 502);
  const redacted = await fixture(t, { fetchImpl: async () => new Response('[{"unexpected":"test-secret-never-public"}]') });
  assert.doesNotMatch(await (await redacted.get('/api/nfl/events')).text(), /test-secret/);
});
test('averages accepts only validated inputs without requiring odds credentials', async t => {
  let received;
  const { get } = await fixture(t, { apiKey: '', averagesImpl: async (league, body) => { received = { league, body }; return { results: [] }; } });
  const body = { players: ['LeBron James'], markets: ['player_points'], teams: ['Los Angeles Lakers', 'Boston Celtics'], before: '2026-11-07T22:00:00Z' };
  const post = value => get('/api/nba/averages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  assert.equal((await post(body)).status, 200); assert.equal(received.league.id, 'nba');
  assert.equal((await post({ ...body, teams: ['Unknown', 'Boston Celtics'] })).status, 400);
  assert.equal((await post({ ...body, markets: ['constructor'] })).status, 400);
  assert.equal((await post({ ...body, before: 'bad date' })).status, 400);
  assert.equal((await post(null)).status, 400);
  assert.equal((await get('/api/nba/averages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
  assert.equal((await get('/api/nba/averages', { method: 'POST', body: 'x' })).status, 415);
  assert.equal((await post({ ...body, players: ['x'.repeat(40000)] })).status, 413);
});
