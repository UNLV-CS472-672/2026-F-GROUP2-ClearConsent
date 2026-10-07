# Production deployment

ClearConsent runs as a SvelteKit Worker on Cloudflare. The Worker name and assets
configuration are in `wrangler.jsonc`; the public canonical URL is
<https://clearconsent.site/>.

## Validation and release flow

`.github/workflows/ci.yml` remains validation-only: installation, Chromium setup,
formatting/lint, Svelte/type checks, Vitest, production build and Playwright.
Pull requests do not deploy and receive no Cloudflare credentials from this workflow.

`.github/workflows/deploy.yml` runs after the `CI` workflow completes. Deployment
requires a successful CI run caused by a push to this repository's `main` branch.
The checkout uses that run's exact `head_sha`, not the moving branch tip. It installs
from the committed lockfile and rebuilds with the pinned Wrangler version. Releases
are serialized, and superseded main commits are skipped before deployment. Failed
CI, pull-request CI and pushes to other branches cannot pass the deployment gate.

The production job uses the GitHub `production` environment. The repository owner
must configure its deployment branch policy for `main` and any required reviewers
before enabling releases. Merely naming an environment does not configure those
protections. Preserve existing main review/check rules; this PR does not change them.
The workflow becomes active only when it is present on the default branch.

Configure `CLOUDFLARE_API_TOKEN` as a GitHub secret and
`CLOUDFLARE_ACCOUNT_ID` as a GitHub variable, available to the production environment
(or inherited from the repository). Use a token restricted to the intended account
and Worker deployment operations. Never commit either a token or certificate/private
key. Cloudflare credentials are passed only to the deployment step; local install,
checks, build and preview require no Cloudflare login. `.gitignore` excludes `ssl/`.

Normal local validation, from the repository root:

```sh
npm ci
npx playwright install chromium
npm run lint
npm run check
npm test
npm run build
npm run test:e2e
```

Use `npm.cmd`/`npx.cmd` in PowerShell if script execution policy requires it.
Retain the pinned Wrangler toolchain and the generated-type wrapper; changing
Wrangler requires separate before/after-build type-generation verification.

## Domain configuration and evidence

PR #13 records Jonathan's Cloudflare/registrar setup and screenshots: Cloudflare
nameservers, domain binding, DNSSEC, HTTPS redirects, TLS minimum and certificates.
Those account settings are reported evidence, not configuration that this repository
can recreate automatically. The account owner should record the active zone and
Worker Custom Domain binding when verifying a release.

The intended canonical behavior is:

| Request                          | Expected behavior          |
| -------------------------------- | -------------------------- |
| `https://clearconsent.site/`     | Serve the application      |
| `https://www.clearconsent.site/` | Redirect to the HTTPS apex |
| `http://clearconsent.site/`      | Redirect to the HTTPS apex |

Read-only checks on October 6, 2026 (America/Los_Angeles) confirmed an HTTPS 200
response from Cloudflare with a SvelteKit starter page, and 301 redirects from HTTPS
`www` and HTTP apex to `https://clearconsent.site/`. HTTPS checks used normal
certificate verification. They do not establish the deployed commit or completion
of the product MVP. The earlier parked-domain report in issue #3 is historical.

Repeat these checks after an authorized release:

```sh
curl -I https://clearconsent.site/
curl -I https://www.clearconsent.site/
curl -I http://clearconsent.site/
```

Also open the application in a browser, confirm no certificate warnings, verify the
expected routes, and check representative path/query redirects. In issue #3, record
the exact deployed SHA, deployment run URL, verification date and results. Confirm
DNSSEC, TLS and security settings in Cloudflare; successful public HTTP requests
alone do not verify every account setting.

## Release failure and recovery

A failed CI run prevents this release workflow from deploying. Build or deployment
failure fails the release job; check its logs without copying credentials. After
correcting configuration, rerun the release workflow for a still-current validated
main commit. A successful Wrangler command is deployment evidence; public/browser
checks remain a separate verification step.

For an application regression, prefer a reviewed revert on main and its normal CI
and release flow. An urgent Cloudflare rollback requires the deployment owner's
explicit authorization; record the restored version and verification. Do not delete
stored operational data as part of a code rollback.

This document does not authorize a deployment or claim environment protections,
production credentials, or a release from the updated PR have been verified.
