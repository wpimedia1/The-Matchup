import { TEAMS, PLAYERS } from './identities.js';
import { bestQuote, price } from './domain.js';
const $ = id => document.getElementById(id);
const node = (tag, className, text) => { const n = document.createElement(tag); if (className) n.className = className; if (text !== undefined) n.textContent = text; return n; };
const time = iso => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
const date = iso => new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
const dayKey = iso => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export function image(src, alt, className = '') { const img = node('img', className); img.src = src; img.alt = alt; img.addEventListener('error', () => { img.hidden = true; }); return img; }
export function identity(name) { return TEAMS[name] || { name, city: '', abbr: name.slice(0, 3), color: '#173a64' }; }
export function playerIdentity(name) {
  const aliases = { 'J. Allen': 'Josh Allen', 'P. Mahomes': 'Patrick Mahomes', 'J. Cook': 'James Cook', 'T. Kelce': 'Travis Kelce' };
  return PLAYERS[aliases[name] || name] || { name: aliases[name] || name };
}
export function renderScoreboard(s, select, sample) {
  const query = $('team-search').value.trim().toLowerCase(), day = $('date-filter').value;
  const events = s.events.filter(game => (!query || `${game.away_team} ${game.home_team}`.toLowerCase().includes(query)) && (day === 'all' || dayKey(game.commence_time) === day))
    .sort((a, b) => Date.parse(a.commence_time) - Date.parse(b.commence_time));
  $('game-count').textContent = `${s.sample ? 'SAMPLE · ' : ''}${events.length} GAMES`;
  const host = $('games'); host.replaceChildren(); host.setAttribute('aria-busy', String(s.loading));
  if (!events.length) {
    const empty = node('div', 'empty-state'); empty.append(node('h3', '', s.loading ? 'LOADING MATCHUPS' : 'NO MATCHUPS FOUND'), node('p', '', query || day !== 'all' ? 'Try another team or date.' : 'Load the schedule or explore sample matchups.'));
    const button = node('button', 'text-button', query || day !== 'all' ? 'Clear filters' : 'Sample matchups');
    button.addEventListener('click', () => { if (query || day !== 'all') { $('team-search').value = ''; $('date-filter').value = 'all'; renderScoreboard(s, select, sample); } else sample(); });
    empty.append(button); host.append(empty); return;
  }
  for (const game of events) {
    const card = node('button', `game${game.id === s.selected ? ' selected' : ''}`);
    card.setAttribute('aria-label', `Explore ${game.away_team} at ${game.home_team}`); card.setAttribute('aria-pressed', String(game.id === s.selected));
    card.append(node('span', 'game-date', `${date(game.commence_time)} · ${time(game.commence_time)}`));
    for (const team of [game.away_team, game.home_team]) {
      const info = identity(team), quote = bestQuote(game.bookmakers, 'spreads', team);
      const row = node('span', 'rail-team'); if (info.logo) row.append(image(info.logo, ''));
      row.append(node('span', '', info.abbr), node('span', '', quote ? price(quote.point) : '—'));
      if (quote) row.title = `Spread ${price(quote.point)} · ${price(quote.price)} · ${quote.book}`;
      card.append(row);
    }
    card.addEventListener('click', () => select(game.id)); host.append(card);
  }
}
export function renderMatchup(s) {
  const game = s.events.find(item => item.id === s.selected), host = $('selected-matchup'); host.replaceChildren();
  $('stadium-image').src = `/assets/stadium-${s.config.id}.webp`;
  $('league-logo').src = `/assets/${s.config.id}.png`; $('league-logo').alt = s.config.label;
  if (!game) {
    const a = node('div', 'hero-team empty'), b = node('div', 'hero-team empty'), center = node('div', 'hero-center');
    a.append(image(`/assets/${s.config.id}.png`, s.config.label)); b.append(node('p', 'team-name', 'YOUR GAME. YOUR ANGLE.'));
    center.append(node('span', 'fixture-label', `${s.config.label} MATCHUP CENTER`), node('h2', 'matchup-title', 'PICK A MATCHUP'), node('p', 'match-state', 'FROM THE SCOREBOARD ABOVE'));
    host.append(a, center, b); $('props-matchup').textContent = 'Select a matchup'; $('props-description').textContent = 'Select a matchup and load props.';
    renderLines(s, null); return;
  }
  for (const [name, side] of [[game.away_team, 'away'], [game.home_team, 'home']]) {
    const info = identity(name), panel = node('div', `hero-team ${side}`);
    panel.style.setProperty('--team-color', info.color);
    // Ensure readable type even for teams with gold/yellow as their primary color.
    const rgb = info.color.match(/[a-f\d]{2}/gi)?.map(v => parseInt(v, 16)) || [0,0,0];
    if (rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 > 165) panel.classList.add('dark-ink');
    if (info.logo) panel.append(image(info.logo, `${name} logo`));
    const heading = node('p', 'team-name'); heading.append(node('span', '', info.city), node('span', '', info.name)); panel.append(heading);
    if (info.city.length > 10) heading.classList.add('long-city');
    if (info.name.length > 8) heading.classList.add('long-name');
    if (side === 'away') {
      const center = node('div', 'hero-center');
      center.append(node('p', 'fixture-label', `${s.config.label} · ${date(game.commence_time)}${s.sample ? ' · SAMPLE DATA' : ''}`),
        node('h2', 'matchup-title', `${identity(game.away_team).name} AT ${identity(game.home_team).name}`), node('p', 'kickoff', time(game.commence_time)),
        node('p', 'match-state', s.sample ? 'SAMPLE MATCHUP' : 'MATCHUP PREVIEW'));
      host.append(panel, center);
      if (`${identity(game.away_team).name} AT ${identity(game.home_team).name}`.length > 22) center.classList.add('long-fixture');
    } else host.append(panel);
  }
  $('props-matchup').textContent = `${game.away_team} at ${game.home_team}`;
  $('props-description').textContent = s.sample ? 'Sample prices and averages, not live data.' : 'Best prices are compared at each exact line.';
  renderLines(s, game);
}
function renderLines(s, game) {
  const table = node('table', 'lines-table'); const thead = node('thead'), header = node('tr');
  header.append(node('th', '', 'MARKET'));
  for (const [name, side] of [[game?.away_team, 'AWAY'], [game?.home_team, 'HOME']]) {
    const th = node('th', side === 'AWAY' ? 'side-away' : 'side-home', name ? identity(name).abbr : '—');
    th.scope = 'col'; th.append(node('small', '', `(${side})`)); header.append(th);
  }
  thead.append(header); const body = node('tbody');
  for (const [key, label] of [['h2h','MONEYLINE'], ['spreads','SPREAD'], ['totals','TOTAL']]) {
    const row = node('tr'); row.append(node('td', '', label));
    for (const [i, team] of [game?.away_team, game?.home_team].entries()) {
      const side = i === 0 ? 'Over' : 'Under', quote = game && bestQuote(game.bookmakers, key, key === 'totals' ? side : team);
      const td = node('td'); const number = quote ? key === 'h2h' ? price(quote.price) : key === 'spreads' ? price(quote.point) : `${i === 0 ? 'O' : 'U'} ${quote.point}` : '—';
      td.append(node('span', `line-number${key === 'totals' ? ' total' : ''}`, number));
      if (quote && key !== 'h2h') td.append(node('span', 'line-price', price(quote.price)));
      td.append(node('span', 'book-name', quote?.book || (game ? 'Load lines' : 'Select game')));
      row.append(td);
    }
    body.append(row);
  }
  table.append(thead, body); $('game-lines').replaceChildren(table);
}
