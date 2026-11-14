import { price, bestQuote, quotes } from './domain.js';

export const fightMarkets = {
  h2h: 'Fight winner',
  h2h_3_way: 'Three-way result',
  double_chance: 'Double chance',
  totals: 'Total rounds',
  alternate_totals: 'Alternate total rounds',
  spreads: 'Fighter handicap',
  h2h_lay: 'Exchange lay odds',
};

export const sections = [
  ['Winner', ['h2h', 'h2h_3_way', 'double_chance']],
  ['Rounds', ['totals', 'alternate_totals']],
  ['Handicap', ['spreads']],
  ['Exchange', ['h2h_lay']],
];

export const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function localTime(iso) {
  if (!iso || !Number.isFinite(Date.parse(iso))) return '';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
}

// Each group belongs to one event, one market, one outcome and one exact line.
export function marketRows(books, key) {
  const outcomes = new Set();
  for (const book of books || []) {
    for (const market of book.markets || []) {
      if (market.key === key) for (const outcome of market.outcomes || []) outcomes.add(outcome.name);
    }
  }
  const rows = [];
  for (const name of outcomes) {
    const lines = new Map();
    for (const quote of quotes(books, key, name)) {
      const point = quote.point ?? null;
      if (['totals', 'alternate_totals', 'spreads'].includes(key) && !Number.isFinite(point)) continue;
      if (!lines.has(point)) lines.set(point, []);
      lines.get(point).push(quote);
    }
    for (const [point, offers] of lines) {
      // American prices increase with payout. A layer prefers the lower liability.
      offers.sort((a, b) => key === 'h2h_lay' ? a.price - b.price : b.price - a.price);
      rows.push({ name, point, offers });
    }
  }
  return rows.sort((a, b) => a.point - b.point || a.name.localeCompare(b.name));
}

function offerCell(row) {
  if (!row) return '<span aria-label="No quote">—</span>';
  const best = row.offers[0];
  const listings = row.offers.map(q => {
    const updated = localTime(q.updated);
    return `<li>${escapeHtml(q.book)} · ${price(q.price)}${updated ? ' · ' + escapeHtml(updated) : ''}</li>`;
  }).join('');
  return `<details><summary><strong>${price(best.price)}</strong> <span>${escapeHtml(best.book)}</span></summary><ul>${listings}</ul></details>`;
}

function table(key, rows) {
  const rounds = key === 'totals' || key === 'alternate_totals';
  const heads = rounds ? ['Rounds', 'Over', 'Under'] : ['Outcome', key === 'h2h_lay' ? 'Best lay price / exchange' : 'Best price / book'];
  const body = rounds ? [...new Set(rows.map(r => r.point))].map(point => {
    const at = side => rows.find(r => r.point === point && r.name === side);
    return `<tr><th scope="row">${point}</th><td>${offerCell(at('Over'))}</td><td>${offerCell(at('Under'))}</td></tr>`;
  }) : rows.map(row => {
    const line = key === 'spreads' ? ' ' + price(row.point) : '';
    return `<tr><th scope="row">${escapeHtml(row.name)}${line}</th><td>${offerCell(row)}</td></tr>`;
  });
  return `<table><caption>${fightMarkets[key]}</caption><thead><tr>${heads.map(h => '<th scope="col">' + h + '</th>').join('')}</tr></thead><tbody>${body.join('')}</tbody></table>`;
}

export function marketTables(fight, full = true) {
  return sections.map(([label, keys]) => {
    const tables = keys.flatMap(key => {
      const rows = marketRows(fight?.bookmakers, key);
      return rows.length ? [table(key, rows)] : [];
    });
    if (!full && label !== 'Winner') return '';
    return `<section class="fight-market"><h3>${label}</h3>${label === 'Exchange' && tables.length ? '<p>Lay means betting against the named fighter. A lower lay price means less liability for the same backer stake.</p>' : ''}${tables.join('') || '<p>No prices listed for this market group.</p>'}</section>`;
  }).join('');
}

export function fighterPanel(fight) {
  return [fight.away_team, fight.home_team].map(name => {
    const q = bestQuote(fight.bookmakers, 'h2h', name);
    return `<div><strong>${escapeHtml(name)}</strong><span>${q ? price(q.price) + ' · ' + escapeHtml(q.book) : 'Winner price unavailable'}</span></div>`;
  }).join('<b aria-hidden="true">VS</b>');
}

const names = ['Alex Rivera', 'Jordan Ellis'];
const [a, b] = names;
const outcome = (name, price, point) => ({ name, price, point });
const market = (key, ...outcomes) => ({ key, outcomes });
export const sampleFight = {
  id: 'sample', away_team: a, home_team: b, bookmakers: [
    { title: 'Sample Book A', markets: [
      market('h2h', outcome(a, -135), outcome(b, 115)),
      market('h2h_3_way', outcome(a, -125), outcome(b, 120), outcome('Draw', 3500)),
      market('double_chance', outcome(a + ' or Draw', -145), outcome(b + ' or Draw', 105), outcome(a + ' or ' + b, -5000)),
      market('totals', outcome('Over', -120, 2.5), outcome('Under', 100, 2.5)),
      market('alternate_totals', outcome('Over', -185, 1.5), outcome('Under', 150, 1.5)),
      market('spreads', outcome(a, -105, -3.5), outcome(b, -115, 3.5)),
    ] },
    { title: 'Sample Book B', markets: [market('h2h', outcome(a, -130), outcome(b, 110))] },
    { title: 'Sample Exchange', markets: [market('h2h_lay', outcome(a, -120), outcome(b, 125))] },
  ],
};
