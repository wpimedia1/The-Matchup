# Search and crawl setup

Canonical site: https://the-matchup.app

| Page | Canonical URL |
| --- | --- |
| League selection | https://the-matchup.app/ |
| NBA dashboard | https://the-matchup.app/nba/ |
| NFL dashboard | https://the-matchup.app/nfl/ |

Node and Cloudflare share the page renderer and metadata definitions. All three
pages deliver useful HTML, a visible H1, descriptions, canonical URLs, social
metadata and factual structured data before JavaScript. League dashboards load
sample data initially; crawlers and page visits do not trigger paid odds calls.
League navigation is progressively enhanced, retaining in-memory board state
and updating metadata, breadcrumbs and browser history. Manual averages retain
their existing localStorage keys. Browser storage does not migrate between
different origins; averages previously saved on workers.dev stay on that origin.

The sitemap contains only these three pages; sample events and UI filters have
no separate indexable URLs. Unknown pages return HTTP 404 and noindex, not an
app-shell 200. API responses use noindex and are disallowed in robots.txt;
neither measure is authentication. Secret-file protection remains server-side.

## Google Search Console (owner setup)

1. Open https://search.google.com/search-console and add the Domain property
   `the-matchup.app` in your Google account.
2. Add the verification TXT record supplied by Google to this domain's DNS in
   Cloudflare, then choose Verify in Search Console. Do not invent a verification
   value or remove existing DNS records.
3. Submit `https://the-matchup.app/sitemap.xml` under Sitemaps.
4. Inspect each canonical URL, run Test Live URL, check the rendered page and
   canonical selection, then request indexing if appropriate.
5. Review Page indexing and Core Web Vitals after Google has collected data.
   A new site may have no field-performance data yet. Submission does not
   guarantee indexing or search rankings.

No Search Console account, analytics tag, advertising code or verification token
is installed by this release.

## Verification and maintenance

- Run `npm test` and `npm run check:cloudflare` before releasing.
- Check raw and rendered HTML for one H1, correct canonical URLs and matching
  metadata. `WebSite` and `WebPage` are descriptive schema, not guaranteed rich
  result types. Validate JSON-LD with Schema.org's validator; Google may report
  no eligible rich results without indicating an error.
- Confirm HTTP, www and the former workers.dev host permanently redirect to
  HTTPS apex without dropping paths or queries. Bind www to the production
  Worker; wildcard preview routing alone does not serve the www production URL.
- Inspect the final robots.txt at the custom domain. Cloudflare may prepend its
  content-signal notice; preserve account crawler policies and ensure our public
  page allowances and sitemap remain visible.
- Check mobile rendering, keyboard focus, Back/Forward, and saved averages.
- Inspect missing pages and private paths for 404 status; API failures stay JSON.
- Renew `/.well-known/security.txt` before its published expiry of 2027-11-01.
- Keep social-card URLs absolute, and keep their declared dimensions in sync
  with the actual asset. The shared preview is 1200 × 630 pixels.

References: [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics),
[Google SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide).
