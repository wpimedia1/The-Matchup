export const ORIGIN = 'https://the-matchup.app';
export const PAGES = {
  home: { path: '/', title: 'NBA, NFL & MMA Odds and Matchups — The Matchup',
    heading: 'NBA, NFL & MMA Matchups and Odds',
    description: 'Compare NBA and NFL game lines, player props and recent averages, plus MMA fight winners, round totals and bookmaker odds.',
    intro: 'Explore NBA and NFL lines, player props and recent form, or compare MMA fight winners and round totals across bookmakers.' },
  mma: { path: '/mma/', title: 'MMA Fight Odds, Winners & Round Totals — The Matchup',
    heading: 'MMA Fight Odds and Round Totals',
    description: 'Compare MMA fight winner odds, round totals, handicaps and exchange lay prices across bookmakers. Explore each available line for upcoming fights.',
    intro: 'Compare mixed martial arts matchups by fighter, bookmaker and round line. Choose a region and load the fight board to see current odds.' },
  nba: { path: '/nba/', title: 'NBA Odds & Player Props — The Matchup',
    heading: 'NBA Matchups, Odds and Player Props',
    description: 'Compare NBA moneylines, spreads, totals and player props with The Matchup. Review points, rebounds, assists and last-10 averages alongside each line.',
    intro: 'Explore NBA moneylines, spreads and totals, then compare player points, rebounds, assists and more at the same exact line. Review last-10 averages from SportsDataverse / hoopR, with game counts and source dates.' },
  nfl: { path: '/nfl/', title: 'NFL Odds & Player Props — The Matchup',
    heading: 'NFL Matchups, Odds and Player Props',
    description: 'Compare NFL game lines and passing, rushing and receiving props with The Matchup. Explore recent regular-season averages and exact-line bookmaker prices.',
    intro: 'Explore NFL moneylines, spreads and totals alongside passing, rushing, receiving and touchdown props. Compare exact-line prices and recent regular-season averages from nflverse, with game counts and source dates.' },
};
export function structuredData(key) {
  const p = PAGES[key];
  const website = { '@type': 'WebSite', '@id': `${ORIGIN}/#website`, url: `${ORIGIN}/`, name: 'The Matchup', inLanguage: 'en' };
  const graph = [{ '@type': 'WebPage', '@id': `${ORIGIN}${p.path}#webpage`, url: ORIGIN + p.path,
    name: p.title, description: p.description, inLanguage: 'en', isPartOf: { '@id': website['@id'] } }];
  if (key === 'home') graph.unshift(website);
  else {
    graph[0].breadcrumb = { '@id': `${ORIGIN}${p.path}#breadcrumb` };
    graph.push({ '@type': 'BreadcrumbList', '@id': `${ORIGIN}${p.path}#breadcrumb`, itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'The Matchup', item: `${ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: key.toUpperCase(), item: ORIGIN + p.path },
    ] });
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
}
export function updatePageMetadata(key) {
  const p = PAGES[key];
  document.title = p.title;
  document.querySelector('meta[name="description"]').content = p.description;
  document.querySelector('link[rel="canonical"]').href = ORIGIN + p.path;
  for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) document.querySelector(selector).content = p.title;
  for (const selector of ['meta[property="og:description"]', 'meta[name="twitter:description"]']) document.querySelector(selector).content = p.description;
  document.querySelector('meta[property="og:url"]').content = ORIGIN + p.path;
  document.getElementById('page-schema').textContent = structuredData(key);
  document.getElementById('page-title').textContent = p.heading;
  document.getElementById('page-intro').textContent = p.intro;
  document.getElementById('breadcrumb-league').textContent = key.toUpperCase();
  document.body.dataset.league = key;
}
