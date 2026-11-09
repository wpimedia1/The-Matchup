# Deploying The Matchup

Repository: https://github.com/wpimedia1/The-Matchup

Production domain: `https://the-matchup.app`. Keep the frontend and `/api/*` on
one HTTPS origin. The root is a league-selection homepage; `/nba/` and `/nfl/`
serve the interactive dashboards.

## Node hosting

Use a Node-capable web service with a current security release of Node 22 or 24.
Install/check command: `npm ci --ignore-scripts && npm run check && npm test`.
Start command: `npm start`. Health check: `/api/health`.

Set these in the host's environment settings:

| Variable | Value |
| --- | --- |
| `ODDS_API` | Secret from your local `.env`; enter through the host's secret interface |
| `HOST` | `0.0.0.0` |
| `PORT` | Host-assigned port, or `4173` |
| `NODE_ENV` | `production` |

Never commit `.env` or provide the key as a public build variable. The service
must run the backend; a static export cannot supply live odds or averages.
Without `ODDS_API`, sample mode works and live requests fail safely.

## Containers

`Dockerfile` uses an immutable Node image reference and copies only the runtime
files. `.dockerignore` allowlists the build context and excludes credentials.
The image runs as the unprivileged `node` user and has a health check.

```sh
docker compose up --build -d
```

Compose reads `ODDS_API` from your local ignored `.env` or shell environment.
The service is bound to `127.0.0.1:4173`, has a read-only filesystem, no Linux
capabilities, and a small temporary filesystem. Put a maintained TLS reverse
proxy in front of it. If a managed host assigns ports directly, use the image
with its own environment/port configuration instead of this local Compose map.

Point `the-matchup.app` to the chosen host only after its custom-domain setup
provides the required DNS records. Enable HTTPS, redirect HTTP, set HSTS at
the edge, and preserve the public Host header through the proxy. Avoid adding
a dangling DNS record before the hosting service is bound to the domain.

## Cloudflare

Cloudflare Pages Functions can execute backend code in the Workers runtime.
Cloudflare Workers with Static Assets supports the frontend and API in one
deployment and is the recommended Cloudflare target for this project.

`wrangler.jsonc` deploys `worker/index.js` and an allowlisted static build. The
Worker and Node server share API validation and credential handling. Requests
first run the Worker for canonical-host and path redirects, then `/api/*` uses
the shared API handler and other requests use the static asset binding. This
means static page requests also invoke the Worker under Cloudflare platform
accounting. Security headers apply to both. The build deletes stale output before copying public files.

```sh
npm ci --ignore-scripts
npm run check:cloudflare
npm run deploy
```

For Git integration, select `wpimedia1/The-Matchup`, production branch `main`,
root directory `/`, and deploy command `npm run deploy`. Wrangler's build hook
runs `npm run build:cloudflare`; no separate build command is required. Disable
preview builds to keep production credentials away from unreviewed branches.
Production uses `the-matchup.app`; `www.the-matchup.app` must also route to the
Worker so it can redirect to the apex. The former production `workers.dev`
hostname redirects permanently to the canonical domain. Disable version preview
URLs in production so historical versions do not become duplicate public sites.
Custom-domain bindings live in the Cloudflare dashboard and are not managed by
this repository. The Node host relies on its HTTPS reverse proxy for protocol
redirects; it does not trust arbitrary forwarded-protocol headers.

Set `ODDS_API` under **Worker Settings → Variables and Secrets** with type
**Secret**, then deploy the setting. This is a runtime secret, not a build
variable. GitHub Actions and Cloudflare build commands do not need the key.
For local Worker development, use the ignored `.dev.vars` or `.env`, then run
`npm run dev:cloudflare`. Never commit either credentials file.

### Public statistics refresh

The protected-main `Refresh public statistics` workflow runs daily at 10:41 UTC
and can be triggered manually. It downloads the same public game logs used by
the Node backend and publishes compact team summaries to `stats-data`. It uses
only GitHub's job token, with write permission confined to the publishing job;
it has no odds or Cloudflare credentials. The runtime fetches only summaries
for the selected teams, caching them for one hour. This keeps season-file
processing outside Cloudflare request memory and CPU budgets.

Run the workflow once before serving live averages. Failed or partial source
downloads leave the previous branch intact. Summaries older than 48 hours are
rejected; source dates and available game counts remain in API responses. A
requested game date earlier than a player's newest summarized game returns a
blank average rather than including later results. The Node backend continues
calculating directly from season files. Neither path polls the odds provider
or adds application usage limits.

References: [Pages Functions](https://developers.cloudflare.com/pages/functions/),
[Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/),
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

## Release checks

- CI, CodeQL, and container checks must pass for the exact commit.
- Confirm `/api/health` reports `configured: true` without returning credentials.
- Confirm `/.env`, `/server/index.js`, and private files return 404.
- Check NBA/NFL schedule, props, averages, mobile layout, and the browser console.
- Keep production credentials out of pull-request previews and CI.
- Deploy reviewed commits; keep the previous version available for rollback.
