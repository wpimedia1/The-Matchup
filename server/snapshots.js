import { calculateAverages, normalize } from './stats.js';

const nameOf = row => row.athlete_display_name || row.player_display_name || row.player_name || row.athlete_name || '';
const idOf = row => String(row.athlete_id || row.player_id || normalize(nameOf(row)));
function teamOf(row, league) {
  const team = String(row.team_abbreviation || row.team || row.recent_team || '').toUpperCase();
  const aliases = league.id === 'nfl' ? { LA: 'LAR', JAC: 'JAX' } : { GSW: 'GS', NYK: 'NY', SAS: 'SA', NOP: 'NO', UTA: 'UTAH', WAS: 'WSH', BRK: 'BKN' };
  return aliases[team] || team;
}
export function createSnapshots(league, data, now = new Date()) {
  if (data.partial) throw new Error('Incomplete statistics download; retain the last complete snapshot.');
  const groups = new Map(), teams = new Set(Object.values(league.teams));
  for (const row of data.rows) {
    if (!nameOf(row)) continue;
    const id = idOf(row); if (!groups.has(id)) groups.set(id, []); groups.get(id).push(row);
  }
  const snapshots = new Map([...teams].map(team => [team, { schema: 1, league: league.id, team,
    source: data.source, fetchedAt: data.fetchedAt, generatedAt: now.toISOString(), players: [] }]));
  for (const [id, rows] of groups) {
    const aliases = [...new Set(rows.map(nameOf))], player = aliases[0];
    // Normalize historic display-name variants so one player's games stay together.
    const normalizedRows = rows.map(row => ({ ...row, athlete_display_name: player }));
    const result = calculateAverages(league, { players: [player], markets: league.markets.map(([key]) => key),
      teams: [Object.keys(league.teams)[0], Object.keys(league.teams)[1]], before: now.toISOString() }, normalizedRows)[0];
    if (!Object.keys(result.values).length) continue;
    const playerTeams = [...new Set(rows.map(row => teamOf(row, league)))].filter(team => teams.has(team));
    const record = { ...result, id, aliases, teams: playerTeams };
    // Include full form across trades in every relevant team snapshot.
    for (const team of playerTeams) snapshots.get(team).players.push(record);
  }
  return snapshots;
}

export function resolveSnapshotAverages(league, request, snapshots, now = Date.now()) {
  const teams = request.teams.map(team => league.teams[team]);
  for (const snapshot of snapshots) {
    const age = now - Date.parse(snapshot.generatedAt);
    if (snapshot.schema !== 1 || snapshot.league !== league.id || !teams.includes(snapshot.team) || !Array.isArray(snapshot.players) ||
        !Number.isFinite(age) || age < -300000 || age > 48 * 3600000) throw new Error('Statistics snapshot is invalid or expired.');
  }
  const people = [...new Map(snapshots.flatMap(snapshot => snapshot.players).map(person => [person.id, person])).values()];
  const cutoff = Math.min(Date.parse(request.before), now);
  const results = request.players.map(player => {
    const wanted = normalize(player), parts = wanted.split(' '), initial = parts[0]?.[0], surname = parts.slice(1).join(' ');
    let candidates = people.filter(person => person.aliases.some(alias => normalize(alias) === wanted));
    if (!candidates.length && surname) candidates = people.filter(person => person.teams.some(team => teams.includes(team)) &&
      person.aliases.some(alias => { const name = normalize(alias); return name.startsWith(initial) && name.endsWith(` ${surname}`); }));
    if (candidates.length !== 1) return { player, values: {}, reason: candidates.length ? 'Ambiguous player match' : 'No matching game logs' };
    const person = candidates[0];
    // Never return a precomputed average that includes a game after the requested cutoff.
    if (Date.parse(person.latestGame) >= cutoff) return { player, values: {}, reason: 'Snapshot cannot represent this earlier game date' };
    return { player, values: Object.fromEntries(Object.entries(person.values).filter(([market]) => request.markets.includes(market))),
      latestGame: person.latestGame, oldestGame: person.oldestGame };
  });
  return { results, source: snapshots[0].source, partial: false,
    fetchedAt: snapshots.map(s => s.fetchedAt).sort()[0] };
}
