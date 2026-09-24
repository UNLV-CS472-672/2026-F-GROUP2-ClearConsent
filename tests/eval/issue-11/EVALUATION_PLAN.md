# Privacy-policy evaluation walkthrough

This explains what the local evaluation code does and how the GPT-6 Luna explorations were run. The [first short-case run](reports/LUNA_SHORT_RUN_2026-09-24.md), [tightened-prompt retest](reports/LUNA_SHORT_RETEST_2026-09-24.md), [first full-policy pass](reports/LUNA_FULL_RUN_2026-09-24.md), [source-grounded full-policy retest](reports/LUNA_GROUNDED_FULL_RUN_2026-09-24.md), and [bounded-section full-policy test](reports/LUNA_SECTIONED_FULL_RUN_2026-09-24.md) document the completed work. A later [single direct Terra comparison](reports/TERRA_DIRECT_LABELED_SPOTIFY_2026-09-24.md) used the same Spotify policy request as the [direct Luna run](reports/LUNA_DIRECT_LABELED_SPOTIFY_2026-09-24.md); this is exploratory, not the 168-call matrix described below.

## What goes in

There are two kinds of input:

- **Short cases:** 10 fictional excerpts in `fixtures/privacy-policy-cases.json` and four real, version-pinned excerpts in `fixtures/archived-policy-cases.json`. These isolate specific practices such as collection, sharing, retention, deletion, and ambiguous wording. Their `expectedFindings` are draft human labels; the runner does not send them to the model or automatically grade against them.
- **Full policies:** the complete archived Markdown files for Spotify and Facebook in `fixtures/full-policy-cases.json`. These test whether a model can find and explain practices throughout a long document. They have no expected-answer labels. We would inspect the output, not claim an accuracy score.

For the short cases and first full-policy pass, the model receives the fixed extraction instructions and only that case's `policyText`. The source-grounded full-policy retest prefixes each nonempty Markdown line with a stable line ID and asks Luna to cite IDs and state qualifications separately. Source links, draft expected findings, and other fixture metadata remain outside all prompts. Full-policy cases use separate runners, not the default short-case command.

## What comes out

The model is asked for structured JSON with an overall `summary` and a `findings` array. Each finding identifies a practice, data categories, purposes, recipients, a plain-language summary, an exact supporting quote, and `ambiguous`/`negated` flags. The shared prompt and schema are in `scripts/eval-config.mjs`. We use the Responses API's `text.format` JSON schema to request this shape; a valid shape does not guarantee factually correct findings. See the [official OpenAI Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs).

The runner saves each response to a local, Git-ignored `results/*.jsonl` file. It records the response, model and settings, latency, token usage, estimated token cost, whether the JSON has the expected shape, and whether every evidence quote appears exactly in the input. The offline summarizer groups those mechanical measures. It does **not** decide whether a claim is meaningful, whether important practices were missed, or whether the model misunderstood a qualification. A person must review those aspects against the policy text. The [official OpenAI evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices) similarly treats task-relevant human judgment as important to eval design.

## What the code would do if run today

`run-eval.mjs` uses only the 14 short cases. Without selection flags, it sends each case to both GPT-6 Luna and GPT-5.6 Terra at low, medium, and high reasoning effort, twice per configuration: **168 requests**. The `--model`, `--effort`, and `--repeats` flags can narrow that set. It has an 8,000-token output cap, a 12 KB request-size cap, no automatic retries, and explicit key, opt-in, and estimated-budget checks. The result file is local and ignored by Git. The `--estimate` mode makes no model requests. `run-full-eval.mjs` and `run-grounded-full-eval.mjs` are separate, fixed two-case Luna-only runners. The grounded runner's output caps are 11,000 and 14,000 tokens for Spotify and Facebook, respectively.

Do **not** use `--run` without selection flags expecting it to test only Luna or the full policies.

## Completed passes: Luna on short cases

The first paid run selected **Luna only, the 14 short cases, medium reasoning, and one pass**: 14 requests. After tightening the evidence instruction, a second pass used the same selection: another 14 requests. The first run had 11/14 cases with all literal evidence quotes; the retest had 13/14. The retest also had a new spliced-list quote failure and omitted a retention qualification in one otherwise literal finding. See the linked reports for the exact inputs, outputs, and limitations. The draft expected findings can help organize later review, but they are not approved ground truth.

Both separate full-policy passes used the same two complete archived files once each. They remain exploratory: read the findings and their evidence without reporting precision, recall, or an accuracy percentage. The [first full-policy report](reports/LUNA_FULL_RUN_2026-09-24.md) records a corrected token-cost estimate after cache-write usage was discovered. The [source-grounded retest](reports/LUNA_GROUNDED_FULL_RUN_2026-09-24.md) shows why valid source references do not guarantee coverage: it preserved Spotify's retention caveat but missed Facebook's no-sale claim. Reasoning tokens count toward `max_output_tokens` according to the [official OpenAI reasoning guide](https://developers.openai.com/api/docs/guides/reasoning).

The later bounded-section test kept Luna at medium and split the same full policies into 15 non-overlapping core ranges, with nearby lines available as context. A withheld six-claim anchor checklist found citations for all six selected claims, compared with one in the previous grounded run; this is a narrow coverage proxy, not a recall or accuracy score. The new run also produced one invalid blank-line citation and far more findings, so broader claim-by-claim human review is still needed. Its runner requires a separate opt-in and budget guard; nothing here authorizes a repeat.

This document does not authorize additional paid requests.
