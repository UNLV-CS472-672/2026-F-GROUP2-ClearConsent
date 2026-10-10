# Stage 1 server analysis

This implementation accepts already-ingested policy text at `POST /api/analyze`, freezes that exact
text, assigns deterministic source passages, requests evidence candidates from a server-only OpenAI
adapter, and reconstructs every accepted excerpt from the frozen source. It implements only steps
1–3 of the [two-stage workflow proposal](design/issue-17/workflow-proposal.md).

The Stage 1 types are intentionally internal. They do not replace the public `Finding` and result
schemas owned by issue #22, and they do not perform consolidation, personalized scoring, persistence,
URL retrieval, or PDF/HTML parsing.

## Current bounds

| Setting           |                            Enforced value |
| ----------------- | ----------------------------------------: |
| Source text       |                  60,000 UTF-16 code units |
| Request body      |   Derived from field limits; read bounded |
| Passage target    |                   1,800 UTF-16 code units |
| Provider calls    |                                       One |
| Automatic retries |                                      Zero |
| Attempt count     |                                       One |
| Provider timeout  |                                90 seconds |
| Maximum output    | 16,000 tokens, including reasoning tokens |
| Default model     |                              `gpt-6-luna` |
| Default reasoning |                                  `medium` |

The model and reasoning effort are configurable. `OPENAI_TIMEOUT_MS` and `OPENAI_MAX_OUTPUT_TOKENS`
can override the timeout and output cap up to hard ceilings of 120 seconds and 32,000 tokens; values
outside that range fail with `configuration_error`.

The bounds are sized for a Spotify-sized policy in one call. In the issue #11 source-grounded run, the
complete 47k-character Spotify policy took 54.3 seconds and 8,642 output tokens, which would have
exceeded the earlier 30-second and 8,000-token caps. Larger inputs fail with `input_too_large`; they
are never silently truncated. The same runs found far fewer of the checklist claims with one call per
policy than with one call per bounded section, so long-policy chunking remains the intended follow-up,
along with parallel extraction and retry orchestration.

At the OpenAI pricing published when this implementation was written, the 16,000-token output ceiling
for `gpt-6-luna` costs at most $0.008 in output tokens. Input cost depends on actual tokenization and
prompt overhead, so record returned usage instead of treating character count as an exact cost limit.
See the official [GPT-6 Luna model page](https://developers.openai.com/api/docs/models/gpt-6-luna).

## Private configuration and access boundary

Copy the names from `.env.example` into a private `.env.local` file and supply your own values:

```dotenv
OPENAI_API_KEY=replace-with-a-private-server-key
OPENAI_MODEL=gpt-6-luna
OPENAI_REASONING_EFFORT=medium
ENABLE_PAID_ANALYSIS=1
ANALYSIS_ACCESS_TOKEN=replace-with-a-random-local-token
```

`OPENAI_API_KEY` and `ANALYSIS_ACCESS_TOKEN` are read only from SvelteKit's server-private dynamic
environment. They are never returned or logged. The route refuses provider calls unless the paid-call
flag is exactly `1` and the caller supplies `Authorization: Bearer <ANALYSIS_ACCESS_TOKEN>`.

This shared token is a narrow local demonstration boundary, not the final production authorization or
per-user rate limit. Keep `ENABLE_PAID_ANALYSIS=0` in deployed environments until authentication,
authorization, and rate limiting are agreed. Cloudflare secrets must be configured as encrypted Worker
secrets rather than committed variables.

The OpenAI SDK is pinned and configured with `maxRetries: 0`, `logLevel: "off"`, a 90-second timeout, `store: false`, no
tools, and `truncation: "disabled"`. Official OpenAI documentation recommends Structured Outputs for
schema-constrained responses and notes that SDKs retry eligible failures unless retries are disabled:

- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)
- [Responses API reference](https://developers.openai.com/api/reference/typescript/resources/responses/methods/create)
- [Rate-limit and retry guidance](https://developers.openai.com/api/docs/guides/rate-limits)

## Local request

Start the app:

```sh
npm run dev
```

Then send the committed synthetic request. This command makes one paid provider attempt and must be run
only with an approved key and budget:

```sh
curl --fail-with-body \
  -X POST http://127.0.0.1:5173/api/analyze \
  -H "Authorization: Bearer $ANALYSIS_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @docs/examples/stage1-request.json
```

`docs/examples/stage1-response.json` is a handcrafted example of the validated internal response. It
is not represented as the output of a live model call. Run the deterministic server-boundary demo with:

```sh
npm test -- src/lib/server/analysis/http.test.ts
```

## Source references

The server hashes the exact received text as UTF-8 to create the snapshot identity. It divides the
unchanged JavaScript string into contiguous passages without rejoining or trimming fragments. Offsets
are zero-based, start-inclusive, end-exclusive UTF-16 indexes, so this invariant always holds:

```ts
frozenText.slice(startOffset, endOffset) === excerpt;
```

The model receives passage IDs and text but does not supply source offsets, snapshot IDs, or candidate
IDs. Code assigns those values. Each returned excerpt must occur exactly once inside its cited passage.

A candidate is dropped when any of its evidence fails: an unknown passage ID, a blank or too-short
excerpt, invented or altered wording, or an excerpt repeated inside its passage. Blank required fields
also drop it. The whole candidate is dropped, not only the failed excerpt, because that excerpt may have
been the one supporting a condition or exception. Each dropped candidate appears in `rejectedCandidates`
with its position in the provider output, its unverified claim, an error code, and the reason. Surviving
candidates are numbered `C001` onward without gaps. If every candidate fails, the stage fails with
`reference_validation_failed`. A provider response that does not match the schema at all still fails
the stage.

Input containing unpaired UTF-16 surrogates is rejected before a provider call. This prevents UTF-8
replacement encoding from giving different malformed strings the same source identity. Valid emoji,
surrogate pairs, and leading byte-order-mark characters are preserved exactly.

This is structural and referential validation only. Exact text location does not prove that the model's
claim correctly interprets the excerpt or that the extraction found every material practice. Those
questions require semantic review and the controlled evaluation described in issue #11/#17.

## Outcomes and errors

`complete` means the one supported source range received a structurally and referentially valid Stage 1
result. It does not mean the whole analysis is complete. Every successful response therefore keeps
`analysisStatus: "in_progress"` and points to the later consolidation stage.

`partial` means at least one candidate was verified and at least one was dropped. Every returned
candidate is still fully verified; the dropped ones are listed in `rejectedCandidates` and must not be
shown as findings.

`no_candidates` is a separate Stage 1 outcome. It is not a provider failure, a public `success`, a
safety conclusion, or a low-risk result. Provider refusals, output truncation, timeouts, rate limits,
quota/billing failures, credential failures, malformed output, and invalid references remain distinct
failure codes. A provider 400 or 404, which usually means `OPENAI_MODEL` or another setting is wrong,
returns `provider_rejected_request`. Unexpected server-side exceptions return `internal_error` (HTTP 500)
rather than being reported as provider outages.

Request bodies are read only up to `MAX_REQUEST_BODY_BYTES` in `http.ts`; larger bodies fail with
`input_too_large` before JSON parsing or any provider call.

Logs contain only outcome, duration, source length, candidate and rejected counts, model, attempt count, and aggregate
usage. Full submitted text, credentials, provider error bodies, and preferences are excluded.

## Stage 2 handoff

The response keeps validated candidates beside the complete passage-to-range map. A later consolidation
stage must receive both; claims alone are not enough. Optional user preferences are copied into a
separate `downstream.preferences` object and never enter the Stage 1 provider prompt. Consolidation must
preserve distinct practices and account for every candidate before an analysis can become complete.

## Verification record

Verified locally on October 7, 2026 from base commit
`6cb7301a79c14b499640678ae1e9ff6bd05c7c57`, using Node `v22.23.2` and npm `10.9.8`:

- `npm ci` completed successfully. npm reported the repository's existing audit total of 10
  vulnerabilities (3 low and 7 high); no automatic dependency rewrite was performed.
- `npm test` passed all 55 tests across 8 files after the second review.
- `npm run check` passed with 0 errors and 0 warnings.
- `npm run lint` passed.
- `npm run build` passed.
- A local Cloudflare preview request to `POST /api/analyze` returned HTTP 503 with
  `analysis_disabled` while `ENABLE_PAID_ANALYSIS` was unset, confirming that the route cannot spend
  provider budget by default.

`scripts/worker-types.js` sets `CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false` before generating types
for `check` and `build` so private `.env.local` variable names did not alter the generated Worker type file. No
secret values were read into test fixtures or committed. No paid provider call was made.

The follow-up review added real-SDK tests with a fake HTTP transport. These verify complete candidate
parsing, distinct malformed-JSON and truncated-output errors, and exactly one HTTP attempt for 429/500
responses. They also verify that SDK debug logging cannot expose submitted text. Ordinary tests remain
fully offline. Additional source tests reject invalid source maps and malformed Unicode.

## Decisions still owned elsewhere

- Issue #22 must settle the public category taxonomy, whether `practice` remains, ambiguity/state
  representation, confidence semantics, final analysis/finding IDs, and public source extensions.
- Issue #22 must decide how a `partial` Stage 1 result and its dropped candidates appear publicly.
- Issue #22 must map internal `no_candidates` into its public `insufficient`/result model without
  creating an empty successful finding set.
- Issue #12 owns deterministic preference scoring from canonical findings, not these raw candidates.
- The production owner must add authenticated per-user authorization and a rate limit before enabling
  paid calls outside the controlled local demonstration.
- Stage 2 consolidation, long-document chunking, provider benchmarking, persistence, and deployment are
  not implemented here.

## Live smoke test

One authorized paid request was sent on October 10, 2026 at 01:20 UTC.

| Item           | Value                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------- |
| Tested code    | Commit `b7f820c` plus the uncommitted second-review fixes staged on that branch          |
| Environment    | `npm run preview` (local Wrangler 4.130.0 Workers runtime), macOS, Node `v22.23.2`       |
| Request        | `docs/examples/stage1-request.json` (396 UTF-16 code units, one passage)                 |
| Model          | `gpt-6-luna`, reasoning effort `medium`, one attempt                                     |
| Outcome        | HTTP 200, `stageStatus: "complete"`, five candidates, every excerpt resolved exactly     |
| Duration       | 7.4 seconds                                                                              |
| Usage          | 597 input, 799 output (123 reasoning), 1,396 total tokens                                |
| Estimated cost | About $0.0005 at the `gpt-6-luna` rates in `tests/eval/issue-11/scripts/eval-config.mjs` |

The candidates covered location collection, opt-in advertising sharing, the Settings opt-out, the
no-sale statement (qualified as not proving no sharing), and 30-day deletion with its legal-obligation
exception. The cost is a token-based estimate, not an invoice. Wrangler loaded the private values from
`.env.local` as local Worker variables; the server log line contained only outcome, duration, source
length, candidate count, model, attempts, and usage.

An earlier attempt the same day used a revoked key. It failed before generation with
`provider_authentication` (HTTP 502), and a wrong access token was rejected with HTTP 401 before any
provider call. Both confirm the failure paths on the Workers runtime.

This single short request shows the configuration and validation path works end to end. It does not
measure timeout or output-token headroom for inputs near the 60,000-character limit.

## Cloudflare deployment

Deployed Workers read these values from encrypted secrets, not `.env.local`:

```sh
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put ANALYSIS_ACCESS_TOKEN
```

Leave `ENABLE_PAID_ANALYSIS` unset or `0` in deployed environments until per-user authorization and rate
limiting exist. No deployed request has been made.
