import http from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { LEAGUES } from '../public/leagues.js';
import { loadAverages } from './stats.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const REGIONS = new Set(['us', 'us2', 'uk', 'eu', 'au']);
const STATIC = new Map([
  ['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']],
  ['/app.js', ['app.js', 'text/javascript']], ['/styles.css', ['styles.css', 'text/css']],
  ['/domain.js', ['domain.js', 'text/javascript']], ['/leagues.js', ['leagues.js', 'text/javascript']],
  ['/identities.js', ['identities.js', 'text/javascript']], ['/sample.js', ['sample.js', 'text/javascript']],
  ['/matchup.js', ['matchup.js', 'text/javascript']],
]);
// Only known, regular image/font assets in this one directory enter the static allowlist.
const assetTypes = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', ttf: 'font/ttf', woff2: 'font/woff2' };
for (const entry of await readdir(resolve(ROOT, 'public', 'assets'), { withFileTypes: true }).catch(() => [])) {
  const match = /^([a-z0-9-]+)\.(png|webp|jpg|ttf|woff2)$/.exec(entry.name);
  if (entry.isFile() && match) STATIC.set(`/assets/${entry.name}`, [`assets/${entry.name}`, assetTypes[match[2]]]);
}
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
function securityHeaders(res) {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
}
async function bodyJson(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'Send JSON content.');
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > 32768) throw new HttpError(413, 'Request is too large.');
  }
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'Invalid JSON.'); }
}
function checkMarkets(league, markets) {
  if (!Array.isArray(markets) || !markets.length || markets.some(m => !league.markets.some(([key]) => key === m))) {
    throw new HttpError(400, 'Choose valid prop markets for this league.');
  }
  return [...new Set(markets)];
}
export function createApp({ apiKey = '', fetchImpl = fetch, averagesImpl = loadAverages } = {}) {
  return http.createServer(async (req, res) => {
    securityHeaders(res);
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;
      if (STATIC.has(path) && ['GET', 'HEAD'].includes(req.method)) {
        const [file, mime] = STATIC.get(path);
        const content = await readFile(resolve(ROOT, 'public', file));
        res.writeHead(200, { 'Content-Type': mime.startsWith('text/') ? `${mime}; charset=utf-8` : mime, 'Cache-Control': 'no-cache' });
        return res.end(req.method === 'HEAD' ? undefined : content);
      }
      if (!path.startsWith('/api/')) return json(res, 404, { error: 'Not found.' });
      // Prevent cross-site browser invocation. This is not a login or a usage limit.
      if (req.headers['sec-fetch-site'] === 'cross-site') throw new HttpError(403, 'Cross-site requests are not allowed.');
      if (req.headers.origin) {
        let origin;
        try { origin = new URL(req.headers.origin); } catch { throw new HttpError(403, 'Invalid origin.'); }
        if (origin.host !== req.headers.host) throw new HttpError(403, 'Cross-site requests are not allowed.');
      }
      if (path === '/api/health' && req.method === 'GET') return json(res, 200, { status: 'ok', configured: Boolean(apiKey) });
      const match = path.match(/^\/api\/(nba|nfl)\/(events|odds|averages|events\/([a-zA-Z0-9_-]{1,80})\/props)$/);
      if (!match) throw new HttpError(404, 'Unknown endpoint.');
      const league = LEAGUES[match[1]];
      const action = match[2];
      const allowedQuery = action.includes('/props') ? ['region', 'markets'] : action === 'odds' ? ['region'] : [];
      for (const key of url.searchParams.keys()) {
        if (!allowedQuery.includes(key) || url.searchParams.getAll(key).length !== 1) throw new HttpError(400, 'Unsupported query parameter.');
      }
      if (action === 'averages') {
        if (req.method !== 'POST') throw new HttpError(405, 'Use POST for averages.');
        const body = await bodyJson(req);
        if (!body || typeof body !== 'object' || !Array.isArray(body.players) || body.players.length > 150 ||
            body.players.some(p => typeof p !== 'string' || !p.trim() || p.length > 100)) throw new HttpError(400, 'Invalid players.');
        const markets = checkMarkets(league, body.markets);
        if (!Array.isArray(body.teams) || body.teams.length !== 2 || body.teams.some(t => !Object.hasOwn(league.teams, t))) throw new HttpError(400, 'Invalid teams.');
        if (typeof body.before !== 'string' || !Number.isFinite(Date.parse(body.before))) throw new HttpError(400, 'Invalid game date.');
        const result = await averagesImpl(league, { ...body, markets }, fetchImpl);
        return json(res, 200, result);
      }
      if (req.method !== 'GET') throw new HttpError(405, 'Use GET for odds and events.');
      const region = url.searchParams.get('region') || 'us';
      if (!REGIONS.has(region)) throw new HttpError(400, 'Invalid region.');
      let markets;
      if (action.includes('/props')) markets = checkMarkets(league, (url.searchParams.get('markets') || '').split(','));
      if (!apiKey) throw new HttpError(503, 'Live data is not configured on the server. Sample mode is available.');
      const endpoint = action === 'events' ? 'events' : action === 'odds' ? 'odds' : `events/${match[3]}/odds`;
      const upstream = new URL(`https://api.the-odds-api.com/v4/sports/${league.sport}/${endpoint}`);
      upstream.searchParams.set('apiKey', apiKey);
      if (action !== 'events') {
        upstream.searchParams.set('regions', region);
        upstream.searchParams.set('markets', markets ? markets.join(',') : 'h2h,spreads,totals');
        upstream.searchParams.set('oddsFormat', 'american');
      }
      let response;
      try { response = await fetchImpl(upstream, { signal: AbortSignal.timeout(20000), redirect: 'error' }); }
      catch { throw new HttpError(502, 'The odds provider could not be reached. Try again.'); }
      // Never return upstream error bodies, URLs, or exception messages: they may contain credentials.
      if (!response.ok) {
        const message = response.status === 401 || response.status === 403 ? 'The odds provider rejected the server credentials.' :
          response.status === 429 ? 'The odds provider is temporarily refusing requests. Try again later.' :
          response.status === 404 ? 'This event is no longer available.' : 'The odds provider could not return data.';
        throw new HttpError(response.status === 404 ? 404 : 502, message);
      }
      let data;
      try { data = await response.json(); } catch { throw new HttpError(502, 'The odds provider returned an invalid response.'); }
      if ((action === 'events' || action === 'odds') ? !Array.isArray(data) : (!data || typeof data !== 'object' || !Array.isArray(data.bookmakers))) {
        throw new HttpError(502, 'The odds provider returned an unexpected response.');
      }
      // Defensive redaction also covers unexpected fields in otherwise successful provider responses.
      const safeData = JSON.parse(JSON.stringify(data).split(apiKey).join('[redacted]'));
      const last = Number(response.headers.get('x-requests-last') || 0);
      return json(res, 200, { data: safeData, usage: { last: Number.isFinite(last) ? last : 0 }, fetchedAt: new Date().toISOString() });
    } catch (error) {
      if (!res.headersSent) json(res, error instanceof HttpError ? error.status : 502,
        { error: error instanceof HttpError ? error.message : 'Data could not be loaded. Please try again or use manual averages.' });
      else res.end();
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.loadEnvFile(resolve(ROOT, '.env')); } catch (error) { if (error.code !== 'ENOENT') throw new Error('Unable to read the environment file.'); }
  const port = Number(process.env.PORT || 4173);
  const host = process.env.HOST || '127.0.0.1';
  const server = createApp({ apiKey: process.env.ODDS_API?.trim() });
  server.requestTimeout = 60000;
  server.headersTimeout = 15000;
  server.listen(port, host, () => console.log(`Against All Odds is running at http://${host}:${port}`));
  server.on('error', error => { console.error(`Server could not start (${error.code || 'unknown error'}).`); process.exitCode = 1; });
}
