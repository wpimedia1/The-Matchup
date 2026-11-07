# Security policy

## Reporting a vulnerability

Report suspected vulnerabilities privately using
[GitHub's vulnerability reporting form](https://github.com/wpimedia1/The-Matchup/security/advisories/new).
Do not post secrets or exploit details in public issues. Include the affected
commit, reproduction steps using a dummy key, and the expected impact.

The current `main` branch is the supported version. Security updates are
delivered through reviewed pull requests and automated checks.

## Credential boundary

- `ODDS_API` belongs only in the hosting platform's secret store or a local,
  ignored `.env`. Never put it in browser JavaScript, build arguments, screenshots,
  GitHub Pages, repository variables, or committed configuration.
- Tests and CI use fake keys and do not need production secrets.
- Static files are explicitly allowlisted. The server does not expose the
  project root, dotfiles, original HTML dashboards, or server source.
- The proxy validates endpoints, query keys, regions, leagues, and markets.
  Provider errors are sanitized, and successful responses redact the server key.
- Same-origin browser checks and CSP reduce browser abuse. This is a public
  API, not an authenticated service; these checks do not stop direct HTTP clients.
- The existing usage controls are retained. No new application quota or rate
  limit is imposed by this security setup.

## Deployment

Use HTTPS at the hosting edge, with HTTP-to-HTTPS redirects and HSTS. Preserve
the public Host header when reverse proxying. Keep Node on a supported security
release. The supplied container runs as an unprivileged user; Compose adds a
read-only filesystem, drops capabilities, and binds to loopback for a local
TLS reverse proxy. Do not enable request URL/body logging that captures secrets.

If a credential is ever committed, revoke/rotate it immediately. Deleting it
from the newest revision does not remove it from history or clones.

## Repository protections

CI uses commit-pinned official Actions, read-only permissions by default,
fake credentials, and no `pull_request_target` execution. CodeQL is granted only
the permissions needed to publish findings. Dependabot maintains Actions and
container references. `npm run security:check` scans the Git index, rejects
credential files, checks high-confidence token patterns, and compares staged
content against local `.env` secret values without printing them. This is an
additional guard, not a guarantee that every possible secret format is detected.

## Asset maintenance utility

`scripts/fetch-design-assets.mjs` is an explicit developer utility, not an API
endpoint or install hook, and is not included in the runtime container. It
intentionally writes downloaded images/fonts and JSON-escaped identity/source
metadata. Downloads are restricted to specific HTTPS ESPN CDN and Google Fonts
paths, reject redirects, validate local filenames and player IDs, enforce a
10 MiB asset bound, and verify image/font signatures. Network-to-file findings
for these intended writes should be reviewed in this context, not suppressed
globally. This asset size bound does not change API usage controls.
