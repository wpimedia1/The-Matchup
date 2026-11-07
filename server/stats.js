import { LEAGUES } from '../public/leagues.js';

export function parseCSV(text) {
  const rows = []; let row = [], value = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (c === '"') quoted = false;
      else value += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(value); value = ''; }
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(value); if (row.some(Boolean)) rows.push(row); row = []; value = '';
    } else value += c;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  const headers = rows.shift() || [];
  return rows.map(values => Object.fromEntries(headers.map((header, i) => [header.trim(), values[i] ?? ''])));
}
export const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+(jr|sr|ii|iii|iv)$/, '').replace(/\s+/g, ' ').trim();
function numeric(row, ...keys) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}
const sum = (...values) => values.every(v => v !== null) ? values.reduce((a, b) => a + b, 0) : null;
export function statValue(row, field, league) {
  if (league === 'nfl') {
    if (field === 'rush_rec_yards') return sum(numeric(row, 'rushing_yards'), numeric(row, 'receiving_yards'));
    if (field === 'anytime_td') return sum(numeric(row, 'rushing_tds'), numeric(row, 'receiving_tds'));
    if (field === 'rush_attempts') return numeric(row, 'carries', 'rushing_attempts');
    return numeric(row, field);
  }
  const p = numeric(row, 'points', 'PTS'), r = numeric(row, 'rebounds', 'total_rebounds', 'REB'), a = numeric(row, 'assists', 'AST');
  return { PTS: p, REB: r, AST: a, PRA: sum(p, r, a), PR: sum(p, r), PA: sum(p, a), RA: sum(r, a),
    '3PT': numeric(row, 'three_point_field_goals_made', 'three_pointers_made', '3PT'),
    BLK: numeric(row, 'blocks', 'BLK'), STL: numeric(row, 'steals', 'STL'), TOV: numeric(row, 'turnovers', 'TOV'),
  }[field] ?? null;
}
export function calculateAverages(league, request, rows) {
  const cutoff = Math.min(Date.parse(request.before), Date.now());
  const teams = request.teams.map(team => normalize(league.teams[team]));
  const nameOf = row => row.athlete_display_name || row.player_display_name || row.player_name || row.athlete_name || '';
  const idOf = row => String(row.athlete_id || row.player_id || normalize(nameOf(row)));
  const dateOf = row => row.game_date_time || row.game_date || row.gameday || row.date;
  const validRows = rows.filter(row => {
    const date = Date.parse(dateOf(row));
    if (!Number.isFinite(date) || date >= cutoff) return false;
    if (league.id === 'nfl') return row.season_type === 'REG';
    if (/^(true|1)$/i.test(row.did_not_play || row.dnp || '')) return false;
    const minutes = numeric(row, 'minutes', 'min');
    return minutes === null || minutes > 0;
  });
  return request.players.map(player => {
    const wanted = normalize(player);
    let candidates = validRows.filter(row => normalize(nameOf(row)) === wanted);
    if (!candidates.length) {
      const pieces = wanted.split(' '), initial = pieces[0]?.[0], surname = pieces.slice(1).join(' ');
      candidates = validRows.filter(row => {
        const name = normalize(nameOf(row)), team = normalize(row.team_abbreviation || row.team || row.recent_team);
        return surname && name.startsWith(initial) && name.endsWith(` ${surname}`) && teams.includes(team);
      });
    }
    // Never silently merge two players with the same surname or initials.
    if (new Set(candidates.map(idOf)).size !== 1) return { player, values: {}, reason: candidates.length ? 'Ambiguous player match' : 'No matching game logs' };
    const seen = new Set();
    const games = candidates.sort((a, b) => Date.parse(dateOf(b)) - Date.parse(dateOf(a))).filter(row => {
      const id = row.game_id || dateOf(row);
      if (seen.has(id)) return false;
      seen.add(id); return true;
    }).slice(0, 10);
    const values = {};
    for (const key of request.markets) {
      const field = league.markets.find(([market]) => market === key)?.[2];
      const usable = games.map(row => statValue(row, field, league.id)).filter(value => value !== null);
      if (usable.length) values[key] = { average: Number((usable.reduce((a, b) => a + b, 0) / usable.length).toFixed(1)), games: usable.length };
    }
    return { player, values, latestGame: dateOf(games[0]), oldestGame: dateOf(games.at(-1)) };
  });
}

const cache = new Map();
const pending = new Map();
async function download(url, fetchImpl) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(45000), headers: { 'User-Agent': 'Against-All-Odds/1.0', Accept: 'application/vnd.github+json' } });
  if (!response.ok) throw new Error('Stats source unavailable');
  return response;
}
export async function loadRows(league, fetchImpl = fetch) {
  const now = new Date(), year = now.getUTCFullYear();
  let urls, source;
  if (league.id === 'nba') {
    const release = await (await download('https://api.github.com/repos/sportsdataverse/sportsdataverse-data/releases/tags/espn_nba_player_boxscores', fetchImpl)).json();
    const seasons = (release.assets || []).map(asset => /^player_box_(\d{4})\.csv$/.exec(asset.name))
      .filter(Boolean).map(match => Number(match[1])).filter(season => season <= year + 1).sort((a, b) => b - a).slice(0, 2);
    urls = seasons.map(season => `https://github.com/sportsdataverse/sportsdataverse-data/releases/download/espn_nba_player_boxscores/player_box_${season}.csv`);
    source = 'SportsDataverse / hoopR';
  } else {
    const season = now.getUTCMonth() < 7 ? year - 1 : year;
    urls = [season, season - 1].map(s => `https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_${s}.csv`);
    source = 'nflverse';
  }
  const results = await Promise.allSettled(urls.map(async url => parseCSV(await (await download(url, fetchImpl)).text())));
  let rows = results.filter(result => result.status === 'fulfilled').flatMap(result => result.value);
  if (!rows.length) throw new Error('No game logs available');
  if (league.id === 'nfl') {
    const schedule = parseCSV(await (await download('https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv', fetchImpl)).text());
    const dates = new Map(schedule.map(row => [row.game_id, row.gameday]));
    rows = rows.map(row => ({ ...row, gameday: dates.get(row.game_id) }));
  }
  return { rows, source, partial: results.some(result => result.status === 'rejected'), fetchedAt: new Date().toISOString() };
}
export async function loadAverages(league, request, fetchImpl = fetch) {
  // Cache large public stat files only; odds requests retain the original explicit-load behavior.
  const key = league.id;
  let entry = cache.get(key);
  if (!entry || Date.now() - entry.at > 3600000) {
    if (!pending.has(key)) pending.set(key, loadRows(league, fetchImpl).then(data => {
      const value = { ...data, at: Date.now() }; cache.set(key, value); return value;
    }).finally(() => pending.delete(key)));
    entry = await pending.get(key);
  }
  return { results: calculateAverages(LEAGUES[key], request, entry.rows), source: entry.source,
    partial: entry.partial, fetchedAt: entry.fetchedAt };
}
