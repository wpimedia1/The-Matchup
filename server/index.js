import http from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { loadAverages } from './stats.js';
import { handleApi, json, SECURITY_HEADERS } from './api.js';
import { renderPage, PAGE_HEADERS, ROBOTS, SITEMAP, SECURITY_TXT } from './pages.js';
import { redirectTarget } from './routing.js';
export { HttpError } from './api.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const STATIC = new Map([
  ['/site.js', ['site.js', 'text/javascript']], ['/site.css', ['site.css', 'text/css']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
  ['/app.js', ['app.js', 'text/javascript']], ['/styles.css', ['styles.css', 'text/css']],
  ['/domain.js', ['domain.js', 'text/javascript']], ['/leagues.js', ['leagues.js', 'text/javascript']],
  ['/identities.js', ['identities.js', 'text/javascript']], ['/sample.js', ['sample.js', 'text/javascript']],
  ['/matchup.js', ['matchup.js', 'text/javascript']],
]);
const pages = new Map([['/', renderPage('home')], ['/nba/', renderPage('nba')], ['/nfl/', renderPage('nfl')]]);
const resources = new Map([['/robots.txt', [ROBOTS, 'text/plain']], ['/sitemap.xml', [SITEMAP, 'application/xml']], ['/.well-known/security.txt', [SECURITY_TXT, 'text/plain']]]);
const assetTypes = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', ttf: 'font/ttf', woff2: 'font/woff2' };
for (const entry of await readdir(resolve(ROOT, 'public', 'assets'), { withFileTypes: true }).catch(() => [])) {
  const match = /^([a-z0-9-]+)\.(png|webp|jpg|ttf|woff2)$/.exec(entry.name);
  if (entry.isFile() && match) STATIC.set(`/assets/${entry.name}`, [`assets/${entry.name}`, assetTypes[match[2]]]);
}
export function createApp({ apiKey = '', fetchImpl = fetch, averagesImpl = loadAverages } = {}) {
  return http.createServer(async (req, res) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`), path = url.pathname;
      // Node's HTTPS termination belongs to its hosting proxy; do not trust forwarded headers.
      const redirect = redirectTarget(url, { enforceHttps: false });
      if (redirect) { res.writeHead(308, { Location: redirect }); return res.end(); }
      if (['GET', 'HEAD'].includes(req.method) && (pages.has(path) || resources.has(path))) {
        const [content, mime] = pages.has(path) ? [pages.get(path), 'text/html'] : resources.get(path);
        res.writeHead(200, { ...PAGE_HEADERS, 'Content-Type': `${mime}; charset=utf-8`, 'Cache-Control': 'no-cache' });
        return res.end(req.method === 'HEAD' ? undefined : content);
      }
      if (STATIC.has(path) && ['GET', 'HEAD'].includes(req.method)) {
        const [file, mime] = STATIC.get(path);
        const content = await readFile(resolve(ROOT, 'public', file));
        res.writeHead(200, { 'Content-Type': mime.startsWith('text/') ? `${mime}; charset=utf-8` : mime, 'Cache-Control': 'no-cache' });
        return res.end(req.method === 'HEAD' ? undefined : content);
      }
      if (!path.startsWith('/api/')) {
        res.writeHead(404, { ...PAGE_HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' });
        return res.end(req.method === 'HEAD' ? undefined : renderPage('404'));
      }
      const request = new Request(new URL(req.url, `http://${req.headers.host || 'localhost'}`), {
        method: req.method, headers: req.headers,
        ...(!['GET', 'HEAD'].includes(req.method) ? { body: Readable.toWeb(req), duplex: 'half' } : {}),
      });
      const response = await handleApi(request, { apiKey, fetchImpl, averagesImpl });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      if (!res.headersSent) {
        const response = json(502, { error: 'Data could not be loaded. Please try again or use manual averages.' });
        res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text());
      } else res.end();
    }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.loadEnvFile(resolve(ROOT, '.env')); } catch (error) { if (error.code !== 'ENOENT') throw new Error('Unable to read the environment file.'); }
  const port = Number(process.env.PORT || 4173), host = process.env.HOST || '127.0.0.1';
  const server = createApp({ apiKey: process.env.ODDS_API?.trim() });
  server.requestTimeout = 60000; server.headersTimeout = 15000;
  server.listen(port, host, () => console.log(`The Matchup is running at http://${host}:${port}`));
  server.on('error', error => { console.error(`Server could not start (${error.code || 'unknown error'}).`); process.exitCode = 1; });
}
