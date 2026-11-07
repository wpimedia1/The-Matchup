// Reproducible download of public visual assets. No credentials are used.
import { mkdir, writeFile, access } from 'node:fs/promises';
import { setDefaultResultOrder } from 'node:dns';
import { LEAGUES } from '../public/leagues.js';
const base = new URL('../public/assets/', import.meta.url);
setDefaultResultOrder('ipv4first');
await mkdir(base, { recursive: true });
async function download(url, filename) {
  if (!/^[a-z0-9-]+\.(png|ttf|txt)$/.test(filename)) throw new Error('Invalid asset filename.');
  const source = new URL(url);
  const allowedSource = source.protocol === 'https:' && !source.username && !source.password && !source.port &&
    ((source.hostname === 'a.espncdn.com' && /^\/i\/(teamlogos|headshots)\//.test(source.pathname)) ||
     (source.hostname === 'raw.githubusercontent.com' && source.pathname.startsWith('/google/fonts/main/ofl/')));
  if (!allowedSource) throw new Error('Asset source is not allowlisted.');
  try { await access(new URL(filename, base)); return; } catch {}
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(source, { signal: AbortSignal.timeout(25000), redirect: 'error' });
      if (!response.ok) throw new Error(`Asset download failed: ${filename} (${response.status})`);
      const chunks = []; let length = 0;
      for await (const chunk of response.body) {
        length += chunk.byteLength;
        if (length > 10 * 1024 * 1024) throw new Error('Asset exceeds the download size limit.');
        chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks);
      if (filename.endsWith('.png') && !bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Invalid PNG asset.');
      if (filename.endsWith('.ttf') && !bytes.subarray(0, 4).equals(Buffer.from([0,1,0,0]))) throw new Error('Invalid TrueType font.');
      if (filename.endsWith('.txt') && !bytes.toString('utf8').includes('SIL OPEN FONT LICENSE')) throw new Error('Invalid font license.');
      await writeFile(new URL(filename, base), bytes, { flag: 'wx' }); return;
    } catch (error) { if (attempt === 2) throw error; }
  }
}
const sources = [];
const teams = {};
for (const [league, sport] of [['nba', 'basketball'], ['nfl', 'football']]) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams?limit=100`;
  const data = await (await fetch(url)).json();
  const entries = data.sports[0].leagues[0].teams;
  for (let offset = 0; offset < entries.length; offset += 6) {
    await Promise.all(entries.slice(offset, offset + 6).map(async ({ team }) => {
      const name = Object.keys(LEAGUES[league].teams).find(n => n === team.displayName || LEAGUES[league].teams[n] === team.abbreviation ||
        (n === 'Los Angeles Clippers' && team.displayName === 'LA Clippers'));
      if (!name) throw new Error(`Unmatched team: ${team.displayName}`);
      const file = `${league}-${LEAGUES[league].teams[name].toLowerCase()}.png`;
      const source = team.logos.find(logo => logo.rel?.includes('default'))?.href || team.logos[0].href;
      await download(source, file);
      teams[name] = { name: team.name, city: team.location, abbr: LEAGUES[league].teams[name], color: `#${team.color}`, alternate: `#${team.alternateColor}`, logo: `/assets/${file}` };
      sources.push({ file, source });
    }));
  }
  const source = `https://a.espncdn.com/i/teamlogos/leagues/500/${league}.png`;
  await download(source, `${league}.png`); sources.push({ file: `${league}.png`, source });
}
const people = {};
for (const [league, sport, team] of [['nfl', 'football', 'buf'], ['nfl', 'football', 'kc'], ['nba', 'basketball', 'lal'], ['nba', 'basketball', 'bos']]) {
  const data = await (await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${team}/roster`)).json();
  const athletes = data.athletes.flatMap(group => group.items || [group]);
  const wanted = ['Josh Allen', 'Patrick Mahomes', 'James Cook', 'Travis Kelce', 'LeBron James', 'Jayson Tatum'];
  for (const athlete of athletes.filter(a => wanted.includes(a.fullName) || wanted.includes(a.displayName))) {
    const name = wanted.includes(athlete.displayName) ? athlete.displayName : athlete.fullName;
    if (!athlete.headshot?.href) continue;
    if (!/^\d{1,12}$/.test(String(athlete.id))) throw new Error('Invalid player asset identifier.');
    const file = `player-${league}-${athlete.id}.png`;
    await download(athlete.headshot.href, file);
    people[name] = { name, photo: `/assets/${file}`, position: athlete.position?.abbreviation || '', team: team.toUpperCase() };
    sources.push({ file, source: athlete.headshot.href });
  }
}
// Historical sample fixtures retain these players even if today's roster has changed.
for (const [name, league, id, position, team] of [['James Cook', 'nfl', '4379399', 'RB', 'BUF'], ['LeBron James', 'nba', '1966', 'F', 'LAL'], ['Anthony Davis', 'nba', '6583', 'C', 'LAL']]) {
  const source = `https://a.espncdn.com/i/headshots/${league}/players/full/${id}.png`, file = `player-${league}-${id}.png`;
  await download(source, file); people[name] = { name, photo: `/assets/${file}`, position, team };
  sources.push({ file, source });
}
for (const [folder, file] of [['barlowcondensed','BarlowCondensed-ExtraBold.ttf'], ['barlowcondensed','BarlowCondensed-ExtraBoldItalic.ttf'], ['barlow','Barlow-Regular.ttf'], ['barlow','Barlow-SemiBold.ttf']]) {
  const source = `https://raw.githubusercontent.com/google/fonts/main/ofl/${folder}/${file}`;
  await download(source, file.toLowerCase()); sources.push({ file: file.toLowerCase(), source });
}
await download('https://raw.githubusercontent.com/google/fonts/main/ofl/barlow/OFL.txt', 'font-license.txt');
await writeFile(new URL('../public/identities.js', import.meta.url), `export const TEAMS = ${JSON.stringify(teams, null, 2)};\nexport const PLAYERS = ${JSON.stringify(people, null, 2)};\n`);
await writeFile(new URL('sources.json', base), JSON.stringify(sources, null, 2));
console.log(`Saved ${Object.keys(teams).length} team identities, ${Object.keys(people).length} player portraits, league logos and local fonts.`);
