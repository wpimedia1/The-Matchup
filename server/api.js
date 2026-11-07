import { LEAGUES } from '../public/leagues.js';

const REGIONS = new Set(['us', 'us2', 'uk', 'eu', 'au']);
export const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Resource-Policy': 'same-origin',
};
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
async function bodyJson(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError(415, 'Send JSON content.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Invalid JSON.');
  let length = 0, text = ''; const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > 32768) throw new HttpError(413, 'Request is too large.');
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'Invalid JSON.'); }
}
function checkMarkets(league, markets) {
  if (!Array.isArray(markets) || !markets.length || markets.some(m => !league.markets.some(([key]) => key === m))) {
    throw new HttpError(400, 'Choose valid prop markets for this league.');
  }
  return [...new Set(markets)];
}
export async function handleApi(request, { apiKey = '', fetchImpl = fetch, averagesImpl }) {
  try {
    const url = new URL(request.url), path = url.pathname;
    if (!path.startsWith('/api/')) return json(404, { error: 'Not found.' });
    if (request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403, 'Cross-site requests are not allowed.');
    if (request.headers.has('origin')) {
      let origin;
      try { origin = new URL(request.headers.get('origin')); } catch { throw new HttpError(403, 'Invalid origin.'); }
      if (origin.host !== url.host) throw new HttpError(403, 'Cross-site requests are not allowed.');
    }
    if (path === '/api/health' && request.method === 'GET') return json(200, { status: 'ok', configured: Boolean(apiKey) });
    const match = path.match(/^\/api\/(nba|nfl)\/(events|odds|averages|events\/([a-zA-Z0-9_-]{1,80})\/props)$/);
    if (!match) throw new HttpError(404, 'Unknown endpoint.');
    const league = LEAGUES[match[1]], action = match[2];
    const allowedQuery = action.includes('/props') ? ['region', 'markets'] : action === 'odds' ? ['region'] : [];
    for (const key of url.searchParams.keys()) {
      if (!allowedQuery.includes(key) || url.searchParams.getAll(key).length !== 1) throw new HttpError(400, 'Unsupported query parameter.');
    }
    if (action === 'averages') {
      if (request.method !== 'POST') throw new HttpError(405, 'Use POST for averages.');
      const body = await bodyJson(request);
      if (!body || typeof body !== 'object' || !Array.isArray(body.players) || body.players.length > 150 ||
          body.players.some(p => typeof p !== 'string' || !p.trim() || p.length > 100)) throw new HttpError(400, 'Invalid players.');
      const markets = checkMarkets(league, body.markets);
      if (!Array.isArray(body.teams) || body.teams.length !== 2 || body.teams.some(t => !Object.hasOwn(league.teams, t))) throw new HttpError(400, 'Invalid teams.');
      if (typeof body.before !== 'string' || !Number.isFinite(Date.parse(body.before))) throw new HttpError(400, 'Invalid game date.');
      return json(200, await averagesImpl(league, { ...body, markets }, fetchImpl));
    }
    if (request.method !== 'GET') throw new HttpError(405, 'Use GET for odds and events.');
    const region = url.searchParams.get('region') || 'us';
    if (!REGIONS.has(region)) throw new HttpError(400, 'Invalid region.');
    let markets;
    if (action.includes('/props')) markets = checkMarkets(league, (url.searchParams.get('markets') || '').split(','));
    if (!apiKey) throw new HttpError(503, 'Live data is not configured on the server. Sample mode is available.');
    const endpoint = action === 'events' ? 'events' : action === 'odds' ? 'odds' : `events/${encodeURIComponent(match[3])}/odds`;
    const upstream = new URL('https://api.the-odds-api.com');
    const sport = match[1] === 'nba' ? 'basketball_nba' : 'americanfootball_nfl';
    upstream.pathname = `/v4/sports/${sport}/${endpoint}`;
    upstream.searchParams.set('apiKey', apiKey);
    if (action !== 'events') {
      upstream.searchParams.set('regions', region);
      upstream.searchParams.set('markets', markets ? markets.join(',') : 'h2h,spreads,totals');
      upstream.searchParams.set('oddsFormat', 'american');
    }
    let response;
    try { response = await fetchImpl(upstream, { signal: AbortSignal.timeout(20000), redirect: 'error' }); }
    catch { throw new HttpError(502, 'The odds provider could not be reached. Try again.'); }
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
    const safeData = JSON.parse(JSON.stringify(data).split(apiKey).join('[redacted]'));
    const last = Number(response.headers.get('x-requests-last') || 0);
    return json(200, { data: safeData, usage: { last: Number.isFinite(last) ? last : 0 }, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return json(error instanceof HttpError ? error.status : 502,
      { error: error instanceof HttpError ? error.message : 'Data could not be loaded. Please try again or use manual averages.' });
  }
}
