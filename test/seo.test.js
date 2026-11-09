import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { createApp } from '../server/index.js';
import { PAGES, ORIGIN, structuredData } from '../public/site.js';
import { redirectTarget } from '../server/routing.js';
import worker from '../worker/index.js';

async function site(t) {
  let calls = 0;
  const app = createApp({ fetchImpl: async () => { calls++; throw new Error('A page must not fetch odds.'); } });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  t.after(() => new Promise(resolve => { app.closeAllConnections(); app.close(resolve); }));
  return { get: (path, init) => fetch(`http://127.0.0.1:${app.address().port}${path}`, init), calls: () => calls };
}
test('all canonical pages ship distinct metadata, one H1, crawlable links and CSP-authorized schema without API calls', async t => {
  const { get, calls } = await site(t), titles = new Set();
  for (const [key, page] of Object.entries(PAGES)) {
    const r = await get(page.path), html = await r.text();
    assert.equal(r.status, 200);
    assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1);
    assert.ok(html.includes(page.heading.replaceAll('&', '&amp;')));
    assert.ok(html.includes(`rel="canonical" href="${ORIGIN}${page.path}"`));
    assert.ok(html.includes('href="/nba/"')); assert.ok(html.includes('href="/nfl/"'));
    assert.doesNotMatch(html, /Against All Odds|AGAINST ALL ODDS|unsafe-inline/);
    const schema = html.match(/id="page-schema">([\s\S]*?)<\/script>/)[1];
    assert.deepEqual(JSON.parse(schema), JSON.parse(structuredData(key)));
    for (const candidate of Object.keys(PAGES)) {
      const hash = createHash('sha256').update(structuredData(candidate)).digest('base64');
      assert.ok(r.headers.get('content-security-policy').includes(`'sha256-${hash}'`));
    }
    titles.add(html.match(/<title>(.*?)<\/title>/)[1]);
    if (key === 'home') assert.doesNotMatch(html, /src="\/app.js"/);
    else assert.ok(html.includes(`data-league="${key}"`));
    assert.equal((await get(page.path, { method: 'HEAD' })).headers.get('content-type'), 'text/html; charset=utf-8');
  }
  assert.equal(titles.size, 3); assert.equal(calls(), 0);
});
test('crawl files contain only canonical pages, while errors retain real statuses and noindex', async t => {
  const { get } = await site(t);
  const robots = await get('/robots.txt'); assert.equal(robots.status, 200);
  assert.match(await robots.text(), /Disallow: \/api\/[\s\S]*Sitemap: https:\/\/the-matchup.app\/sitemap.xml/);
  const sitemap = await get('/sitemap.xml'); assert.match(sitemap.headers.get('content-type'), /application\/xml/);
  const xml = await sitemap.text();
  assert.deepEqual([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]), Object.values(PAGES).map(p => ORIGIN + p.path));
  const security = await get('/.well-known/security.txt'); const securityText = await security.text();
  assert.match(securityText, /Contact: https:\/\/github.com\/wpimedia1\/The-Matchup\/security\/advisories\/new/);
  assert.ok(Date.parse(securityText.match(/Expires: (.*)/)[1]) > Date.now());
  for (const path of ['/not-a-page', '/nba/not-a-page', '/.env', '/server/pages.js', '/package.json']) {
    const r = await get(path); assert.equal(r.status, 404); assert.equal(r.headers.get('x-robots-tag'), 'noindex');
    const html = await r.text(); assert.match(html, /404 · OUT OF PLAY/); assert.match(html, /name="robots" content="noindex, follow"/);
    assert.doesNotMatch(html, /rel="canonical"/);
  }
  const api = await get('/api/missing'); assert.equal(api.status, 404); assert.match(api.headers.get('content-type'), /application\/json/);
  assert.equal(api.headers.get('x-robots-tag'), 'noindex');
});
test('canonical redirects preserve queries and methods without changing local hosts or trusting URL input', async t => {
  const { get } = await site(t);
  for (const [path, expected] of [['/index.html', '/'], ['/nba', '/nba/'], ['/nfl.html', '/nfl/'], ['/nba/index.html?x=1', '/nba/?x=1']]) {
    const r = await get(path, { redirect: 'manual' }); assert.equal(r.status, 308); assert.equal(r.headers.get('location'), expected);
  }
  for (const source of ['http://the-matchup.app/nba?x=1', 'https://www.the-matchup.app/nba?x=1', 'https://the-matchup.wpimedia.workers.dev/nba?x=1']) {
    assert.equal(redirectTarget(new URL(source)), `${ORIGIN}/nba/?x=1`);
    const r = await worker.fetch(new Request(source), {}); assert.equal(r.status, 308); assert.equal(r.headers.get('location'), `${ORIGIN}/nba/?x=1`);
  }
  assert.equal(redirectTarget(new URL('http://localhost:4173/nba/')), null);
  assert.equal(redirectTarget(new URL('http://the-matchup.app/'), { enforceHttps: false }), null);
  assert.equal(redirectTarget(new URL('https://the-matchup.app/?next=https://attacker.example')), null);
});

test('Worker previews and missing assets are noindex without changing successful production pages', async () => {
  for (const [host, status, noindex] of [['the-matchup.app', 200, null], ['the-matchup.app', 404, 'noindex'], ['preview.the-matchup.app', 200, 'noindex']]) {
    const response = await worker.fetch(new Request(`https://${host}/`), { ASSETS: { fetch: async () => new Response('page', { status }) } });
    assert.equal(response.status, status);
    assert.equal(response.headers.get('x-robots-tag'), noindex);
    assert.equal(await response.text(), 'page');
  }
});
