# Windows setup verification (issue #4)

## Environment and reproduction

Tested on Windows x64 with Node 24.20.0 and npm 11.19.0 on 2026-09-11.
The fix branch starts from `origin/main` commit `14d9cfc` in a new Git worktree
with no dependencies, build output, or local secret files copied into it.

The unchanged checkout failed `npm ci` with
`Missing: @img/sharp-win32-arm64@0.35.2 from lock file`.
Regenerating package-lock metadata with `npm install --package-lock-only
--ignore-scripts` allowed a clean install of 212 packages. The repair adds
optional/bundled metadata and removes unused optional peer entries; existing
package versions are preserved.

## Fixes

- Repair the lockfile and pin the already-resolved Wrangler version, 4.130.0.
- Generate and verify Cloudflare types through `scripts/worker-types.js`.
  Remove only the generated SvelteKit Worker import. Retain `GlobalProps`,
  including the runtime declaration referenced by other generated types. Ensure
  the project declaration exists even before the first build for stable output.
  The wrapper compares the full normalized generated content rather than the
  upstream hash, which changes when build output exists.
- Keep runtime and environment types, application `checkJs`, and strict
  TypeScript checking enabled.
- Add a Git LF text policy and exclude Wrangler-generated declarations from
  Prettier and ESLint. The large generated-file diff reflects Wrangler output
  replacing previously formatted output.
- Document reproducible setup and the workaround in the README.

The Worker import issue is also reported on macOS in
[cloudflare/workers-sdk#14181](https://github.com/cloudflare/workers-sdk/issues/14181).
It is not specific to Windows. The wrapper should be reevaluated when the
upstream fix is available; its experimental API dependency is why Wrangler is
pinned.

## Verification results

The complete sequence was repeated in a second fresh worktree of committed fix
`d23b15b`, starting without dependencies or build output. Clean installation,
check/lint, build, regeneration, and check/lint again all passed. Regeneration
after the build produced no tracked diff, and the verification checkout remained
clean. No local repair or formatting command was needed in that checkout.

- `npm ci --no-audit --no-fund`: passed after lockfile repair.
- `npm run check` before build: 0 errors, 0 warnings.
- `npm run lint` before build: passed.
- `npm run build`: passed, including Cloudflare adapter output.
- `npm run gen:check` after build: passed without regenerating types.
- `npm run check` after build: 0 errors, 0 warnings.
- `npm run lint` after build: passed.
- Temporarily add a Wrangler variable: `gen:check` fails as expected; restoring
  the configuration makes it pass. No test binding is retained.
- `npm run dev -- --host 127.0.0.1 --port 5184 --strictPort`: HTTP 200 with
  expected starter-page text.
- `npm run preview`: HTTP 200 on port 4173 with expected starter-page text.
  Both verification servers were stopped afterward.

npm 11.19.0 reports install-script policy warnings for esbuild and workerd; the
build and local preview nevertheless passed in this environment.

## Peer review still needed

### Copilot review follow-up

Removed the empty-interface deletion rule. In the tested Wrangler output it
removed the tab-indented project declaration, while the separate space-indented
runtime declaration remained present. Nevertheless, deleting declarations by
that pattern was fragile and the documentation was too broad.

The wrapper now retains both declarations and inserts an empty project
`GlobalProps` when Wrangler omits it before the first build. Verified that
`gen:check` and application checks pass with Worker output absent and restored;
the production build and lint also pass. Runtime declarations are unchanged.

### Remaining checks

- Repeat the fresh-checkout sequence in the README on another Windows machine.
- Run the same sequence on macOS or Linux and with the team's Node 22 setup.
- Review the lockfile metadata changes and the narrowly scoped Wrangler
  workaround. This verification does not cover a production deployment or
  visual browser interaction.
