import { escapeHtml, fighterPanel, marketTables, sampleFight } from '../public/fight-markets.js';

export function fightPage(page) {
  return `<main id="main">
    <section class="page-intro">
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">The Matchup</a><span aria-hidden="true">/</span><span aria-current="page">MMA</span></nav>
      <h1>${escapeHtml(page.heading)}</h1><p>${escapeHtml(page.intro)}</p>
    </section>
    <div class="fight-banner"><img src="/assets/stadium-mma.webp" width="1200" height="480" alt="" fetchpriority="high"></div>
    <section class="fight-desk" aria-labelledby="fight-title">
      <div class="fight-toolbar">
        <label>Bookmaker region<select id="fight-region"><option value="all">All regions</option><option value="us">United States</option><option value="us2">United States 2</option><option value="uk">United Kingdom</option><option value="eu">Europe</option><option value="au">Australia</option></select></label>
        <button class="button primary" id="fight-load" type="button">Load fight board</button>
        <button class="text-button" id="fight-sample" type="button">Sample fight</button>
      </div>
      <p id="fight-status" role="status">Sample odds · Illustrative fighters and prices.</p>
      <label class="fight-selector" id="fight-select-label" hidden>Scheduled fights<select id="fight-select"></select></label>
      <h2 class="sr-only" id="fight-title">Selected fight</h2>
      <p id="fight-time">Sample matchup</p>
      <div id="fight-pair">${fighterPanel(sampleFight)}</div>
      <div class="fight-section-head"><h2>Fight markets</h2><button class="button outlined" id="fight-detail" type="button" hidden>Load all fight markets</button></div>
      <p id="market-status" role="status">Sample markets · Expand a price to compare bookmakers.</p>
      <div id="fight-tables">${marketTables(sampleFight)}</div>
      <noscript><p>Enable JavaScript to load current fights and odds.</p></noscript>
      <section class="fight-guide" aria-labelledby="fight-guide-title"><h2 id="fight-guide-title">How to read MMA odds</h2>
        <p>Fight winner compares the two fighters. Three-way result includes a draw, while double chance covers either outcome named in the selection.</p>
        <p>Total rounds compares Over and Under at each quoted threshold. Alternate totals have their own lines. A fighter handicap pairs a named fighter with a signed line. Exchange lay prices show the price to bet against a fighter.</p>
        <p>Prices are American odds from The Odds API. Compare the same fight, market, outcome and line. Expand a price for each bookmaker and its update time when available. Market coverage varies by fight and region.</p>
      </section>
    </section></main>`;
}
