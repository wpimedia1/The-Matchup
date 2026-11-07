# Deploying The Matchup

Repository: https://github.com/wpimedia1/The-Matchup

Planned production domain: `thematchup.app`. No DNS record or domain claim is
created by this repository. Keep the frontend and `/api/*` on one HTTPS origin.
The site's existing visible text does not need to change for deployment.

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

Point `thematchup.app` to the chosen host only after its custom-domain setup
provides the required DNS records. Enable HTTPS, redirect HTTP, set HSTS at
the edge, and preserve the public Host header through the proxy. Avoid adding
a dangling DNS record before the hosting service is bound to the domain.

## Cloudflare

Cloudflare Pages Functions can execute backend code in the Workers runtime.
Cloudflare Workers with Static Assets supports the frontend and API in one
deployment and is the recommended Cloudflare target for this project.

The current entrypoint is a Node HTTP server, not a deployable Worker. It needs
a Workers request adapter and asset binding, and the game-log implementation
needs memory/CPU validation for the Workers runtime. Do not deploy `public/`
alone and expect `/api/*` to work. Store `ODDS_API` as a Cloudflare secret when
that adapter is added; never bake it into a static build.

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
