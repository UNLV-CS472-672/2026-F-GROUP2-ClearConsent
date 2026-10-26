# Stage 2 consolidation

Stage 2 takes the Stage 1 result and turns its evidence candidates into distinct findings and a short summary. It is the second AI step in the [two-stage workflow](design/issue-17/workflow-proposal.md). Stage 1 is described in [stage-1-analysis.md](stage-1-analysis.md).

`POST /api/analyze/consolidated` runs both stages in one request. It takes the same body as `POST /api/analyze` and has the same limits and access rules. `POST /api/analyze` is unchanged and still runs Stage 1 alone.

The new handler (`consolidation/http.ts`) calls the existing Stage 1 handler as is, so the access check, body limits, configuration, and Stage 1 logging are shared rather than copied. If Stage 1 fails, its response is returned unchanged and Stage 2 does not run. On success, Stage 2 runs with the same checked model settings.

Stage 1 code is unchanged except that `openai-provider.ts` now exports four helpers (`ResponseEnvelopeSchema`, `hasRefusal`, `parseUsage`, `mapProviderError`). The Stage 2 provider reuses them, so both stages check responses and report failures the same way.

## How it works

1. **Re-check Stage 1.** Code confirms the source passages are valid and every verified excerpt still matches the source text.
2. **Hold back unverified candidates.** A candidate is sent to the model only if every one of its excerpts is verified. Others are listed in `excludedCandidates` with code `unverified_evidence` and never shown. This follows Stage 1's rule: qualifiers aren't linked to individual excerpts, so dropping one excerpt could hide an exception.
3. **Consolidate.** One `gpt-6-luna` call with the same settings as Stage 1 (same model, reasoning effort, timeout, output cap, `store: false`, zero retries). The model gets the full source passages, the eligible candidates, and the user's preferences.
4. **Validate in code.** The model cites candidate IDs only. Code builds each finding's evidence from those candidates' verified excerpts, so the model never supplies quotes or offsets.
5. **Order.** Findings related to the user's preferences come first, then by category, then by where their evidence starts in the source. IDs (`F001`…) follow that order.

If Stage 1 found no candidates, there is no model call. The result is complete with `outcome: "no_findings"` and a fixed summary saying that no findings does not mean no risk (FR-7).

## Finding fields

| Field                                      | Meaning                                                                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `category`                                 | One of `collection`, `use`, `sharing`, `retention`, `user_rights`, `security_practices` (the #22 categories)     |
| `description`                              | One or two plain-language sentences                                                                              |
| `effect`                                   | `exposes` (a practice, or a missing or restricted protection) or `protects` (a protection, or a denial)          |
| `conditional`, `conditionNote`             | The practice only happens if the user opts in; the note lists every condition and exception                      |
| `ambiguous`, `uncertaintyNote`             | The text is genuinely unclear; the note says what is unclear                                                     |
| `dataCategories`, `purposes`, `recipients` | Free-text phrases from the candidates                                                                            |
| `purposeTypes`                             | Fixed values: `service`, `legal_security`, `analytics`, `advertising`, `sale`, `other`, `unspecified`            |
| `recipientTypes`                           | Fixed values: `service_provider`, `affiliate`, `advertiser`, `data_broker`, `government`, `other`, `unspecified` |
| `relevantPreferences`                      | Preference keys the finding relates to; used for ordering only                                                   |
| `candidateIds`, `evidence`                 | The merged Stage 1 candidates and their verified excerpts with UTF-16 offsets                                    |

`effect`, `ambiguous`, `conditional`, and the fixed purpose and recipient types are the fields #12 needs for personalized indicators. They are internal until #22 settles the public `Finding` contract.

## Preferences

Unlike Stage 1, Stage 2 sends the user's preferences to the model. The model may use them only to fill `relevantPreferences`. The prompt says preferences must not change which candidates are merged or excluded, or any other field. Code drops keys the user doesn't have, and keys set to `null`, `false`, or an "off" value such as `"none"`, and a test checks that the same model output gives the same findings with or without preferences, apart from relevance and order.

Personalized indicators (`alignment`, `conflict`, `insufficient_evidence`) still come from #12's deterministic scoring, not from the model.

## Candidate accounting

Every eligible candidate must end up in a finding or a model exclusion with a reason. Code checks this:

| Problem                                                                    | What happens                                             |
| -------------------------------------------------------------------------- | -------------------------------------------------------- |
| A finding cites an unknown or held-back candidate, or misses required text | The finding is rejected and listed in `rejectedOutput`   |
| An exclusion is unknown, repeated, has no reason, or contradicts a finding | The exclusion is rejected and listed in `rejectedOutput` |
| A candidate is in no valid finding or exclusion                            | Listed in `excludedCandidates` as `unaccounted`          |
| Every finding the model returned is rejected                               | The stage fails with `provider_malformed`                |
| Blank summary                                                              | The stage fails with `provider_malformed`                |
| Output doesn't match the schema                                            | The stage fails with `provider_malformed`                |

## Statuses

- `stageStatus: "complete"` and `analysisStatus: "complete"`: no rejected output and no unaccounted candidates. `outcome` is `findings_identified` or `no_findings`, matching the `analyses.outcome` enum. Held-back candidates are reported but don't block completion.
- `stageStatus: "partial"` and `analysisStatus: "in_progress"`: some output was rejected or some candidates were unaccounted. Findings are returned for inspection, `outcome` is null, and the result must not be saved or shown as complete (NFR-5).
- Failure: the response has `stage: "consolidation"`, `stageStatus: "failed"`, the error code, and the full Stage 1 result under `extraction`, so extraction work stays visible but incomplete.

Stage 2 uses the existing error codes; it adds none. Provider errors are the same as Stage 1's (`provider_timeout`, `provider_rate_limit`, `provider_truncated`, and so on).

## Response

A successful response is a `ConsolidationResult` with the full Stage 1 result under `extraction`. See [`docs/examples/consolidated-response.json`](examples/consolidated-response.json), which was generated by running the real pipeline on the Stage 1 example with a handwritten model output. It is not a live model response.

If consolidation fails after the model has responded (for example a refusal, truncated output, or output that fails validation), the call was still paid for, so the failure log also records the model and token usage.

Logs record counts only: findings, held-back, excluded, unaccounted, rejected output, model, and usage. No policy text, summary, findings, or preferences.

## Database mapping

Migration `20261019120000_add_consolidated_finding_fields.sql` extends the existing `findings` table instead of adding a new one. Existing grants and RLS policies cover the new columns.

| Column                 | Type    | Rule                                                                                                    |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `category`             | text    | Now one of `collection`, `use`, `sharing`, `retention`, `user_rights`, `security_practices`             |
| `effect`               | text    | `exposes`, `protects`, or null for older rows                                                           |
| `ambiguous`            | boolean | Default false; when true, `uncertainty_note` must contain text                                          |
| `conditional`          | boolean | Default false; when true, `condition_note` must contain text                                            |
| `purpose_types`        | text[]  | Only `service`, `legal_security`, `analytics`, `advertising`, `sale`, `other`, `unspecified`            |
| `recipient_types`      | text[]  | Only `service_provider`, `affiliate`, `advertiser`, `data_broker`, `government`, `other`, `unspecified` |
| `relevant_preferences` | text[]  | Preference keys the finding relates to; no null elements                                                |

The free-text `purposes` and `recipients` columns stay, so the policy's own wording is kept next to the fixed values. Evidence objects add `startOffset`, `endOffset` (UTF-16, start-inclusive, end-exclusive into `analyses.source_text`), `passageId`, and `match` to the required `excerpt`. `supabase/tests/database/consolidated-findings.test.sql` checks the new rules.

`toAnalysisResultFields()` and `toFindingRows()` in `src/lib/server/analysis/consolidation/rows.ts` map a complete result onto the columns and refuse a partial one. Nothing writes to the database yet; that needs auth and the `sources` table.

## Limits and what's not covered

- Total cost and latency are now two model calls. No paid Stage 2 call has been made yet, so Stage 2 token use on a full policy is unmeasured.
- Validation is structural. It can't prove a merge was right, a condition survived, or an exclusion was justified. A person still needs to review output against the source.
- No Stage 2 eval runner yet.
- Long-policy chunking is still a follow-up; the 60,000-character limit applies to the whole request.
