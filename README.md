# ClearConsent

Privacy Translator & Data Footprint Map, built with SvelteKit, TypeScript,
Tailwind, and the Cloudflare Workers adapter.

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
npm run check
npm run lint
npm run build
```

Use `npm ci` for an existing checkout so dependencies follow the committed
lockfile. Use `npm install` when intentionally changing dependencies and review
the lockfile diff. A clean installation does not require regenerating types.

In PowerShell, if execution policy blocks `npm.ps1`, use `npm.cmd` in place of
`npm` in these commands. No execution-policy change is required.

The starter application uses local Cloudflare emulation. No Cloudflare login,
API key, or LLM credentials are required for these local checks. Publishing to
Cloudflare is a separate authenticated operation. Future remote bindings may
introduce additional setup requirements.

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

## User study walkthrough

The entry page at `/` links to registration and sign-in. A confirmed account
opens the dashboard after sign-in; returning sessions go there directly. The
dashboard opens the URL input by default and links to Paste Text, Preferences,
and sign-out. URL input extracts policy text, and Paste Text accepts text for
submission. The dashboard shows an empty state for recent analyses because
saved history is not connected yet.

Preferences is a temporary study preview. Its answer style and detail controls
change an invented example on that page only; they are not saved and do not
change analysis output. The current forms do not produce a completed policy
analysis. Use this walkthrough to study navigation, layout, and expectations;
evaluate analysis quality once a result is connected. The visual design is still
in progress.

## Stage 1 policy analysis

See [Stage 1 server analysis](docs/stage-1-analysis.md) for the protected plain-text
analysis endpoint, private OpenAI configuration, source-reference convention,
synthetic examples, local verification, and deferred integration decisions.

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

See the [MVP database design](docs/database-design.md) for the schema, ER
diagram, ownership policies, retention behavior, synthetic records, example
queries, and deferred decisions.

With Docker running, recreate and validate the local database:

```sh
npx supabase start
npx supabase db reset
npx supabase db lint --local --level warning --fail-on warning
```

### Supabase environment variables

The server reads two variables. Set them in a local `.env` file (git-ignored;
copy `.env.example`) or as Cloudflare secrets for deployment.

- `SUPABASE_URL`: the API URL. For local development, use
  `http://127.0.0.1:54321`, which `npx supabase start` serves. For the hosted
  project, copy the Project URL from Project Settings → Data API. It looks like
  `https://<project-ref>.supabase.co`.
- `SUPABASE_PUBLISHABLE_KEY`: the anon (publishable) key from the same page.
  Never use the service-role key; it bypasses row-level security.

The server fails requests that need the database when either variable is missing.

## Verification

See [Windows setup verification](docs/windows-setup-verification.md) for issue #4
reproduction, results, and remaining peer-review checks.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Testing

See [Testing and CI](docs/testing-and-ci.md) for the test-file map, local setup,
and CI workflow. Run the Vitest suite once, or keep it running while
developing:

```sh
npm test
npm run test:watch
npx playwright install chromium
npm run test:e2e
```

The end-to-end suite starts the local Vite development server automatically.
CI installs Chromium with `npx playwright install --with-deps chromium` before
running the suite.
The CI and deployment workflows use `actions/checkout@v5` and
`actions/setup-node@v5`, whose action runtime is Node 24. They still install the
application's Node version from `.nvmrc` (`22.20.0`); this action update does not
change local setup or application runtime requirements.

## Production deployment

See [Production deployment](docs/deployment.md) for domain configuration, the
validation-to-release workflow, required settings, and verification.
