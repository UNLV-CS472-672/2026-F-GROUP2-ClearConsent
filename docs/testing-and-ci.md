# Testing and CI

This document describes the local test commands, the files that implement
them, and the GitHub Actions workflow. The commands are intended to run from a
clean checkout of the `fix/windows-setup` branch or a branch based on it.

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
