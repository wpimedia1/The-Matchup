# Contributing to The Matchup

1. Fork the repository and create a focused branch.
2. Use Node 22 or 24. Copy `.env.example` to `.env` only if you need live odds.
   Sample mode and automated tests work without credentials.
3. Run `npm ci --ignore-scripts`, `npm run check`, and `npm test`.
4. Stage the intended files, then run `npm run security:check`.
5. Open a pull request describing the user-visible behavior, validation, and
   any security or deployment changes. Do not include keys or private data.

Keep the UI and API contracts compatible across NBA and NFL. Preserve exact
line/book attribution and honest sample labels. Any new dependency, external
host, or credential flow needs an explicit explanation in the pull request.

Contributions to original code are under the MIT license. Preserve third-party
notices. Report security vulnerabilities privately as described in SECURITY.md.
