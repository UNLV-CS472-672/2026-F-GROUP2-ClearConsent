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

- `package.json` defines `test`, `test:watch`, and `test:e2e`.
- `vitest.config.ts` configures Vitest with the SvelteKit plugin and jsdom.
- `src/routes.test.ts` renders the existing welcome route and checks its
  heading and documentation link.
- `playwright.config.ts` selects Chromium and starts Vite on port 4173.
- `tests/e2e/welcome.spec.ts` checks the rendered page in a real browser.
- `.github/workflows/ci.yml` installs dependencies and Chromium, then runs
  lint, Svelte checks, unit tests, the production build, and end-to-end tests.
- `.gitignore` excludes Playwright's generated `test-results` directory.

## CI sequence

The `CI` workflow runs on pull requests and on pushes to `main` and
`fix/windows-setup`. It uses the Node version in `.nvmrc`, installs from the
committed lockfile with `npm ci`, installs Chromium, and runs the same checks
listed above. Playwright retains traces on the first retry to help diagnose a
browser failure.

## Updating the suite

Keep tests deterministic and local. Do not call external APIs, require secrets,
or exercise the LLM in CI. Add route or component behavior to Vitest when a
browser is unnecessary; use Playwright for behavior that depends on the
rendered page and a real browser.

## Phase 1 database and evaluation regressions

Use a clean checkout of current `main` or the phase 1 branch. In addition to the
app checks above, run:

```sh
npm run test:offline
npm run test:db
```

`test:offline` runs only the synthetic citation/cost regressions in
`tests/eval/issue-11/regression.test.mjs`. It neither loads archived policies nor
imports paid runners. Historical fixture/prompt checks remain an explicit local
command: `node --test tests/eval/issue-11/offline.test.mjs`. Paid evaluations remain
opt-in manual work under #11, outside CI and the default Vitest/Playwright suites.

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

CI runs the synthetic offline and disposable database commands alongside the
existing app checks in the `validate` job. Database failure therefore fails CI and
prevents the separate production workflow from passing its successful-CI gate.
No deployment command, paid model request, production secret or production
connection is part of these checks. Initial Docker image downloads need network
access and may take several minutes.
