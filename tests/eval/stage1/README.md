# Stage 1 pipeline eval

This eval runs ClearConsent's real Stage 1 code over committed policy fixtures: the same
`runStage1Analysis`, OpenAI provider, prompt, schema, quote verification, and drop-and-report rules
that serve `POST /api/analyze` (see [docs/stage-1-analysis.md](../../../docs/stage-1-analysis.md)). It
skips only the HTTP layer, so no server or access token is needed.

It is separate from the [issue #11 model comparison](../issue-11/README.md), which used its own prompt
and schema. This eval reuses that directory's fixtures and `gpt-6-luna` prices without changing them.

## Cases

| Group     | Cases | Source                                                                  | Labels                  |
| --------- | ----: | ----------------------------------------------------------------------- | ----------------------- |
| synthetic |    10 | `issue-11/fixtures/privacy-policy-cases.json`                           | Draft expected findings |
| archived  |     4 | `issue-11/fixtures/archived-policy-cases.json` (Facebook, Spotify…)     | Draft expected findings |
| full      |     1 | Complete Spotify policy from `issue-11/fixtures/full-policy-cases.json` | None (unlabeled)        |

The complete Facebook policy (289k characters) exceeds the 60,000-character Stage 1 limit and is
skipped until long-policy chunking exists. Each case is one provider call.

## What it measures

- **Outcome:** `complete`, `partial`, `no_candidates`, or the failure code for each case.
- **Quote labels:** how many excerpts verified exactly, after normalizing whitespace and quote marks,
  or as pieces of a `...` quote, and how many stayed unverified. Also counted: candidates with no
  verified quote (later stages must hide them) and malformed candidates dropped.
- **Coverage proxy:** for labeled cases, an expected finding counts as covered when its labeled
  evidence overlaps any verified evidence range. Labels are drafts awaiting human review, and overlap
  does not prove the claim is right, so treat this as a signal rather than recall.
- **Headroom:** duration as a share of the 120-second timeout, and output tokens (including reasoning)
  as a share of the 16,000-token cap. The full Spotify case is the main check of those limits.
- **Cost:** estimated from recorded usage, pricing all input at the cache-write rate. It is an upper
  estimate, not an invoice. Failed calls record no usage but may still be billed.

Claim quality (conditions kept, no misreadings, "no sale" not treated as "no sharing") still needs
a person to read the saved candidates.

## Running it

All commands run from the repository root. The scripts are TypeScript and run through `jiti`.

```sh
# Offline: show the per-case and total maximum cost. Makes no API calls.
node --import jiti/register tests/eval/stage1/run-stage1-eval.ts --estimate

# Offline: run every case through the real pipeline with a fake provider, then score it.
node --import jiti/register tests/eval/stage1/run-stage1-eval.ts --mock

# Offline checks for the loader, estimator, mock provider, and scorer.
node --import jiti/register --test tests/eval/stage1/offline.test.ts
```

A paid run requires `--run`, `RUN_MODEL_EVALS=1`, `OPENAI_API_KEY`, and `EVAL_APPROVED_MAX_USD` at
least as large as the current `--estimate` maximum. It refuses any model other than `gpt-6-luna`,
because the ceiling is priced for that model. The command below is an example, not a standing budget
approval:

```sh
RUN_MODEL_EVALS=1 EVAL_APPROVED_MAX_USD=0.14 node --env-file=.env.local --import jiti/register \
  tests/eval/stage1/run-stage1-eval.ts --run
```

Add `--case <id>` (repeatable) to run selected cases only. There are no retries. Calls run one at a
time, and each result is appended to `results/<mode>-<timestamp>.jsonl` (Git-ignored) before the next
call starts. A failed case is recorded and the run continues, since failures are part of the result.

Every `--run` and `--mock` also writes a Markdown review to `reports/review-<run>.md`. It lists
each case's candidates with their claims, qualifiers, and quotes, plus checkboxes for a person to score
whether each quote supports its claim and keeps its conditions. Each quote shows the pipeline's own
label:

- ✅ exact, matched ignoring whitespace or quote marks, or one piece of a `...` quote. The text shown
  is the policy's, never the model's;
- ⚠️ unverified, with the reason. Never shown to users as a quote;
- ⛔ not checked, because its candidate was dropped as malformed.

Build a review from saved runs, combining files when one run fills in a case another missed (a later
file wins for the same case):

```sh
node --import jiti/register tests/eval/stage1/run-stage1-eval.ts --review <first.jsonl> <second.jsonl>
```

Replay saved model output through the current verification code, with no API calls. This shows what a
change to verification would have done to a past paid run, and writes a new results file and review:

```sh
node --import jiti/register tests/eval/stage1/run-stage1-eval.ts --replay <first.jsonl> <second.jsonl>
```

Rescore a saved run without new calls:

```sh
node --import jiti/register tests/eval/stage1/run-stage1-eval.ts --score tests/eval/stage1/results/<file>.jsonl
```

Each record includes the tested commit (suffixed `+uncommitted` for a dirty tree), model, reasoning
effort, limits, timing, usage, validated candidates, and dropped candidates. Commit a short report of
any paid run under `reports/`; a past report is not approval to repeat it.
