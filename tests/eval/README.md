# Privacy-policy extraction evaluation

This directory contains a manual comparison of `gpt-6-luna` and `gpt-5.6-terra` for ClearConsent's privacy-policy extraction task. It is separate from production integration and the normal test suites.

## Cases and review status

- [`fixtures/privacy-policy-cases.json`](fixtures/privacy-policy-cases.json) has 10 fictional excerpts that cover collection, sharing, sale, retention, deletion, security, children's data, ambiguity, missing information, and location precision.
- [`fixtures/archived-policy-cases.json`](fixtures/archived-policy-cases.json) has four short excerpts from Facebook, Spotify, and Netflix privacy policies. Each entry identifies its archive collection, document, exact Git commit, and source URL. The Facebook and Spotify entries also record the effective date printed in the document.

The labels in both files are **drafts awaiting independent human review**. They were written without querying either comparison model. Reviewers should correct the expected findings and exact evidence before the final run, and record that approval in a commit. Do not send `expectedFindings` or `source` metadata to the models; the runner sends only `policyText`.

The archived excerpts come from [Platform Governance Archive v2](https://github.com/OpenTermsArchive/pga-versions) and [Open Terms Archive's contributor collection](https://github.com/OpenTermsArchive/contrib-versions). Both repositories state an attribution requirement. Keep the archive links and collection credits when reusing these excerpts. The examples are public policy text; do not add private policies or customer data.

## Frozen comparison setup

[`eval-config.mjs`](eval-config.mjs) records the shared prompt, JSON schema, model IDs, reasoning levels, two repetitions, 8,000 maximum output tokens, a request-size cap, timeout, and pricing assumptions. Both models receive exactly the same prompt, policy text, schema, and output-token limit at each effort level. The configurations are:

| Model           | Reasoning effort  |
| --------------- | ----------------- |
| `gpt-6-luna`    | low, medium, high |
| `gpt-5.6-terra` | low, medium, high |

With 14 cases and two repetitions, a full run makes **168 API requests**. The 8,000-token output limit includes reasoning tokens, so an incomplete response is recorded as a failure rather than silently retried. There are no automatic retries.

The schema here is evaluation-only until the shared application contract in [issue #6](https://github.com/UNLV-CS472-672/2026-F-GROUP2-ClearConsent/issues/6) is settled. Align the schema and prompt with that contract before treating the outcome as a production model recommendation.

## Cost and manual execution

The runner makes no request unless all three conditions hold: it is invoked with `--run`, `RUN_MODEL_EVALS=1` is set, and `EVAL_APPROVED_MAX_USD` is at least its conservative cost estimate. The key must be provided in `OPENAI_API_KEY`. A root `.env.local` works with Node's `--env-file` option and is ignored by Git. Never put a real key in a committed fixture or result.

After reviewing the fixtures and securing budget approval, a team member can estimate and run manually:

```sh
node tests/eval/run-eval.mjs --estimate
RUN_MODEL_EVALS=1 EVAL_APPROVED_MAX_USD=12 node --env-file=.env.local tests/eval/run-eval.mjs --run
```

The second command is an example, not a standing budget approval. Check the current estimate and [OpenAI pricing](https://developers.openai.com/api/docs/pricing) before using it. The estimate assumes standard, short-context text pricing as of September 23, 2026; the actual bill depends on usage and current account pricing. Each request has a 12,000-byte payload cap and an 8,000-token output cap. No tool calls are enabled. For stronger account-level protection, set a project spend limit in the OpenAI dashboard.

Results are written after each response to `results/*.jsonl`, which Git ignores. A failed request stops the run without retrying or overwriting previous results. The runner logs case IDs and validation status, not the API key or full policy text. To summarize a completed local file:

```sh
node tests/eval/summarize-results.mjs tests/eval/results/<run-file>.jsonl
```

## How to judge the result

The offline summary reports schema success, exact evidence-quote success, latency, input/output/reasoning tokens, estimated token cost, and exact agreement between repeated finding structures. Exact agreement is a strict consistency signal, not a semantic quality score.

Human reviewers should grade the model findings without seeing the model name when practical. For each case, match predicted claims against the reviewed expected findings by meaning, not by identical wording. Record true positives, false positives, and false negatives; calculate precision, recall, and F1 from those counts. Separately count claims not supported by the supplied text, incorrect data categories/purposes/recipients, ambiguity handled as certainty, and a 1–5 plain-language clarity rating. These judgments cannot be inferred reliably from an exact string comparison.

Before the paid final run, commit the reviewed labels, the grading rubric and weights, and any prompt/schema changes. Use the qualification and tie-break rule stated in [issue #11](https://github.com/UNLV-CS472-672/2026-F-GROUP2-ClearConsent/issues/11): at least 95% schema success, no more than 5% unsupported claims, no ambiguous claim asserted as certain, then the highest predefined quality score; within three percentage points, choose the lower-cost configuration. Report synthetic and archived cases separately as well as together.

The only automated checks for this directory are deliberately invoked with:

```sh
node --test tests/eval/offline.test.mjs
```

They do not make API requests. The default Vitest configuration includes only `src/**/*.test.ts`, Playwright uses only `tests/e2e`, and CI runs those existing commands without an eval opt-in.
