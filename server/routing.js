const CANONICAL = 'https://the-matchup.app';
const hosts = new Set(['the-matchup.app', 'www.the-matchup.app', 'the-matchup.wpimedia.workers.dev']);
const aliases = new Map([['/index.html', '/'], ['/index', '/']]);
for (const league of ['nba', 'nfl']) for (const suffix of ['', '.html', '/index', '/index.html']) aliases.set(`/${league}${suffix}`, `/${league}/`);
export function redirectTarget(url, { enforceHttps = true } = {}) {
  const path = aliases.get(url.pathname) || url.pathname;
  if (hosts.has(url.hostname) && (url.hostname !== 'the-matchup.app' || (enforceHttps && url.protocol !== 'https:') || path !== url.pathname)) return CANONICAL + path + url.search;
  if (path !== url.pathname) return path + url.search;
  return null;
}
