export function price(value) {
  return Number.isFinite(value) ? (value > 0 ? `+${value}` : String(value)) : '—';
}

export function quotes(books, market, name) {
  return (books || []).flatMap(book => (book.markets || [])
    .filter(item => item.key === market)
    .flatMap(item => (item.outcomes || [])
      .filter(outcome => outcome.name === name && Number.isFinite(outcome.price))
      .map(outcome => ({ ...outcome, book: book.title, updated: item.last_update || book.last_update }))));
}

// A quoted price is never detached from its point or bookmaker.
export function bestQuote(books, market, name) {
  return quotes(books, market, name).sort((a, b) => b.price - a.price)[0];
}

export function groupProps(data) {
  const groups = new Map();
  for (const book of data.bookmakers || []) for (const market of book.markets || []) {
    for (const outcome of market.outcomes || []) {
      if (!Number.isFinite(outcome.price)) continue;
      const player = outcome.description || outcome.name;
      const key = JSON.stringify([market.key, player, outcome.name, outcome.point ?? null]);
      if (!groups.has(key)) groups.set(key, {
        market: market.key, player, side: outcome.name, point: outcome.point ?? null, quotes: [],
      });
      groups.get(key).quotes.push({ price: outcome.price, book: book.title,
        updated: market.last_update || book.last_update });
    }
  }
  return [...groups.values()].map(group => ({ ...group,
    quotes: group.quotes.sort((a, b) => b.price - a.price),
  })).sort((a, b) => a.player.localeCompare(b.player) || a.market.localeCompare(b.market) ||
    (a.point ?? 0) - (b.point ?? 0) || a.side.localeCompare(b.side));
}
