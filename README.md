# ClearConsent

Privacy Translator & Data Footprint Map, built with SvelteKit, TypeScript,
Tailwind, and the Cloudflare Workers adapter.

## Prerequisites

- Node.js `^22.13.0 || >=24` (Node 20 and 23 are unsupported).
- npm; the Windows setup fix is verified with Node `24.20.0` and npm `11.19.0`.
- Git.

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
npm run check
npm run lint
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

Preview normally serves `http://localhost:4173`. Both should display the SvelteKit
starter page. Stop the server with Ctrl+C.

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

## Verification

See [Windows setup verification](docs/windows-setup-verification.md) for issue #4
reproduction, results, and remaining peer-review checks.
