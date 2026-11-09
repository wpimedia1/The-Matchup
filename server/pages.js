import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PAGES, ORIGIN, structuredData } from '../public/site.js';
import { SECURITY_HEADERS } from './api.js';

const template = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const hashes = Object.keys(PAGES).map(key => `'sha256-${createHash('sha256').update(structuredData(key)).digest('base64')}'`);
export const PAGE_HEADERS = { ...SECURITY_HEADERS,
  'Content-Security-Policy': SECURITY_HEADERS['Content-Security-Policy'].replace("script-src 'self'", `script-src 'self' ${hashes.join(' ')}`) };
const nav = key => `<nav class="league-nav" aria-label="Sport navigation"><div class="league-tabs"><a href="/nba/" data-league="nba"${key === 'nba' ? ' class="active" aria-current="page"' : ''}>NBA</a><a href="/nfl/" data-league="nfl"${key === 'nfl' ? ' class="active" aria-current="page"' : ''}>NFL</a></div>${key ? `<span id="league-kicker">${key.toUpperCase()} MATCHUP CENTER</span><button id="filters-toggle" class="nav-tool" aria-expanded="false" aria-controls="board-filters">Find a matchup</button>` : '<span>KNOW THE MATCHUP. OWN YOUR PERSPECTIVE.</span>'}</nav>`;
const footer = `<footer><strong>THE MATCHUP</strong><span>Know the matchup. Own your perspective.</span><nav aria-label="Footer"><a href="/">Home</a><a href="/nba/" data-league="nba">NBA</a><a href="/nfl/" data-league="nfl">NFL</a></nav></footer>`;
const header = `<header class="masthead"><a class="wordmark" href="/" aria-label="The Matchup home">THE MATCHUP</a><span class="masthead-title">GAME DAY MATCHUP CENTER</span></header>`;
function head(key) {
  const p = PAGES[key], missing = !p;
  const title = p?.title || 'Page Not Found — The Matchup', description = p?.description || 'This page could not be found. Explore NBA and NFL matchups with The Matchup.';
  return `<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title><meta name="description" content="${escape(description)}"><meta name="theme-color" content="#081b34">
<meta name="robots" content="${missing ? 'noindex, follow' : 'index, follow, max-image-preview:large'}">
${p ? `<link rel="canonical" href="${ORIGIN}${p.path}"><meta property="og:url" content="${ORIGIN}${p.path}">` : ''}
<meta property="og:type" content="website"><meta property="og:site_name" content="The Matchup"><meta property="og:locale" content="en_US">
<meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}">
<meta property="og:image" content="${ORIGIN}/assets/social-preview.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="The Matchup — NBA and NFL matchup analysis">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${ORIGIN}/assets/social-preview.png"><meta name="twitter:image:alt" content="The Matchup — NBA and NFL matchup analysis">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/assets/favicon.png" type="image/png" sizes="32x32"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" sizes="180x180">
<link rel="preload" href="/assets/barlowcondensed-extrabold.ttf" as="font" type="font/ttf" crossorigin>
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/site.css">
${p ? `<script type="application/ld+json" id="page-schema">${structuredData(key)}</script>` : ''}
${key === 'nba' || key === 'nfl' ? '<script type="module" src="/app.js"></script>' : ''}`;
}
export function renderPage(key) {
  if (key === 'nba' || key === 'nfl') {
    const p = PAGES[key];
    return template.replace(/<head>[\s\S]*?<\/head>/, `<head>${head(key)}</head>`)
      .replace('<body>', `<body data-league="${key}">`)
      .replace(/<nav class="league-nav"[\s\S]*?<\/nav>/, nav(key))
      .replace('<main id="main">', `<main id="main"><section class="page-intro"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">The Matchup</a><span aria-hidden="true">/</span><span id="breadcrumb-league" aria-current="page">${key.toUpperCase()}</span></nav><h1 id="page-title">${escape(p.heading)}</h1><p id="page-intro">${escape(p.intro)}</p></section>`)
      .replace('/assets/stadium-nfl.png', `/assets/stadium-${key}.png`)
      .replace('src="/assets/nfl.png" alt="NFL"', `src="/assets/${key}.png" alt="${key.toUpperCase()}"`)
      .replace(/<footer>[\s\S]*?<\/footer>/, footer);
  }
  const content = key === 'home' ? `<section class="home-intro"><p class="eyebrow">BASKETBALL. FOOTBALL. YOUR PERSPECTIVE.</p><h1>${escape(PAGES.home.heading)}</h1><p class="home-deck">${escape(PAGES.home.intro)}</p><a class="home-jump" href="#leagues">CHOOSE YOUR LEAGUE <span aria-hidden="true">↓</span></a></section>
<section id="leagues" class="league-cards" aria-label="Choose your league">${['nba', 'nfl'].map(key => `<a class="league-card ${key}" href="/${key}/"><img src="/assets/stadium-${key}.png" alt="" width="2172" height="724" loading="lazy" decoding="async"><div class="card-copy"><span class="eyebrow">${key === 'nba' ? 'ON THE COURT' : 'ON THE FIELD'}</span><h2>${key.toUpperCase()}</h2><p>${key === 'nba' ? 'Points. Rebounds. Assists. Every angle of the game.' : 'Passing. Rushing. Receiving. Get behind the numbers.'}</p><span class="card-cta">EXPLORE ${key.toUpperCase()} MATCHUPS <span aria-hidden="true">↗</span></span></div></a>`).join('')}</section>
<section class="home-method"><div><p class="eyebrow">THE NUMBERS BEHIND THE MATCHUP</p><h2>Compare the line.<br>Understand the form.</h2></div><div><h3>Prices that belong together</h3><p>Compare bookmaker prices for the same player, market, side and exact line. Load current schedules, game lines and props when you choose.</p><h3>Recent form, with context</h3><p>Explore last-10 player averages with available game counts and source dates, or enter your own averages. Past performance describes what happened; it does not predict the next game.</p><p class="source-note">Odds: The Odds API. NBA game logs: SportsDataverse / hoopR. NFL game logs: nflverse. Dashboards open with clearly labeled sample data; load current data explicitly.</p></div></section>`
    : `<section class="not-found"><p class="eyebrow">404 · OUT OF PLAY</p><h1>This page is off the board.</h1><p>The address may have changed, or the page may not exist. Pick a league and get back to the matchup.</p><div><a class="button primary" href="/">Back to home</a><a class="button outlined" href="/nba/">NBA matchups</a><a class="button outlined" href="/nfl/">NFL matchups</a></div></section>`;
  return `<!doctype html><html lang="en"><head>${head(key)}</head><body class="${key === 'home' ? 'home-page' : 'error-page'}"><a class="skip-link" href="#main">Skip to content</a>${header}${nav()}<main id="main">${content}</main>${footer}</body></html>`;
}
export const ROBOTS = `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${ORIGIN}/sitemap.xml\n`;
export const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Object.values(PAGES).map(p => `<url><loc>${ORIGIN}${p.path}</loc></url>`).join('')}</urlset>\n`;
export const SECURITY_TXT = `Contact: https://github.com/wpimedia1/The-Matchup/security/advisories/new\nExpires: 2027-11-01T00:00:00Z\nPreferred-Languages: en\nCanonical: ${ORIGIN}/.well-known/security.txt\nPolicy: https://github.com/wpimedia1/The-Matchup/blob/main/SECURITY.md\n`;
