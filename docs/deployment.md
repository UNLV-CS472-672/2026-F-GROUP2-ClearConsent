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

The Worker also needs the Supabase settings at runtime. Add these as Cloudflare
Worker secrets before the first release that uses the database, or extraction
requests will fail:

```sh
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
```

Use the hosted project URL and its publishable key. Never store the service-role
key in the Worker. The deploy step does not set these secrets, so they persist
across releases once added.

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

### Required hosted schema gate (#77)

Local migration tests prove that the committed SQL works on a disposable database;
they do not prove that a hosted project has received it. The deployment job now runs
`npm run check:schema-readiness` after the current-main check and before Wrangler.
Build and probe share the same `PUBLIC_SUPABASE_URL` and
`PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Only a successful HTTP 200 containing the JSON
boolean `true` permits deployment. Missing configuration, redirects, HTTP errors
(including 401/403), timeouts, invalid JSON, and any other result block release.
Failure output omits keys, URLs, response bodies, and upstream exception details.

The probe calls `GET /rest/v1/rpc/analysis_schema_ready_v2` with the existing public
publishable key. The reviewed migration
`20261106172644_analysis_schema_readiness.sql` adds the preserved v1 base
function, a stable, security-invoker function that reads catalog metadata only. It exposes one boolean and has no input
parameters, user-row access, elevated privileges, or calls to analysis functions.
It checks the real `public.analysis_runs` table, RLS enabled, required column types,
and these exact named RPC signatures and return types:

- `start_analysis_run(p_source_id uuid, p_retry boolean) -> jsonb`
- `fail_analysis_run(p_source_id uuid, p_run_id uuid, p_error_code text, p_error_message text) -> boolean`
- `release_analysis_run(p_source_id uuid, p_run_id uuid) -> boolean`

It also requires authenticated execute and anonymous denial on those three RPCs.
The additive `20261112012221_paste_schema_readiness_v2.sql` migration preserves
that already-applied v1 function and adds v2 for #94's paste-save requirements:

- The `sources` table, enabled RLS, required column types, and authenticated
  SELECT/INSERT grants.
- `find_or_create_pasted_source(p_text text, p_title text) -> SETOF public.sources`,
  security invoker, authenticated execute and anonymous denial.
- The valid, ready `sources_paste_digest_idx` btree on `(owner_id, md5(text))`
  restricted to `url IS NULL`.

The v2 check reads catalogs only and never calls the paste RPC. The script requires
v2 explicitly: an old v1 `true` cannot satisfy it, and there is no fallback to v1.
The paste RPC/index themselves remain in #94's separate migration, not this PR.
Existing grants, ownership policies and duplicate-run protections are unchanged.
The new boolean function alone is callable anonymously. No service-role credential,
test login, new identity, paid analysis, or automatic migration is used by the gate.

Direct anonymous probes of the protected RPCs cannot reliably establish their full
contract: OpenAPI is role-filtered and a 401/403 can have multiple causes. Those
responses must never count as readiness. See
[PostgREST OpenAPI permissions](https://docs.postgrest.org/en/stable/references/api/openapi.html)
and [read-only HTTP transactions](https://docs.postgrest.org/en/stable/references/transactions.html).

#### Release and remediation checklist

1. Review pending migrations against the exact validated main SHA and intended
   hosted project. In particular, the analysis-run migration from #69 and the new
   v1 readiness migration, #94's `20261111000000_pasted_source_rpc.sql`, and
   `20261112012221_paste_schema_readiness_v2.sql` must be applied before this gate
   can pass. Apply the reviewed #94 database migration first, then v2, then verify
   HTTP 200 with JSON `true` using this revision's script **before merging #78**.
   The old v1 confirmation is not sufficient for this updated contract. No hosted
   application of either new migration is implied by this PR or local tests.
   Missing v2 blocks release; installing v2 without the paste contract returns
   `false`. Merging the guard early will deliberately block subsequent production
   deployments, including unrelated changes, until the requirements are present.
   Do not merge #94's application code first merely to install its SQL: apply its
   reviewed migration separately through the normal authorized database process.
   There is no bootstrap bypass.
2. The database owner separately authorizes and applies reviewed migrations using
   the team's existing migration process. Verify migration history and SQL results;
   do not reset the hosted database or grant anonymous access to protected tables or
   RPCs to make the probe pass. Use the lockfile's CLI version and inspect `--help`
   before operational commands. This workflow never applies migrations.
3. Ensure the Data API exposes `public` and reload its schema cache after schema
   changes if needed. With the deployment's public configuration in the environment,
   run `npm run check:schema-readiness`; investigate any failure before retrying.
   Check the URL/key pairing, migration history and catalog objects, permissions,
   Data API availability and cache. Do not print private configuration or raw logs.
4. Rerun release only for a still-current main SHA with successful CI. Record that
   SHA, CI/release run URLs, migration verification and readiness outcome.
5. After an authorized deployment, separately verify an existing saved result and
   record a sanitized outcome. Keep paid analysis disabled in test environments.
   Opening a new-submission result can start a paid run and needs separate scope.

This is a point-in-time prerequisite, not a complete schema-diff or recovery test.
It does not verify every constraint, index, policy, function body, migration-history
entry, per-RPC PostgREST cache entry, Worker runtime configuration, or saved-result
rendering. It does not prevent schema changes after the check. Retain database
regressions and post-release smoke checks; version and extend the contract when
new runtime schema requirements are introduced. A wrong project with the same
contract cannot be distinguished by the boolean: review the shared deployment URL
and Worker configuration. The script accepts hosted HTTPS Supabase origins and
`sb_publishable_` keys only; local HTTP and legacy JWT keys are intentionally rejected.

Issue #77 records a missing application of the committed analysis-run migration:
result pages failed while a saved result still existed. The release workflow had no
hosted-schema check. Production remediation and saved-result recovery verification
are separate operational work; local tests and this PR do not establish recovery.

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
