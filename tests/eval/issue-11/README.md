# Issue 11: privacy-policy model comparison

This directory contains the exploratory work for [issue #11](https://github.com/UNLV-CS472-672/2026-F-GROUP2-ClearConsent/issues/11): a manual comparison of `gpt-6-luna` and `gpt-5.6-terra` for ClearConsent's privacy-policy extraction task. It is separate from production integration, other issues' evals, and the normal test suites.

## Directory map

- `fixtures/` — committed short cases, full archived policies, review anchors, and the compact 73-finding Spotify snapshot used by the labeled-readout experiment.
- `scripts/` — eval configurations, opt-in runners, offline summaries, policy import, and report renderers.
- `reports/` — self-contained Markdown records of completed runs and reviews, including their model inputs and outputs.
- `results/` — local raw JSONL responses, intentionally Git-ignored. `.env.local` at the repository root is also ignored.
- `offline.test.mjs` — checks that use only committed fixtures; no API calls or local result logs are required.

Historical report renderers in `scripts/render-*.mjs` still need their corresponding ignored raw JSONL files if you choose to regenerate a report. The committed reports can be read without those files. Moving files here did not rerun any eval.

For a plain-language explanation of the runner and the completed Luna-only passes, see [EVALUATION_PLAN.md](EVALUATION_PLAN.md).
The [first run](reports/LUNA_SHORT_RUN_2026-09-24.md) and [tightened-prompt retest](reports/LUNA_SHORT_RETEST_2026-09-24.md) each include all 14 actual inputs and outputs.
The separate [full-policy Luna report](reports/LUNA_FULL_RUN_2026-09-24.md) shows one pass over the complete archived Spotify and Facebook files, with both saved outputs and links to the exact full-text inputs.
The [source-grounded full-policy retest](reports/LUNA_GROUNDED_FULL_RUN_2026-09-24.md) keeps Luna on medium, lets it cite numbered source lines, and reports both the improved qualification handling and a missed Facebook no-sale statement.
The [bounded-section Luna test](reports/LUNA_SECTIONED_FULL_RUN_2026-09-24.md) reports the later 15-call workflow, its actual outputs, a six-claim coverage check, one invalid citation, and total estimated token cost including stopped attempts.
The [manual spot-check](reports/LUNA_SECTIONED_REVIEW_2026-09-24.md) reviews a reproducible 30-finding sample from that run against the pinned policy text; it is an editorial quality check, not a full accuracy score.
The [labeled Spotify readout](reports/LUNA_LABELED_SPOTIFY_READOUT_2026-09-24.md) documents a single Luna-medium consolidation pass over the 73 saved Spotify findings, with `reason` before `label`, the complete API input and output, cost, and manual caveats. The separate `run-labeled-readout.mjs` defaults to an offline `--estimate`; a paid `--run` requires the same explicit opt-in and ceiling as the other runners. It does not run in normal tests or repeat the extraction.
The [direct labeled Spotify test](reports/LUNA_DIRECT_LABELED_SPOTIFY_2026-09-24.md) instead sends the full archived policy itself to Luna, with no saved findings. It includes the complete request and response, cost, human citation review, and a cautious comparison with the two-stage experiment. `run-direct-labeled-eval.mjs --estimate` is offline; its paid `--run` remains opt-in. Neither experimental script is a production workflow.
The [single direct Terra comparison](reports/TERRA_DIRECT_LABELED_SPOTIFY_2026-09-24.md) repeats that policy-to-readout request with only the model ID changed to `gpt-5.6-terra`; it records Terra's actual input/output, cost, and a source-grounded comparison. `run-direct-labeled-eval.mjs --estimate --model gpt-5.6-terra` is offline. The completed Terra call does not authorize another run.

## Cases and review status

- [`fixtures/privacy-policy-cases.json`](fixtures/privacy-policy-cases.json) has 10 fictional excerpts that cover collection, sharing, sale, retention, deletion, security, children's data, ambiguity, missing information, and location precision.
- [`fixtures/archived-policy-cases.json`](fixtures/archived-policy-cases.json) has four short excerpts from Facebook, Spotify, and Netflix privacy policies. Each entry identifies its archive collection, document, exact Git commit, and source URL. The Facebook and Spotify entries also record the effective date printed in the document.
- [`fixtures/full-policy-cases.json`](fixtures/full-policy-cases.json) has the entire archived Markdown files for Spotify and Facebook privacy policies at the same pinned commits used by the short excerpts. No sections were removed from those archive files. These full-document cases are **unlabeled** and need independent human review; an empty findings list would incorrectly imply that the policies contain no relevant practices.
- [`fixtures/full-policy-review-checklist.json`](fixtures/full-policy-review-checklist.json) holds six manually selected source anchors for previously missed or important claims. It is withheld from prompts. A matching citation is only a coverage proxy, not a comprehensive human-reviewed label or proof of correct interpretation.
- [`fixtures/spotify-sectioned-findings.json`](fixtures/spotify-sectioned-findings.json) is a compact copy of the 73 Spotify extraction findings from the completed sectioned run. It contains only the fields later passed to the labeled-readout request; it is not human-verified ground truth. It lets offline checks and estimates work in a fresh clone while raw logs remain ignored.

The labels in both files are **drafts awaiting independent human review**. They were written without querying either comparison model. Reviewers should correct the expected findings and exact evidence before the final run, and record that approval in a commit. Do not send `expectedFindings` or `source` metadata to the models; the runner sends only `policyText`.

The archived excerpts come from [Platform Governance Archive v2](https://github.com/OpenTermsArchive/pga-versions) and [Open Terms Archive's contributor collection](https://github.com/OpenTermsArchive/contrib-versions). Both repositories state an attribution requirement. Keep the archive links and collection credits when reusing these excerpts. The examples are public policy text; do not add private policies or customer data.

The complete files come from the [Platform Governance Archive v2 dataset](https://github.com/OpenTermsArchive/pga-versions), curated by the Lab Platform Governance, Media and Technology at ZeMKI, University of Bremen, with Open Terms Archive. The dataset requests attribution to the project and the exact version; each case includes its pinned URL and Git blob SHA. The archive itself selects policy content and removes navigation/noise, so “complete” here means the entire archived Markdown file, not every element of the original web page. To refresh these exact pinned copies, run `node tests/eval/issue-11/scripts/import-full-policies.mjs` with the GitHub CLI installed and authenticated; this fetches public archive text only and makes no model calls.

The default `run-eval.mjs` **does not load** `full-policy-cases.json`. Its 12 KB request cap and current cost estimate apply only to the 14 short cases. The separate `run-full-eval.mjs` ran the first complete-policy pass; `run-grounded-full-eval.mjs` ran the source-grounded retest. Both select only the two full policies and Luna at medium reasoning for one pass. These runs are exploratory and unlabeled. Do not assume the default `--run` command tests complete policies.

## Frozen comparison setup

[`eval-config.mjs`](scripts/eval-config.mjs) records the shared prompt, JSON schema, model IDs, reasoning levels, two repetitions, 8,000 maximum output tokens, a request-size cap, timeout, and pricing assumptions. Both models receive exactly the same prompt, policy text, schema, and output-token limit at each effort level. The configurations are:

| Model           | Reasoning effort  |
| --------------- | ----------------- |
| `gpt-6-luna`    | low, medium, high |
| `gpt-5.6-terra` | low, medium, high |

With 14 cases and two repetitions, a full run makes **168 API requests**. The 8,000-token output limit includes reasoning tokens, so an incomplete response is recorded as a failure rather than silently retried. There are no automatic retries.

The short-case runner also accepts `--model`, `--effort`, and `--repeats` to narrow the run. Both completed Luna-only short passes used `--model gpt-6-luna --effort medium --repeats 1`, for 14 requests each. The second pass used the tighter evidence instruction now in `eval-config.mjs`. Without those flags, `--run` still means the full 168-request comparison. The two complete policies were tested separately with `run-full-eval.mjs`.

The schema here is evaluation-only until the shared application contract in [issue #6](https://github.com/UNLV-CS472-672/2026-F-GROUP2-ClearConsent/issues/6) is settled. Align the schema and prompt with that contract before treating the outcome as a production model recommendation.

## Cost and manual execution

The runner makes no request unless all three conditions hold: it is invoked with `--run`, `RUN_MODEL_EVALS=1` is set, and `EVAL_APPROVED_MAX_USD` is at least its conservative cost estimate. The key must be provided in `OPENAI_API_KEY`. A root `.env.local` works with Node's `--env-file` option and is ignored by Git. Never put a real key in a committed fixture or result.

After reviewing the fixtures and securing budget approval, a team member can estimate and run the **default full comparison** manually:

```sh
node tests/eval/issue-11/scripts/run-eval.mjs --estimate
RUN_MODEL_EVALS=1 EVAL_APPROVED_MAX_USD=12 node --env-file=.env.local tests/eval/issue-11/scripts/run-eval.mjs --run
```

The second command is an example, not a standing budget approval. Check the current estimate and [OpenAI pricing](https://developers.openai.com/api/docs/pricing) before using it. The estimate assumes standard, short-context text pricing as of September 23, 2026; the actual bill depends on usage and current account pricing. Each request has a 12,000-byte payload cap and an 8,000-token output cap. No tool calls are enabled. For stronger account-level protection, set a project spend limit in the OpenAI dashboard.

For a Luna-only one-pass estimate, use `node tests/eval/issue-11/scripts/run-eval.mjs --estimate --model gpt-6-luna --effort medium --repeats 1`. The [first run](reports/LUNA_SHORT_RUN_2026-09-24.md) and [retest](reports/LUNA_SHORT_RETEST_2026-09-24.md) record already-completed paid calls; these reports are **not** permission to repeat them.

Results are written after each response to `results/*.jsonl`, which Git ignores. A failed request stops the run without retrying or overwriting previous results. The runner logs case IDs and validation status, not the API key or full policy text. To summarize a completed local file:

```sh
node tests/eval/issue-11/scripts/summarize-results.mjs tests/eval/issue-11/results/<run-file>.jsonl
```

The first full-policy run used a 25,000-token output cap per call. Its initial cost estimator missed cache-write pricing; the [first full-policy report](reports/LUNA_FULL_RUN_2026-09-24.md) documents the corrected actual-usage estimate. The estimator has been corrected and now refuses another run under the earlier $0.10 ceiling with those settings. The [source-grounded retest](reports/LUNA_GROUNDED_FULL_RUN_2026-09-24.md) used lower per-case output caps and a corrected conservative allowance. A report of a completed run is not permission to repeat it.

The separate `run-sectioned-full-eval.mjs` partitions each policy into bounded core ranges with three adjacent context lines, keeps original line IDs, and makes one Luna-medium call per range. Its `--estimate` path is offline. The completed result used two Spotify calls and thirteen Facebook calls; earlier small-cap attempts were stopped on incomplete responses. See the [bounded-section report](reports/LUNA_SECTIONED_FULL_RUN_2026-09-24.md) for the saved outputs and all-attempt cost accounting. It does not run as part of the default eval command or normal tests.

## How to judge the result

The offline summary reports schema success, evidence/reference success, latency, input/output/reasoning tokens, estimated token cost, and exact agreement between repeated finding structures. In the older runs, evidence success means Luna's free-text quote matched the source exactly. In the grounded run, it means every cited line ID resolved, and code copied the raw source line. Those are **different measures**, and neither proves a claim is supported or complete. Exact repeat agreement is a strict consistency signal, not a semantic quality score.

Human reviewers should grade the model findings without seeing the model name when practical. For each case, match predicted claims against the reviewed expected findings by meaning, not by identical wording. Record true positives, false positives, and false negatives; calculate precision, recall, and F1 from those counts. Separately count claims not supported by the supplied text, incorrect data categories/purposes/recipients, ambiguity handled as certainty, and a 1–5 plain-language clarity rating. These judgments cannot be inferred reliably from an exact string comparison.

Before the paid final run, commit the reviewed labels, the grading rubric and weights, and any prompt/schema changes. Use the qualification and tie-break rule stated in [issue #11](https://github.com/UNLV-CS472-672/2026-F-GROUP2-ClearConsent/issues/11): at least 95% schema success, no more than 5% unsupported claims, no ambiguous claim asserted as certain, then the highest predefined quality score; within three percentage points, choose the lower-cost configuration. Report synthetic and archived cases separately as well as together.

The only automated checks for this directory are deliberately invoked with:

```sh
node --test tests/eval/issue-11/offline.test.mjs
```

They do not make API requests. The default Vitest configuration includes only `src/**/*.test.ts`, Playwright uses only `tests/e2e`, and CI runs those existing commands without an eval opt-in.
