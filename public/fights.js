import { fighterPanel, marketTables, sampleFight, localTime } from './fight-markets.js';
import { bestQuote, price } from './domain.js';

const byId = id => document.getElementById(id);
const region = byId('fight-region');
const select = byId('fight-select');
const details = byId('fight-detail');
const board = byId('fight-load');
const status = byId('fight-status');
const marketStatus = byId('market-status');
let fights = [];
let loaded = new Map();
let pending;

function cancel() {
  pending?.abort();
  pending = undefined;
  board.disabled = false;
  details.disabled = false;
}

async function fetchOdds(path, signal) {
  const response = await fetch(path + '?region=' + encodeURIComponent(region.value), { signal });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Prices could not be loaded.');
  return payload;
}

function display(fight, time, note, full = true) {
  byId('fight-title').textContent = fight.away_team + ' vs ' + fight.home_team;
  byId('fight-time').textContent = time;
  byId('fight-pair').innerHTML = fighterPanel(fight);
  byId('fight-tables').innerHTML = marketTables(fight, full);
  marketStatus.textContent = note;
}

function reset(message) {
  cancel();
  fights = [];
  loaded.clear();
  select.replaceChildren();
  byId('fight-select-label').hidden = true;
  details.hidden = true;
  status.textContent = message;
  display(sampleFight, 'Sample matchup', 'Sample markets · Expand a price to compare bookmakers.');
}

function selectFight() {
  cancel();
  const fight = fights.find(item => item.id === select.value);
  if (!fight) return;
  const full = loaded.get(fight.id);
  details.hidden = false;
  details.textContent = full ? 'Refresh fight markets' : 'Load all fight markets';
  const note = full ? 'Markets checked ' + localTime(full.fetchedAt) + ' · Expand prices for bookmakers.'
    : 'Board shows winner prices. Load all fight markets to see the available rounds, handicaps and exchange prices.';
  display(full?.data ?? fight, 'Scheduled · ' + localTime(fight.commence_time), note, Boolean(full));
}

function fightOption(fight) {
  const label = name => {
    const quote = bestQuote(fight.bookmakers, 'h2h', name);
    return quote ? name + ' (' + price(quote.price) + ')' : name;
  };
  return new Option(localTime(fight.commence_time) + ' · ' + label(fight.away_team) + ' vs ' + label(fight.home_team), fight.id);
}

board.addEventListener('click', async () => {
  cancel();
  const request = pending = new AbortController();
  board.disabled = true;
  details.disabled = true;
  status.textContent = 'Loading fight board…';
  try {
    const result = await fetchOdds('/api/mma/odds', request.signal);
    if (pending !== request) return;
    const previous = select.value;
    fights = result.data.slice().sort((a, b) => Date.parse(a.commence_time) - Date.parse(b.commence_time));
    if (!fights.length) {
      reset('No fights with winner odds in this region. Showing the sample fight.');
      return;
    }
    loaded.clear();
    select.replaceChildren(...fights.map(fightOption));
    if (fights.some(f => f.id === previous)) select.value = previous;
    byId('fight-select-label').hidden = false;
    status.textContent = fights.length + ' fights · Board updated ' + localTime(result.fetchedAt);
    selectFight();
  } catch (error) {
    if (pending === request) status.textContent = 'Board refresh failed. ' + error.message + (fights.length ? ' Showing the previous board.' : ' Showing sample odds.');
  } finally {
    if (pending === request) cancel();
  }
});

details.addEventListener('click', async () => {
  cancel();
  const request = pending = new AbortController();
  const id = select.value;
  details.disabled = true;
  marketStatus.textContent = 'Loading available fight markets…';
  try {
    const result = await fetchOdds('/api/mma/events/' + encodeURIComponent(id) + '/markets', request.signal);
    if (pending !== request) return;
    loaded.set(id, result);
    selectFight();
  } catch (error) {
    if (pending === request) marketStatus.textContent = 'Market refresh failed. ' + error.message + ' Previously displayed prices are retained.';
  } finally {
    if (pending === request) cancel();
  }
});

select.addEventListener('change', selectFight);
region.addEventListener('change', () => reset('Region changed. Load the fight board to see current prices. Showing sample odds.'));
byId('fight-sample').addEventListener('click', () => reset('Sample odds · Illustrative fighters and prices.'));
