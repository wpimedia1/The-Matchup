import test from 'node:test';
import assert from 'node:assert/strict';
import { LEAGUES } from '../public/leagues.js';
import { createSnapshots, resolveSnapshotAverages } from '../server/snapshots.js';
import { handleApi } from '../server/api.js';
import worker, { loadSnapshotAverages } from '../worker/index.js';

const now = new Date('2026-11-07T15:00:00Z');
const row = (id, name, team, date, points) => ({ athlete_id: id, athlete_display_name: name, team_abbreviation: team,
  game_date: date, game_id: `${id}-${date}`, points, minutes: 30 });
const data = rows => ({ rows, source: 'Test public stats', fetchedAt: now.toISOString(), partial: false });
const request = { players: ['Alex Player'], markets: ['player_points'], teams: ['Los Angeles Lakers', 'Boston Celtics'], before: '2026-11-08T00:00:00Z' };

test('team snapshots preserve full player form across trades and deduplicate the two teams', () => {
  const snapshots = createSnapshots(LEAGUES.nba, data([
    row('1', 'Alex Player', 'LAL', '2026-11-01', 10), row('1', 'Alex Player', 'BOS', '2026-11-03', 30),
  ]), now);
  const result = resolveSnapshotAverages(LEAGUES.nba, request, [snapshots.get('LAL'), snapshots.get('BOS')], +now);
  assert.deepEqual(result.results[0].values.player_points, { average: 20, games: 2 });
  assert.equal(result.fetchedAt, now.toISOString());
});
test('snapshot lookups reject stale or future snapshots and never leak later games into an earlier cutoff', () => {
  const snapshots = createSnapshots(LEAGUES.nba, data([row('1', 'Alex Player', 'LAL', '2026-11-03', 30)]), now);
  const selected = [snapshots.get('LAL'), snapshots.get('BOS')];
  assert.throws(() => resolveSnapshotAverages(LEAGUES.nba, request, selected, +now + 49 * 3600000));
  assert.throws(() => resolveSnapshotAverages(LEAGUES.nba, request, selected, +now - 3600000));
  const earlier = resolveSnapshotAverages(LEAGUES.nba, { ...request, before: '2026-11-02' }, selected, +now);
  assert.deepEqual(earlier.results[0].values, {});
});
test('initial-name ambiguity remains blank and incomplete refreshes cannot replace good snapshots', () => {
  const rows = [row('1', 'Alex Player', 'LAL', '2026-11-03', 30), row('2', 'Adam Player', 'BOS', '2026-11-03', 10)];
  const snapshots = createSnapshots(LEAGUES.nba, data(rows), now);
  const result = resolveSnapshotAverages(LEAGUES.nba, { ...request, players: ['A. Player'] }, [snapshots.get('LAL'), snapshots.get('BOS')], +now);
  assert.equal(result.results[0].reason, 'Ambiguous player match');
  assert.throws(() => createSnapshots(LEAGUES.nba, { ...data(rows), partial: true }, now));
});
test('web-standard API keeps credentials server-only and restricts the upstream authority', async () => {
  const urls = [], key = ['fake', 'worker', 'secret'].join('-');
  const response = await handleApi(new Request('https://the-matchup.example/api/nfl/events/game_1/props?markets=player_pass_yds'), {
    apiKey: key, fetchImpl: async (url, init) => { urls.push(url); assert.equal(init.redirect, 'manual');
      return Response.json({ bookmakers: [], accidental: key }); },
  });
  assert.equal(response.status, 200); assert.equal(urls[0].origin, 'https://api.the-odds-api.com');
  assert.doesNotMatch(await response.text(), new RegExp(key));
  const denied = await handleApi(new Request('https://the-matchup.example/api/nfl/events', { headers: { Origin: 'https://attacker.example' } }), { apiKey: key });
  assert.equal(denied.status, 403);
});

test('upstream redirects are never followed or returned for odds or team summaries', async () => {
  const redirect = async (url, init) => {
    assert.equal(init.redirect, 'manual');
    return new Response(null, { status: 302, headers: { Location: 'https://untrusted.example/' } });
  };
  const odds = await handleApi(new Request('https://the-matchup.example/api/nba/events'), { apiKey: 'fake-test-key', fetchImpl: redirect });
  assert.equal(odds.status, 502);
  assert.doesNotMatch(await odds.text(), /untrusted/);
  await assert.rejects(() => loadSnapshotAverages(LEAGUES.nba, request, redirect), { status: 503 });
});
test('Worker health works without secrets; private paths can only reach the static asset binding', async () => {
  const health = await worker.fetch(new Request('https://the-matchup.example/api/health'), {});
  assert.deepEqual(await health.json(), { status: 'ok', configured: false });
  assert.match(health.headers.get('strict-transport-security'), /max-age/);
  const paths = [];
  const response = await worker.fetch(new Request('https://the-matchup.example/.env'), { ASSETS: { fetch: async req => {
    paths.push(new URL(req.url).pathname); return new Response('Not found', { status: 404 });
  } } });
  assert.equal(response.status, 404); assert.deepEqual(paths, ['/.env']);
});
