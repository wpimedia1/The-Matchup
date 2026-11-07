import { LEAGUES } from './leagues.js';
import { groupProps, price } from './domain.js';
import { sampleEvents, sampleProps, SAMPLE_AVERAGES } from './sample.js';
import { renderScoreboard, renderMatchup, playerIdentity, image } from './matchup.js';

const $ = id => document.getElementById(id);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const dateTime = value => new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const dateLabel = value => new Date(value).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
const dayKey = value => { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const states = Object.fromEntries(Object.entries(LEAGUES).map(([key, config]) => [key, {
  config, events: [], selected: null, rows: [], sample: false, loaded: false, region: 'us', updated: null,
  markets: config.markets.slice(0, 3).map(([market]) => market), playerSearch: '', side: 'Over', expandedMarkets: false, request: 0, propRequest: 0,
  loading: false, propsLoading: false, avgsLoading: false, status: '', error: false, propStatus: '', propError: false,
}]));
let active = states.nfl, used = 0, storage = {}, storageWarning = false;
try { storage = JSON.parse(localStorage.getItem('aao_combined_averages') || '{}'); if (!storage || typeof storage !== 'object' || Array.isArray(storage)) storage = {}; } catch { storage = {}; }

function saveStorage() {
  try { localStorage.setItem('aao_combined_averages', JSON.stringify(storage)); }
  catch { storageWarning = true; }
}
function avgKey(state, market, player) { return JSON.stringify([state.sample ? 'sample' : 'live', state.config.id, state.selected, market, player]); }
function getAverage(state, row) {
  const key = avgKey(state, row.market, row.player);
  if (Object.hasOwn(storage, key)) return storage[key];
  // Import old manual values when the original pages used this same browser origin.
  if (!state.sample) try {
    const legacy = JSON.parse(localStorage.getItem(state.config.id === 'nba' ? 'aao_avgs_nba' : 'aao_avgs') || '{}');
    const value = legacy?.[`${state.selected}|${row.market}|${row.player}`];
    if (value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0) {
      return storage[key] = { value: String(value), source: 'Manual entry' };
    }
  } catch { /* Old storage may be unavailable or malformed. */ }
  const demo = state.sample && SAMPLE_AVERAGES[row.player]?.[row.market];
  return demo !== false && demo !== undefined ? { value: String(demo), source: 'Sample average' } : null;
}
function setStatus(id, message, error = false) {
  $(id).textContent = message;
  $(id).classList.toggle('error', error);
}
function renderQuota() {
  const quota = Math.max(1, Number.parseInt($('quota').value, 10) || 500);
  $('used').textContent = used;
  $('remaining').textContent = quota - used;
}
async function api(path, options = {}) {
  let response;
  try { response = await fetch(path, { ...options, signal: AbortSignal.timeout(120000) }); }
  catch { throw new Error('The server could not be reached. Please try again.'); }
  const result = await response.json().catch(() => ({ error: 'The server returned an unexpected response.' }));
  if (!response.ok) throw new Error(result.error || 'Data could not be loaded.');
  used += Math.max(0, result.usage?.last || 0); renderQuota();
  return result;
}
function selectedGame(state = active) { return state.events.find(game => game.id === state.selected); }
function resetDetail(state) {
  state.selected = null; state.rows = []; state.playerSearch = ''; state.side = 'Over'; state.expandedMarkets = false; state.propStatus = ''; state.propError = false;
  state.propRequest++; state.propsLoading = false; state.avgsLoading = false;
}
function leagueSwitch(key) {
  active = states[key];
  $('team-search').value = ''; $('region').value = active.region;
  for (const tab of document.querySelectorAll('[data-league]')) {
    const selected = tab.dataset.league === key;
    tab.classList.toggle('active', selected); tab.setAttribute('aria-pressed', String(selected));
  }
  document.title = `Against All Odds — ${active.config.label} Matchup Center`;
  $('league-kicker').textContent = `${active.config.label} MATCHUP CENTER`;
  if (!active.loaded) { loadSample(); return; }
  renderDates(); renderAll();
}
function renderDates() {
  const old = $('date-filter').value;
  $('date-filter').replaceChildren(new Option('All dates', 'all'));
  const dates = new Map(active.events.map(game => [dayKey(game.commence_time), game.commence_time]));
  for (const [key, date] of [...dates].sort((a, b) => a[0].localeCompare(b[0]))) $('date-filter').add(new Option(dateLabel(date), key));
  $('date-filter').value = dates.has(old) ? old : 'all';
}
function renderAll() {
  const s = active;
  $('mode-label').classList.toggle('sample', s.sample);
  $('mode-label').textContent = s.sample ? 'SAMPLE DATA · NOT LIVE ODDS' : s.loaded ? 'LIVE DATA · ON DEMAND' : 'LIVE DATA · READY TO LOAD';
  $('load-events').disabled = s.loading;
  $('load-odds').disabled = s.loading;
  $('board-updated').textContent = s.updated ? `Loaded ${new Date(s.updated).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · Local time` : 'Times in your timezone';
  setStatus('board-status', s.status || 'Choose a schedule to get started. Load lines when you want to compare the books.', s.error);
  renderGames(); renderSelected(); renderMarkets(); renderProps();
}
function renderGames() { renderScoreboard(active, selectGame, loadSample); }
function selectGame(id) {
  if (active.selected === id) { $('props-section').scrollIntoView({ behavior: 'smooth' }); return; }
  resetDetail(active); active.selected = id;
  active.markets = active.config.markets.slice(0, 3).map(([market]) => market);
  active.propStatus = 'Choose your markets, then load props.';
  if (active.sample) active.rows = groupProps(sampleProps(active.config.id, selectedGame(), active.markets));
  renderGames(); renderSelected(); renderMarkets(); renderProps();
}
function renderSelected() { renderMatchup(active); }
function renderMarkets() {
  const s = active, host = $('markets'); host.replaceChildren();
  $('market-controls').disabled = !s.selected || s.propsLoading;
  for (const [key, label] of s.config.markets.filter(([key], index) => s.expandedMarkets || index < 3 || s.markets.includes(key))) {
    const pill = el('label', 'market-pill'), input = el('input'); input.type = 'checkbox'; input.value = key; input.checked = s.markets.includes(key);
    input.addEventListener('change', () => {
      s.markets = input.checked ? [...new Set([...s.markets, key])] : s.markets.filter(market => market !== key);
      updatePropButtons();
    });
    pill.append(input, document.createTextNode(label)); host.append(pill);
  }
  const more = el('button', 'market-more', s.expandedMarkets ? 'Fewer markets' : 'More markets');
  more.type = 'button'; more.setAttribute('aria-expanded', String(s.expandedMarkets));
  more.addEventListener('click', () => { s.expandedMarkets = !s.expandedMarkets; renderMarkets(); }); host.append(more);
  updatePropButtons();
}
function updatePropButtons() {
  const s = active;
  $('load-props').disabled = !s.selected || !s.markets.length || s.propsLoading;
  $('load-props').textContent = s.propsLoading ? 'Loading props…' : 'Load props';
  $('load-props').title = s.sample ? 'Load sample props' : `Up to ${s.markets.length} credits · 1 region`;
  $('load-averages').disabled = !s.rows.length || s.avgsLoading || s.propsLoading;
  $('load-averages').textContent = s.avgsLoading ? 'Computing averages…' : 'Compute averages';
  $('load-averages').title = 'Compute last-10 averages · Free';
  $('market-cost').textContent = s.sample ? 'Sample mode uses no API credits' : `${s.markets.length} market${s.markets.length === 1 ? '' : 's'} × 1 region`;
}
function averageNote(saved) {
  if (!saved || saved.value === '') return 'Manual entry available';
  if (saved.source === 'Manual entry') return 'Manual · saved in this browser';
  if (saved.source === 'Sample average') return 'Illustrative average';
  return `${saved.games} game${saved.games === 1 ? '' : 's'} · through ${dateLabel(saved.latestGame)}${saved.stale ? ' · older data' : ''}`;
}
function updateComparison(cell, row, saved) {
  cell.replaceChildren();
  const n = saved?.value !== '' && saved?.value != null ? Number(saved.value) : NaN;
  if (!Number.isFinite(n) || row.point === null || !['Over', 'Under'].includes(row.side)) { cell.textContent = '—'; return; }
  const diff = n - row.point;
  cell.append(el('span', `comparison ${diff > 0 ? 'positive' : diff < 0 ? 'negative' : ''}`, `${diff > 0 ? '+' : ''}${diff.toFixed(1)} vs line`));
  cell.title = diff === 0 ? 'Average at the line' : diff > 0 ? 'Average above line' : 'Average below line';
}
function renderProps() {
  const s = active, host = $('prop-results'); host.replaceChildren();
  setStatus('props-status', s.propStatus || 'The selected game’s player props will appear here.', s.propError);
  $('prop-search-label').hidden = !s.rows.length;
  $('prop-side-label').hidden = !s.rows.length;
  $('prop-side').value = s.side;
  $('player-search').value = s.playerSearch;
  const filtered = s.rows.filter(row => playerIdentity(row.player).name.toLowerCase().includes(s.playerSearch.trim().toLowerCase()) && (s.side === 'all' || row.side === s.side || row.side === (s.side === 'Over' ? 'Yes' : 'No')));
  if (!s.rows.length) { const empty = el('div', 'props-empty'); empty.append(el('h3', '', s.propsLoading ? 'LOADING PLAYER PROPS' : 'FIND YOUR ANGLE'), el('p', '', s.selected ? 'Choose your markets and load props to compare player lines and recent form.' : 'Select a matchup from the scoreboard to explore player props.')); host.append(empty); }
  if (s.rows.length && !filtered.length) host.append(el('p', 'status', 'No players match this search. Clear the search to see all props.'));
  if (filtered.length) {
    const order = s.config.markets.map(([key]) => key);
    if (s.config.id === 'nfl') [order[1], order[2]] = [order[2], order[1]];
    const rows = [...filtered].sort((a, b) => order.indexOf(a.market) - order.indexOf(b.market) || a.player.localeCompare(b.player));
    const section = el('section', 'prop-market');
    const wrapper = el('div', 'table-wrap'); wrapper.tabIndex = 0; wrapper.setAttribute('aria-label', 'Player props table; scroll horizontally on smaller screens');
    const table = el('table', 'props-table'), thead = el('thead'), tr = el('tr');
    for (const label of ['PLAYER', 'SIDE', 'LINE', 'BEST PRICE / BOOK', 'LAST-10 AVG']) { const th = el('th', '', label); th.scope = 'col'; tr.append(th); }
    thead.append(tr); const tbody = el('tbody');
    for (const row of rows) {
      const title = s.config.markets.find(([key]) => key === row.market)?.[1] || row.market;
      const line = el('tr'), best = row.quotes[0];
      const person = playerIdentity(row.player), player = el('td'), identity = el('div', 'player-name'), name = el('div');
      if (person.photo) identity.append(image(person.photo, '', 'player-photo'));
      name.append(el('span', 'name', person.name));
      name.append(el('span', 'player-meta', [s.sample ? person.team : '', person.position, title].filter(Boolean).join(' · ')));
      identity.append(name); player.append(identity);
      line.append(player, el('td', 'side-cell', row.side), el('td', 'prop-line', row.point ?? '—'));
      const offer = el('td'), details = el('details', 'book-details'), summary = el('summary', '', price(best.price)), list = el('ul');
      summary.append(el('span', 'book-name', best.book));
      for (const quote of row.quotes) list.append(el('li', '', `${quote.book}: ${price(quote.price)}${quote.updated ? ` · ${dateTime(quote.updated)}` : ''}`));
      details.append(summary, list); offer.append(details); line.append(offer);
      const avg = el('td'), input = el('input', 'avg-input'); input.type = 'number'; input.min = '0'; input.step = '0.1'; input.placeholder = '—';
      input.setAttribute('aria-label', `${row.player} ${title} average`);
      const keyValue = avgKey(s, row.market, row.player), saved = getAverage(s, row);
      input.dataset.averageKey = keyValue; input.value = saved?.value ?? '';
      const note = el('span', 'cell-note', averageNote(saved)); note.dataset.noteKey = keyValue;
      const comparison = el('div'); comparison.dataset.comparisonKey = keyValue; comparison.dataset.point = row.point ?? ''; comparison.dataset.side = row.side;
      updateComparison(comparison, row, saved);
      input.addEventListener('input', () => {
        if (input.value !== '' && (!Number.isFinite(Number(input.value)) || Number(input.value) < 0)) { input.setCustomValidity('Enter a non-negative average.'); return; }
        input.setCustomValidity('');
        storage[keyValue] = { value: input.value, source: 'Manual entry' }; saveStorage();
        for (const other of host.querySelectorAll('[data-average-key]')) if (other.dataset.averageKey === keyValue && other !== input) other.value = input.value;
        for (const other of host.querySelectorAll('[data-note-key]')) if (other.dataset.noteKey === keyValue) other.textContent = averageNote(storage[keyValue]);
        for (const other of host.querySelectorAll('[data-comparison-key]')) if (other.dataset.comparisonKey === keyValue) updateComparison(other, { point: other.dataset.point === '' ? null : Number(other.dataset.point), side: other.dataset.side }, storage[keyValue]);
        if (storageWarning) setStatus('props-status', 'This browser blocked saving. Your averages remain available until this page closes.', true);
      });
      avg.append(input, note, comparison); line.append(avg); tbody.append(line);
    }
    table.append(thead, tbody); wrapper.append(table); section.append(wrapper); host.append(section);
  }
  updatePropButtons();
}
async function loadSchedule(withOdds) {
  const s = active, ticket = ++s.request, region = s.region;
  s.loading = true; s.error = false; s.status = withOdds ? 'Loading schedule + lines (3 markets × 1 region)…' : 'Loading the upcoming schedule…';
  renderAll();
  try {
    const result = await api(`/api/${s.config.id}/${withOdds ? `odds?region=${region}` : 'events'}`);
    if (ticket !== s.request) return;
    s.events = result.data; s.sample = false; s.loaded = true; s.updated = result.fetchedAt; resetDetail(s);
    s.selected = [...s.events].sort((a, b) => Date.parse(a.commence_time) - Date.parse(b.commence_time))[0]?.id || null;
    s.status = `${s.events.length} matchup${s.events.length === 1 ? '' : 's'} loaded${withOdds ? ' with lines' : ' · schedule only'}. Select a game to explore props.`;
  } catch (error) { if (ticket === s.request) { s.status = `${error.message}${s.events.length ? ' The previous board is still displayed.' : ''}`; s.error = true; } }
  finally { if (ticket === s.request) { s.loading = false; if (active === s) { renderDates(); renderAll(); } } }
}
function loadSample() {
  const s = active; s.request++; s.loading = false; s.sample = true; s.events = sampleEvents(s.config.id); s.loaded = true; s.updated = new Date().toISOString(); resetDetail(s);
  s.selected = 's1'; s.markets = s.config.markets.slice(0, 3).map(([market]) => market);
  s.rows = groupProps(sampleProps(s.config.id, selectedGame(s), s.markets));
  s.error = false; s.status = 'Illustrative prices, rosters, and averages. Load schedule + lines for current data.';
  s.propStatus = 'Sample props · prices are compared at the same exact line. Averages can be edited.';
  $('team-search').value = ''; renderDates(); renderAll();
}
async function loadProps() {
  const s = active, game = selectedGame(s); if (!game || !s.markets.length) return;
  const ticket = ++s.propRequest, markets = [...s.markets];
  s.propsLoading = true; s.avgsLoading = false; s.propError = false; s.propStatus = 'Loading player props…'; renderMarkets(); renderProps();
  try {
    let data;
    if (s.sample) {
      data = sampleProps(s.config.id, game, markets);
    } else data = (await api(`/api/${s.config.id}/events/${encodeURIComponent(game.id)}/props?region=${s.region}&markets=${markets.join(',')}`)).data;
    if (ticket !== s.propRequest) return;
    s.rows = groupProps(data);
    s.propStatus = s.rows.length ? `${new Set(s.rows.map(row => row.market)).size} market(s) returned. Best prices are compared only at the same line. Enter an average or compute recent form.` : 'No props returned for these markets. Try other markets or another matchup.';
  } catch (error) { if (ticket === s.propRequest) { s.propStatus = `${error.message}${s.rows.length ? ' Previously loaded props are still displayed.' : ''}`; s.propError = true; } }
  finally { if (ticket === s.propRequest) { s.propsLoading = false; if (active === s) { renderMarkets(); renderProps(); } } }
}
async function loadAverages() {
  const s = active, game = selectedGame(s), ticket = s.propRequest;
  if (!game || !s.rows.length || s.avgsLoading) return;
  if (s.sample) {
    s.propStatus = 'Sample props use historical illustrative rosters. Enter averages manually, or load a live matchup to compute real game-log averages.'; s.propError = false; renderProps(); return;
  }
  s.avgsLoading = true; s.propError = false; s.propStatus = 'Fetching recent game logs and computing averages. Existing entries will be kept.'; renderProps();
  try {
    const result = await api(`/api/${s.config.id}/averages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      players: [...new Set(s.rows.map(row => row.player))], markets: [...new Set(s.rows.map(row => row.market))], teams: [game.away_team, game.home_team], before: game.commence_time,
    }) });
    if (ticket !== s.propRequest) return;
    let filled = 0, older = false;
    for (const item of result.results) for (const [market, value] of Object.entries(item.values)) {
      const key = avgKey(s, market, item.player);
      if (storage[key]?.value !== undefined && storage[key].value !== '') continue;
      const stale = Date.now() - Date.parse(item.latestGame) > (s.config.id === 'nfl' ? 35 : 21) * 86400000;
      older ||= stale;
      storage[key] = { value: String(value.average), games: value.games, latestGame: item.latestGame, source: result.source, stale }; filled++;
    }
    saveStorage();
    s.propStatus = `${filled} player-market average(s) filled from ${result.source}. Existing values were preserved.${result.partial ? ' One season could not be downloaded; coverage is incomplete.' : ''}${older ? ' Some logs are older; check the dates shown.' : ''} Blanks can be entered manually.${storageWarning ? ' Browser storage is unavailable; entries will not persist.' : ''}`;
  } catch (error) { if (ticket === s.propRequest) { s.propStatus = `${error.message} You can enter averages manually.`; s.propError = true; } }
  finally { if (ticket === s.propRequest) { s.avgsLoading = false; if (active === s) renderProps(); } }
}

for (const tab of document.querySelectorAll('[data-league]')) tab.addEventListener('click', () => leagueSwitch(tab.dataset.league));
$('load-events').addEventListener('click', () => loadSchedule(false));
$('load-odds').addEventListener('click', () => loadSchedule(true));
$('sample-mode').addEventListener('click', loadSample);
$('load-props').addEventListener('click', loadProps);
$('load-averages').addEventListener('click', loadAverages);
$('quota').addEventListener('input', renderQuota);
$('team-search').addEventListener('input', renderGames);
$('date-filter').addEventListener('change', renderGames);
$('player-search').addEventListener('input', () => { active.playerSearch = $('player-search').value; renderProps(); });
$('prop-side').addEventListener('change', () => { active.side = $('prop-side').value; renderProps(); });
$('filters-toggle').addEventListener('click', () => { const open = $('board-filters').hidden; $('board-filters').hidden = !open; $('filters-toggle').setAttribute('aria-expanded', String(open)); if (open) $('team-search').focus(); });
$('player-filters-toggle').addEventListener('click', () => { const open = $('player-filters').hidden; $('player-filters').hidden = !open; $('player-filters-toggle').setAttribute('aria-expanded', String(open)); });
$('region').addEventListener('change', () => {
  active.region = $('region').value; active.request++; active.loading = false; resetDetail(active);
  if (!active.sample) { active.events = active.events.map(({ bookmakers, ...game }) => game); active.status = 'Region changed. Reload lines for this region, or select a matchup to load props.'; active.error = false; }
  renderAll();
});
$('edition-date').textContent = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
loadSample();
api('/api/health').then(result => {
  if (!result.configured && !active.loaded && !active.loading) setStatus('board-status', 'Live data is not configured on the server. Explore sample data while setup is completed.', true);
}).catch(() => { if (!active.loaded && !active.loading) setStatus('board-status', 'The server is unavailable. You can still explore sample data.', true); });
