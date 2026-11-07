import { handleApi, HttpError } from '../server/api.js';
import { resolveSnapshotAverages } from '../server/snapshots.js';

const snapshotCache = new Map();
export async function loadSnapshotAverages(league, request, fetchImpl = fetch) {
  const snapshots = await Promise.all([...new Set(request.teams.map(team => league.teams[team]))].map(async team => {
    const key = `${league.id}/${team}`, cached = snapshotCache.get(key);
    if (cached && Date.now() - cached.at < 3600000) return cached.data;
    // Repository, branch, and origin are fixed; team is selected from the league allowlist.
    const url = new URL('https://raw.githubusercontent.com');
    url.pathname = `/wpimedia1/The-Matchup/stats-data/${league.id}/${encodeURIComponent(team)}.json`;
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(15000), redirect: 'manual' });
    if (!response.ok) throw new HttpError(503, 'Recent averages are temporarily unavailable. Please try again later or enter an average manually.');
    const data = await response.json();
    // The published team summaries are small; do not retain raw season files here.
    if (data.schema !== 1 || data.league !== league.id || data.team !== team || !Array.isArray(data.players)) throw new Error('Invalid statistics snapshot.');
    snapshotCache.set(key, { at: Date.now(), data }); return data;
  }));
  return resolveSnapshotAverages(league, request, snapshots);
}
export default {
  async fetch(request, env) {
    if (!new URL(request.url).pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const response = await handleApi(request, { apiKey: typeof env.ODDS_API === 'string' ? env.ODDS_API.trim() : '', averagesImpl: loadSnapshotAverages });
    response.headers.set('Strict-Transport-Security', 'max-age=31536000');
    return response;
  },
};
