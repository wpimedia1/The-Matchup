import test from 'node:test';
import assert from 'node:assert/strict';
import { marketRows, marketTables, sampleFight, fightMarkets } from '../public/fight-markets.js';
import { handleApi } from '../server/api.js';

test('fight comparisons preserve exact lines, market types, attribution and lay ordering', () => {
  const book = (title, price, point) => ({ title, markets: [
    { key: 'totals', outcomes: [{ name: 'Over', point, price }] },
    { key: 'h2h_lay', outcomes: [{ name: 'Fighter', price }] },
  ] });
  const books = [book('First', 125, 1.5), book('Second', 115, 1.5), book('Third', 130, 2.5)];
  assert.deepEqual(marketRows(books, 'totals').map(r => [r.point, r.offers[0].book]), [[1.5, 'First'], [2.5, 'Third']]);
  assert.equal(marketRows(books, 'h2h_lay')[0].offers[0].book, 'Second');
  const sample = marketTables(sampleFight);
  for (const name of Object.values(fightMarkets)) assert.ok(sample.includes(name));
  assert.doesNotMatch(marketTables(sampleFight, false), /<h3>Rounds/);
});

test('MMA routes forward fixed markets and scoped regions while rejecting other sports operations', async () => {
  const calls = [];
  const get = path => handleApi(new Request('https://example.test/api/' + path), {
    apiKey: 'test-credential', fetchImpl: async url => {
      calls.push(url);
      return Response.json(url.pathname.includes('/events/') ? { bookmakers: [] } : []);
    },
  });
  assert.equal((await get('mma/odds?region=all')).status, 200);
  assert.equal(calls[0].pathname, '/v4/sports/mma_mixed_martial_arts/odds');
  assert.equal(calls[0].searchParams.get('markets'), 'h2h');
  assert.equal(calls[0].searchParams.get('regions'), 'us,us2,uk,eu,au');
  assert.equal((await get('mma/events/abc/markets?region=eu')).status, 200);
  assert.equal(calls[1].pathname, '/v4/sports/mma_mixed_martial_arts/events/abc/odds');
  assert.deepEqual(calls[1].searchParams.get('markets').split(','), Object.keys(fightMarkets));
  for (const path of ['nfl/events/abc/markets', 'mma/averages', 'mma/events/abc/props']) assert.equal((await get(path)).status, 404);
  assert.equal((await get('mma/events/abc/markets?markets=unknown')).status, 400);
  assert.equal(calls.length, 2);
});
