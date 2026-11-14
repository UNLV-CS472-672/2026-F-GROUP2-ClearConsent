# ClearConsent

ClearConsent is a signed-in privacy-policy workspace built with SvelteKit,
TypeScript, Tailwind, Supabase, and Cloudflare Workers. Users can submit pasted
text or a public URL, inspect source-linked analysis, ask questions about a saved
result, and reopen it from History. Live AI analysis requires server-side
configuration. The fixed study sample is a prepared example, and saved
preferences do not yet personalize live analysis.

## Prerequisites

- Node.js `^22.13.0 || >=24` (Node 20 and 23 are unsupported).
- npm; the Windows setup fix is verified with Node `24.20.0` and npm `11.19.0`.
- Git.
- Docker Desktop or another Docker-compatible runtime when running Supabase
  locally.
- Windows: Microsoft Visual C++ Redistributable v14, required by the local
  Cloudflare development runtime. Install the architecture matching Windows
  before running `npm run dev`.

`.npmrc` enables `engine-strict` so unsupported Node versions fail installation.
`.nvmrc` selects Node `22.20.0` for developers using a version manager. With
nvm-windows, use `nvm install 22.20.0` and `nvm use 22.20.0` explicitly.
That version is within the supported range; see the verification record for
versions actually tested.

## Fresh setup

```sh
git clone https://github.com/UNLV-CS472-672/2026-F-GROUP2-ClearConsent.git
cd 2026-F-GROUP2-ClearConsent
npm ci
```

Before running Svelte checks or building, set `PUBLIC_SUPABASE_URL` and
`PUBLIC_SUPABASE_PUBLISHABLE_KEY` in an ignored `.env` file or the shell. The
checked-in `.env.example` provides public example values but points at the hosted
Supabase project; use your local project's values before running the app against
a disposable database or submitting test data. Then verify the checkout:

```sh
npm run check
npm run lint
npm run build
```

Use `npm ci` for an existing checkout so dependencies follow the committed
lockfile. Use `npm install` when intentionally changing dependencies and review
the lockfile diff. A clean installation does not require regenerating types.

In PowerShell, if execution policy blocks `npm.ps1`, use `npm.cmd` in place of
`npm` in these commands. No execution-policy change is required.

These local checks do not need Cloudflare login or paid AI credentials. The
browser can run locally with paid analysis disabled; a live provider run needs
the separate server-only settings described below. Deployment is handled by the
validated `main` workflow, not by these setup commands.

## Development and preview

```sh
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). To test
the production Worker locally:

```sh
npm run build
npm run preview
```

Preview normally serves `http://localhost:4173`. Stop the server with Ctrl+C.

## Current product flow

The entry page at `/` links to registration and sign-in. A confirmed account
opens the dashboard after sign-in; returning sessions go there directly. The
dashboard opens the URL input by default and links to Paste Text, Preferences,
and sign-out. URL input extracts policy text, and Paste Text accepts text for
submission. A non-sample submission opens live analysis when the deployed
provider is enabled. Completed results appear in Recent analyses and History.

Preferences saves presentation choices and changes the invented example on that
page. Those choices do not yet personalize live analysis. The fixed study sample
remains a prepared result, separate from a newly submitted policy.

For DP III, see the [case matrix](docs/dp3-case-matrix.md) and the
[hosted live evidence with screenshots](docs/evidence/dp3-live-2026-11-13/README.md).
The latter records owner-observed paste and URL journeys on a specific deployed
revision; it is separate from deterministic CI and participant evaluation.

## Analysis and saved results

The live route analyzes a saved source in two stages, then stores the completed
analysis and its findings together. See [Stage 1 analysis](docs/stage-1-analysis.md),
[Stage 2 consolidation](docs/stage-2-consolidation.md),
[analysis persistence](docs/analysis-persistence.md), and the
[document chat API](docs/chat-api.md). Large pages and extracted documents have
bounded size limits; see [URL ingestion](docs/url-ingestion.md).

## Generated types and formatting

`npm run gen` generates `worker-configuration.d.ts` from `wrangler.jsonc` using
the locked Wrangler version. Rerun it when changing bindings, compatibility
settings, or Wrangler, and include the generated diff in the same PR.
`npm run gen:check` compares the generated content without modifying the file;
both `check` and `build` run it automatically.

Use the npm scripts rather than invoking `wrangler types` directly. The small
wrapper in `scripts/worker-types.js` removes only the type import of the compiled
SvelteKit Worker, working around
[Wrangler issue #14181](https://github.com/cloudflare/workers-sdk/issues/14181).
It retains `GlobalProps`, including an empty project declaration before the
first build, so generated runtime references remain valid and output is stable.
Without this workaround, generation changes after a build and TypeScript follows
the import into generated JavaScript. Binding and runtime types remain checked
for staleness, and application JavaScript/TypeScript checks remain enabled.
Wrangler is pinned because the wrapper uses its experimental generation API;
retest generation before and after a build when updating it.

`.gitattributes` enforces LF for text files across platforms, except Windows
batch scripts. Wrangler's generated file is excluded from Prettier and ESLint;
its content is verified by `gen:check` instead. Run `npm run format` for authored
files. Existing Windows checkouts with CRLF source files can run that command
once; fresh checkouts receive the declared line endings automatically.

## Database

See the [MVP database design](docs/database-design.md) for the data model and
ownership rationale. The committed `supabase/migrations/` directory records
versioned schema changes; the design document also records earlier decisions
and deferred behavior. Deployment checks the required hosted schema before
releasing a new Worker.

With Docker running, recreate and validate the local database:

```sh
npx supabase start
npx supabase db reset
npx supabase db lint --local --level warning --fail-on warning
```

### Application configuration

The browser and server use two public Supabase values. Set them in a local
`.env` file (git-ignored) or the deployment environment:

- `PUBLIC_SUPABASE_URL`: the API URL. For local development, use
  `http://127.0.0.1:54321`, which `npx supabase start` serves. For the hosted
  project, copy the Project URL from Project Settings → Data API. It looks like
  `https://<project-ref>.supabase.co`.
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the anon (publishable) key from the same page.
  Never use the service-role key; it bypasses row-level security.

Svelte checks and production builds also need both public values. The
`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` entries in `.env.example` are
separate from the `PUBLIC_` values imported by the application.

Live analysis and document chat require the server-only `OPENAI_API_KEY` and
`ENABLE_PAID_ANALYSIS=1` for approved provider calls. The analysis route also
uses `ANALYSIS_ACCESS_TOKEN` for its internal pipeline handoff. Keep both
credentials out of the repository and browser. The example configuration
defaults paid analysis to `0`; the deployed Worker's flag is configured
separately. See [production deployment](docs/deployment.md) for the release gate
and hosted schema check.

## Verification

See [Windows setup verification](docs/windows-setup-verification.md) for issue #4
reproduction, results, and remaining peer-review checks.

## Testing

See [Testing and CI](docs/testing-and-ci.md) for setup, test boundaries, and the
CI workflow. The main local commands are:

```sh
npm test
npm run test:coverage
npm run test:watch
npm run test:offline
npm run test:stage1:offline
npm run test:schema-readiness
npm run test:db
npx playwright install chromium
npm run test:e2e
```

`test:db` needs a disposable local Supabase database and a container runtime.
The offline suites use fixtures and mocked providers; CI does not make paid
model calls. `test:coverage` reports Vitest line and branch coverage, while
database and browser tests provide separate evidence.

The end-to-end suite starts the local Vite development server automatically.
CI installs Chromium with `npx playwright install --with-deps chromium` before
running the suite. Pull requests run anonymous browser checks; the dedicated
account's authenticated checks run on trusted pushes to `main`.
The CI and deployment workflows use `actions/checkout@v5` and
`actions/setup-node@v5`, whose action runtime is Node 24. They still install the
application's Node version from `.nvmrc` (`22.20.0`); this action update does not
change local setup or application runtime requirements.

## Production deployment

See [Production deployment](docs/deployment.md) for domain configuration, the
validation-to-release workflow, required settings, and verification.
