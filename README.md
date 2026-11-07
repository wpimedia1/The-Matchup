# The Matchup

[![CI](https://github.com/wpimedia1/The-Matchup/actions/workflows/ci.yml/badge.svg)](https://github.com/wpimedia1/The-Matchup/actions/workflows/ci.yml)
[![CodeQL](https://github.com/wpimedia1/The-Matchup/actions/workflows/codeql.yml/badge.svg)](https://github.com/wpimedia1/The-Matchup/actions/workflows/codeql.yml)

Open-source project: **The Matchup**. Planned domain: **thematchup.app** (not yet connected). The site's existing visible branding is intentionally unchanged.

A combined NBA / NFL matchup website built from the two supplied dashboards. The selected option 3 design uses a navy league bar, horizontal scoreboard, stadium panorama, team-color matchup hero, and game lines beside player props. It includes last-10 averages, manual averages, filters, and the original explicit-load usage controls.

## Run locally

Requires Node.js 22.14 or newer. There are no third-party runtime dependencies and no build step.

```powershell
npm start
```

Open **http://127.0.0.1:4173**. For automatic server restarts while editing, use `npm run dev`. Refresh the browser after frontend edits.

The existing root `.env` is read by Node on startup:

```dotenv
ODDS_API=your_key_here
PORT=4173
HOST=127.0.0.1
```

The supplied `.env` has been preserved. Set environment variables directly on a hosting platform; pre-existing process environment variables take precedence over `.env`. `.env.example` documents the variable names without credentials.

## Using the desk

- Switch between NBA and NFL. Each league retains its own board and selection during the session.
- The initial view is the clearly labeled NFL sample matchup. Switching to an unopened league shows its sample board; no odds requests happen automatically.
- Load a schedule, or load schedule + lines. Nothing polls the odds provider automatically.
- Use **Find a matchup** for team/date filters. Select a matchup, choose markets, and load props. **More markets** expands all available options. **Player filters** exposes player search and Over/Yes, Under/No, or both sides.
- Each prop row compares prices at the **same player, market, side, and line**. Expand the price to see all returned bookmakers. Game-board quotes retain their exact line and bookmaker; hover a quote for attribution.
- Compute averages using public game logs. The server reads the newest two published NBA seasons and the current/prior NFL seasons. It excludes future records and duplicate games, skips NBA DNPs, and uses regular-season NFL records. Ambiguous player matches remain blank. Partial source failures, older records, and available game counts are shown.
- Manual averages persist in browser storage and are synchronized across a player's over/under rows. Existing entries are preserved when computing averages. Clear an entry to recompute it. NBA/NFL and live/sample values are isolated. Old manual averages can be imported automatically if the original pages used the same browser origin.
- Sample mode preserves the original illustrative fixtures, adds NFL scoreboard examples, and is clearly labeled. Sample props exist only for the first original fixture in each league; they do not pretend to be current rosters. Demonstration averages are explicitly labeled illustrative and can be edited. Live averages still use the backend.
- The editable quota and remaining figure are a **session estimate**, not a shared account balance. The original suggestion of three prop markets is retained without introducing a new hard cap. There are no new app usage limits, billing rules, or automatic refreshes.

## Backend and security

The browser talks only to same-origin endpoints. Only the backend reads `ODDS_API` and calls The Odds API. Keys are excluded from client files, client requests, error bodies, and server logging. Successful provider responses are defensively redacted as well.

Only explicit public application routes and allowlisted image/font files from `public/assets` are served. The asset list is built from regular files with restricted names and extensions at server startup; restart after adding assets. The project root, source HTML originals, server code, `.env`, and dotfiles are not a public static directory. Content Security Policy, anti-framing, MIME-sniffing protection, same-origin resource policy, and browser cross-site request rejection are enabled. Upstream host, sports, regions, markets, query keys, and event IDs are constrained; callers cannot turn the backend into an arbitrary URL proxy. Errors do not forward provider bodies or request URLs. Tests use fake credentials.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/health` | Readiness and whether live data is configured; never returns the key |
| `GET /api/:league/events` | Schedule, where league is `nba` or `nfl` |
| `GET /api/:league/odds?region=us` | Moneyline, spread, total |
| `GET /api/:league/events/:id/props?region=us&markets=player_points` | Allowlisted league-specific prop markets |
| `POST /api/:league/averages` | JSON `{ players, markets, teams: [awayTeam, homeTeam], before: ISODate }` |

The odds endpoints return `{ data, usage: { last }, fetchedAt }`. Averages return results with available game counts, source dates, source name, and partial-coverage status. Only large public statistics files are cached in memory for one hour; odds calls preserve the original user-triggered behavior.

## Hosting

See [DEPLOYMENT.md](DEPLOYMENT.md) for Node/container deployment, secrets, the planned domain, and Cloudflare compatibility. GitHub hosts the source repository; GitHub Pages cannot run this Node backend.

Use a Node-capable host, not a static-only file host. Start command: `npm start`; set `HOST=0.0.0.0`, the host's assigned `PORT`, and secret `ODDS_API` in the host's environment settings. Put the app behind the hosting platform's HTTPS endpoint and preserve the original Host header through any reverse proxy. Never configure a web server to serve this project's root directory. No deployment has been performed.

No sign-in or database is required for this public read-only site. Manual averages are local to each visitor's browser. Public server access is deliberate; cross-site browser checks are not authentication.

## Checks

```powershell
npm run check
npm test
npm run security:check
```

Tests cover secret/file exposure, endpoint and origin validation, provider failures, both league routes, exact-line grouping, quoted CSV parsing, ambiguous identities, DNP filtering, deduplication, date boundaries, and fewer-than-ten-game samples. See `design-qa.md` for browser verification.

## Sources

The exact selected visual reference is `design/option3-reference.png`. Team logos and player portraits are local ESPN assets; file-level source URLs are recorded in `public/assets/sources.json`. The two stadium panoramas were generated for this design. Barlow and Barlow Condensed are locally hosted under the SIL Open Font License (`public/assets/font-license.txt`). `scripts/fetch-design-assets.mjs` refreshes public identity assets without accessing `.env`.

- [The Odds API v4 documentation](https://the-odds-api.com/liveapi/guides/v4/)
- [Current hoopR NBA loader](https://github.com/sportsdataverse/hoopR/blob/main/R/load_nba.R) and [player box score release](https://github.com/sportsdataverse/sportsdataverse-data/releases/tag/espn_nba_player_boxscores)
- [nflverse player stats release](https://github.com/nflverse/nflverse-data/releases/tag/stats_player) and [game dates](https://github.com/nflverse/nfldata/blob/master/data/games.csv)

The two original HTML files remain at the project root for reference. Their deprecated direct-browser data integrations are replaced by the backend adapters.

## Open source

Original code is [MIT licensed](LICENSE). See [third-party notices](THIRD_PARTY_NOTICES.md) for image, font, trademark, and data attribution; those rights are not granted by the code license. Contributions are welcome through pull requests; see [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
