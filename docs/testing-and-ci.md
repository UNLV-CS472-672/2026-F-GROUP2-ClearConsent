# Testing and CI

This document describes the local test commands, the files that implement
them, and the GitHub Actions workflow. The commands are intended to run from a
clean checkout of current `main` or a branch based on it.

## Prerequisites

Install the project prerequisites from the root README first. On Windows,
install Microsoft Visual C++ Redistributable v14 before starting the local
development server. Install the Chromium browser used by Playwright once per
development machine:

```sh
npx playwright install chromium
```

CI uses the Linux dependency variant instead:

```sh
npx playwright install --with-deps chromium
```

## Local commands

Run the unit test suite:

```sh
npm test
```

Measure unit-test line and branch coverage over production TypeScript and Svelte
source, and enforce the CI minimums:

```sh
npm run test:coverage
```

This writes `coverage/coverage-summary.json` locally and prints file-level
coverage. The measured baseline on `5d182f3` (2026-11-10) was **55.57% lines
(843/1,517)** and **61.83% branches (559/904)** across `src/**/*.{ts,svelte}`.
CI requires at least 55% lines and 60% branches, so new code cannot silently
lower either measure below the floor. These are Vitest unit-test metrics only;
Playwright, database, and offline evaluation tests do not contribute to them.
The baseline leaves material gaps in dashboard input and history screens, URL
extraction and source routes, and the saved-result loader. Record fresh totals
and the remaining uncovered areas at the DP III release commit rather than
presenting this baseline as final coverage.

Run unit tests in watch mode:

```sh
npm run test:watch
```

Run the browser smoke test. The Playwright web server configuration starts and
stops the Vite development server automatically:

```sh
npm run test:e2e
```

Run the full application checks:

```sh
npm run check
npm run build
```

## File map

- `package.json` defines `test`, `test:coverage`, `test:watch`, and `test:e2e`.
- `vitest.config.ts` configures Vitest with the SvelteKit plugin, jsdom, production
  source coverage, and line/branch thresholds.
- `src/routes.test.ts` checks the signed-out auth entry.
- `src/entry-handoff.test.ts` checks the returning-session redirect.
- `playwright.config.ts` selects Chromium and starts Vite on port 4173.
- `tests/e2e/welcome.spec.ts` checks the signed-out entry and confirmation callback.
- `tests/e2e/dashboard-navigation.spec.ts` checks the anonymous redirect. With
  `STUDY_TEST_EMAIL` and `STUDY_TEST_PASSWORD` for a confirmed test account, it
  also follows the dashboard links to the current forms in a real browser. It
  does not call an external policy site or assert that analysis or history work.
- `tests/e2e/preferences-preview.spec.ts` uses that test account to check that
  the format preview responds to choices, saves and restores them on reload,
  discards unsaved edits, and links
  back to the dashboard. The five authenticated cases are tagged
  `@authenticated`; anonymous cases do not need credentials.
- `tests/e2e/count-reporter.ts` prints selected, passed, failed, skipped, and
  not-run counts. CI requires every selected case to pass without a skip.
- `.github/workflows/ci.yml` installs dependencies and Chromium, then runs
  lint, Svelte checks, unit tests with coverage thresholds, the production
  build, and end-to-end tests.
- `.gitignore` excludes Playwright's generated `test-results` directory.

## CI sequence

The `CI` workflow runs on pull requests and on pushes to `main` and
`fix/windows-setup`. It uses the Node version in `.nvmrc`, installs from the
committed lockfile with `npm ci`, installs Chromium, and runs the same checks
listed above. Playwright retains traces on the first retry to help diagnose a
browser failure for anonymous cases. Authenticated runs disable traces so the
test password cannot enter a trace snapshot. Authenticated cases use one worker
because the sign-out case can revoke the shared account's other sessions. Pull
requests and other untrusted contexts run four anonymous browser cases with no
test credentials. A push to `main` also runs the five
authenticated cases. Missing account secrets, a skip, or a failed case fails that
run; a green anonymous pull request does not claim authenticated coverage.

## Dedicated authenticated browser account

Create one confirmed, non-admin test user in the ClearConsent Supabase Auth
project, with an inbox the team controls. Do not use a teammate's personal
account, the Supabase service role, or the project admin account. Keep this
identity for synthetic browser checks only. The current five cases read UI and
use a fixed study sample; they make no paid analysis call and need no seeded
history. The dashboard navigation test works with either empty or populated
history. The preferences case saves changed presentation choices and restores
the original choices in a finally block, without submitting or changing the
scoring profile. If the account had no preferences row, cleanup leaves an
equivalent default row; it never deletes account data. If additional tests write
data, add explicit test-only setup and cleanup
before relying on an empty account; never reset the shared project.

The repository owner stores the confirmed account's login as GitHub Actions
repository secrets named `STUDY_TEST_EMAIL` and `STUDY_TEST_PASSWORD`. Do not
put their values in Git, an issue, a PR, a terminal transcript, screenshots, or
Playwright artifacts. The workflow passes them only to the authenticated step
on a push to `main`; pull request code does not receive them. The browser step
does not receive `SUPABASE_SERVICE_ROLE_KEY`.

For a local credentialed run, load these values into the current shell from a
private source: `STUDY_TEST_EMAIL=<dedicated test email>`,
`STUDY_TEST_PASSWORD=<password from private vault>`, and
`ENABLE_PAID_ANALYSIS=0`. The angle-bracketed text is a placeholder, not a
literal value or a file to create. Use a secure prompt or secret manager rather
than putting credentials in shell history or a file in the repository. Then run:

```sh
npm run test:e2e -- --grep @authenticated
```

For the anonymous lane, run:

```sh
npm run test:e2e -- --grep-invert @authenticated
```

Record the tested commit, CI run URL, and the reporter's selected/passed/skipped
counts. The current expected counts are five authenticated and four anonymous
cases. First-time signup and email verification, ordinary paste/URL analysis,
and save/reopen coverage remain separate work in issue #10.

## Updating the suite

### Schema readiness regressions

`npm run test:schema-readiness` runs deterministic Node tests with synthetic public
configuration and mocked HTTP responses. CI retains all existing checks and runs
this command on every pull request and supported push. It covers the successful
boolean contract, malformed configuration, privileged keys, false or malformed
responses, redirects, HTTP failures (including 401/403), network errors and timeouts,
sanitized failures, and placement of the release gate before Wrangler.

`supabase/tests/database/schema-readiness.test.sql` runs through `npm run test:db`
in a rolled-back disposable transaction. It checks anonymous catalog-only access,
stable/security-invoker behavior, missing table/column/functions, disabled RLS,
wrong argument types/names and return type, and execute permission drift. It never
calls a state-changing analysis RPC or reads production data.

The live `npm run check:schema-readiness` command is a separate release check, not
part of offline PR validation. It requires the reviewed readiness migration on the
hosted target. See [the release checklist and coverage boundaries](deployment.md#required-hosted-schema-gate-77).
Neither mocked HTTP tests nor local pgTAP establishes production recovery or
authenticated browser coverage. Broader end-to-end work remains tracked by #10
and #66.

Keep tests deterministic and local. Do not call external APIs, require secrets,
or exercise the LLM in CI. Add route or component behavior to Vitest when a
browser is unnecessary; use Playwright for behavior that depends on the
rendered page and a real browser.

## Phase 1 database and evaluation regressions

Use a clean checkout of current `main` or the phase 1 branch. In addition to the
app checks above, run:

```sh
npm run test:offline
npm run test:stage1:offline
npm run test:db
```

`test:offline` runs only the synthetic citation/cost regressions in
`tests/eval/issue-11/regression.test.mjs`. It neither loads archived policies nor
imports paid runners. Historical fixture/prompt checks remain an explicit local
command: `node --test tests/eval/issue-11/offline.test.mjs`. Paid evaluations remain
opt-in manual work under #11, outside CI and the default Vitest/Playwright suites.

`test:stage1:offline` runs the six Stage 1 loader, estimator, mock provider,
scoring, and review tests in `tests/eval/stage1/offline.test.ts`. It uses local
fixtures and a mock provider, with no paid model calls. CI runs this command
automatically in the `validate` job on pull requests and pushes covered by the
workflow; failures fail the job.

`test:db` requires Docker Desktop (Linux containers on Windows) or Docker Engine
on Linux, with the daemon running. The Supabase CLI comes from the committed npm
lockfile; no global installation or production credentials are required. The
runner copies migrations, synthetic seed and pgTAP tests into a temporary project
with a unique project ID and dedicated ports 55420–55429. Existing developer
Supabase projects are not reset. If these ports are occupied, stop the conflicting
disposable run before retrying; do not point this command at a production database.

The runner executes local start, `supabase db reset --local`,
`supabase db lint --local --level warning --fail-on warning`, and
`supabase test db --local`. It strips Supabase/Postgres/database/model credential
variables from the child environment. In a `finally` block it stops that temporary
project with `--no-backup`, removing disposable volumes, then removes its temporary
files. If cleanup fails, it reports the project ID and directory for manual cleanup:
`npx supabase --workdir <reported-directory> stop --no-backup`.

Database tests run in a rolled-back transaction against invented source text.
They use the real `authenticated` and `anon` database roles and synthetic JWT
claims to test RLS; they do not test interactive sign-in or Supabase Auth sessions.
Coverage includes owner/second-user reads and forbidden writes, anonymous denial,
immutable saved rows, cross-analysis references, valid evidence controls,
malformed evidence, and analysis/account deletion cascades. Cascades are also
checked as postgres so RLS cannot hide undeleted rows.

The incremental evidence migration requires a nonempty array of objects, each
with a nonblank string `excerpt`, matching the existing seed/design. Additional
fields remain permitted. It does not settle #22's passage IDs, offsets, taxonomy,
confidence or ambiguity contract. Those schema tests remain pending #22's agreed
implementation; reuse its tests once it reaches main.

CI runs both offline commands and the disposable database command alongside the
existing app checks in the `validate` job. Database failure therefore fails CI and
prevents the separate production workflow from passing its successful-CI gate.
No deployment command, paid model request, production secret or production
connection is part of these checks. Initial Docker image downloads need network
access and may take several minutes.
