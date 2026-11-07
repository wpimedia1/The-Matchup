import { mkdir, writeFile } from 'node:fs/promises';
import { LEAGUES } from '../public/leagues.js';
import { loadRows } from '../server/stats.js';
import { createSnapshots } from '../server/snapshots.js';

const base = new URL('../dist/stats/', import.meta.url), now = new Date();
await mkdir(base, { recursive: true });
for (const league of Object.values(LEAGUES)) {
  const data = await loadRows(league);
  const snapshots = createSnapshots(league, data, now);
  await mkdir(new URL(`${league.id}/`, base), { recursive: true });
  for (const [team, snapshot] of snapshots) {
    if (!/^[A-Z0-9]+$/.test(team)) throw new Error('Invalid team filename');
    await writeFile(new URL(`${league.id}/${team}.json`, base), JSON.stringify(snapshot));
  }
  console.log(`${league.label}: ${snapshots.size} complete team summaries generated from ${data.rows.length} public game logs.`);
}
await writeFile(new URL('README.md', base), '# The Matchup public statistics\n\nGenerated team-level recent-form summaries from SportsDataverse / hoopR and nflverse. No odds, credentials, or user data. Updated by the protected main-branch workflow.\n');
