export const ORIGIN = 'https://the-matchup.app';
export const PAGES = {
  home: { path: '/', title: 'The Matchup — NBA & NFL Odds and Player Props',
    heading: 'NBA & NFL Matchups, Odds and Player Props',
    description: 'Explore NBA and NFL matchups with The Matchup. Compare game lines and player props at matching lines, then review recent player averages.',
    intro: 'Know the matchup. Find your angle. Compare game lines and player props, explore recent form, and keep the numbers in perspective.' },
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
