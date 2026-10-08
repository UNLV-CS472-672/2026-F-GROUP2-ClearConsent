# Stage 1 server analysis

This implementation accepts already-ingested policy text at `POST /api/analyze`, freezes that exact
text, assigns deterministic source passages, requests evidence candidates from a server-only OpenAI
adapter, and reconstructs every accepted excerpt from the frozen source. It implements only steps
1–3 of the [two-stage workflow proposal](design/issue-17/workflow-proposal.md).

The Stage 1 types are intentionally internal. They do not replace the public `Finding` and result
schemas owned by issue #22, and they do not perform consolidation, personalized scoring, persistence,
URL retrieval, or PDF/HTML parsing.

## Current bounds

| Setting           |                           Enforced value |
| ----------------- | ---------------------------------------: |
| Source text       |                 30,000 UTF-16 code units |
| Passage target    |                  1,800 UTF-16 code units |
| Provider calls    |                                      One |
| Automatic retries |                                     Zero |
| Attempt count     |                                      One |
| Provider timeout  |                               30 seconds |
| Maximum output    | 8,000 tokens, including reasoning tokens |
| Default model     |                             `gpt-6-luna` |
| Default reasoning |                                 `medium` |

The model and reasoning effort are configurable. The bounds are deliberately conservative for issue
#7's short-policy demonstration. Larger inputs fail with `input_too_large`; they are never silently
truncated. Long-policy chunking, parallel extraction, and retry orchestration remain deferred.

At the OpenAI pricing published when this implementation was written, the 8,000-token output ceiling
for `gpt-6-luna` costs at most $0.004 in output tokens. Input cost depends on actual tokenization and
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

The OpenAI SDK is pinned and configured with `maxRetries: 0`, `logLevel: "off"`, a 30-second timeout, `store: false`, no
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
IDs. Code assigns those values. Each returned excerpt must occur exactly once inside its cited passage;
unknown IDs, blank or too-short excerpts, invented wording, duplicate passage IDs, ambiguous repeated
matches, malformed objects, and out-of-range mappings fail the stage.

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

`no_candidates` is a separate Stage 1 outcome. It is not a provider failure, a public `success`, a
safety conclusion, or a low-risk result. Provider refusals, output truncation, timeouts, rate limits,
quota/billing failures, credential failures, malformed output, and invalid references remain distinct
failure codes.

Logs contain only outcome, duration, source length, candidate count, model, attempt count, and aggregate
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
- `npm test` passed all 40 tests across 8 files after the follow-up review.
- `npm run check` passed with 0 errors and 0 warnings.
- `npm run lint` passed.
- `npm run build` passed.
- A local Cloudflare preview request to `POST /api/analyze` returned HTTP 503 with
  `analysis_disabled` while `ENABLE_PAID_ANALYSIS` was unset, confirming that the route cannot spend
  provider budget by default.

Wrangler's environment inference was disabled for the deterministic `check`, `build`, and preview
commands so private `.env.local` variable names did not alter the generated Worker type file. No
secret values were read into test fixtures or committed. No paid provider call was made.

The follow-up review added real-SDK tests with a fake HTTP transport. These verify complete candidate
parsing, distinct malformed-JSON and truncated-output errors, and exactly one HTTP attempt for 429/500
responses. They also verify that SDK debug logging cannot expose submitted text. Ordinary tests remain
fully offline. Additional source tests reject invalid source maps and malformed Unicode.

## Decisions still owned elsewhere

- Issue #22 must settle the public category taxonomy, whether `practice` remains, ambiguity/state
  representation, confidence semantics, final analysis/finding IDs, and public source extensions.
- Issue #22 must map internal `no_candidates` into its public `insufficient`/result model without
  creating an empty successful finding set.
- Issue #12 owns deterministic preference scoring from canonical findings, not these raw candidates.
- The production owner must add authenticated per-user authorization and a rate limit before enabling
  paid calls outside the controlled local demonstration.
- Stage 2 consolidation, long-document chunking, provider benchmarking, persistence, and deployment are
  not implemented here.

No live paid smoke test is recorded in this document. The deterministic tests use only injected mock
providers; a real smoke result must record the tested commit, model, environment, usage, and outcome
after separate authorization.
