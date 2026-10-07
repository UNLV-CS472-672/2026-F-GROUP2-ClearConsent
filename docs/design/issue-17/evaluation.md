# Issue 17: workflow review plan

**Status:** Proposed protocol, not executed. Agree on the rubric and budgets before running calls. The purpose is to decide whether the proposed two-stage workflow earns its extra cost and latency.

## Matched comparison

Compare (A) one direct request producing canonical findings and takeaways with (B) evidence extraction plus consolidation producing the same final result contract. Use the same frozen source text, model, medium reasoning, final schema, category/recipient definitions, attention-label rubric, and whole-analysis cost/time ceilings. Record stage-specific prompt and output limits; these workflows have different call counts, so compare total cost rather than one request's price.

Start with the 14 short and two archived full-policy cases from #11, retaining pinned source versions and archive attribution. Their expectations and selected anchors need independent human review; the full cases are not currently comprehensive ground truth. Add held-out cases for conditional disclosures, repeated clauses, ambiguous retention, negation, Unicode offsets, cross-section exceptions, conflicting age/jurisdiction scopes, no supported findings, and instructions embedded in text. Do not use either comparison model to create the reference answers.

Use at least two repetitions per workflow/case to observe variability. Keep reference answers, reviewer anchors, and previous experiment outputs out of model prompts. Estimate the complete call count, token/caching costs, and worst-case budget after chunk planning; a written protocol does not authorize a paid run.

## Human review

Where practical, reviewers see anonymized outputs rather than model/workflow names. Review the entire short input, and independently inventory material practices and caveats in full-policy cases. The six historical anchors are regression checks, not a recall denominator.

Use the same finding-matching rule across workflows: a predicted finding matches a reference practice only when it preserves the relevant action, data category, recipient if known, negation, and material scope. A broad umbrella statement cannot count as correct coverage of several omitted distinct practices.

| Measure                     | How to judge it                                                                                                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Finding precision/recall/F1 | Match canonical findings by meaning to reviewed reference practices. Count unsupported/wrong findings and missed material practices separately.                                     |
| Citation support            | Check whether the cited passages directly support every factual clause and material qualification, not merely whether IDs exist.                                                    |
| Recipient accuracy          | Distinguish actual disclosure recipients from controllers, advertisers, collaborators, and display channels.                                                                        |
| Qualification preservation  | Check opt-in/control limits, deletion exceptions, age/jurisdiction scope, rights limits, denial scope, and ambiguous wording.                                                       |
| Consolidation accounting    | Inspect every excluded/merged candidate for lost facts or unjustified corrections. Separately look for omissions from the original source.                                          |
| Summary coverage            | Verify significant practices survive in the findings inventory and are fairly represented in the readout. Count inventory omissions separately from acceptable summary compression. |
| Readability                 | Rate 1–5: 1 = misleading/confusing, 3 = understandable but repetitive or dense, 5 = concise everyday language with clear conditions and usable evidence.                            |
| Label quality               | Use the proposed label definitions; judge whether each reason explains its label and whether the label conflicts with the stated caveats.                                           |
| Run reliability             | Record complete analyses, schema/reference errors, failed chunks, refusals, and incomplete outputs for every attempt.                                                               |
| Cost and latency            | Total extraction + consolidation + retries/failed attempts. Record wall-clock analysis time separately from summed provider times, including concurrency.                           |
| Repeat consistency          | Compare material findings, preserved qualifications, and labels by meaning. Exact text agreement is not an accuracy score.                                                          |

Two reviewers should independently grade cases where feasible and reconcile disagreements against the source. Record unresolved judgments rather than silently selecting the more favorable interpretation.

## Proposed decision gates

These are review criteria, not measured results or production guarantees. The first three align with #11's qualification requirements:

- At least 95% of attempted analyses produce the agreed complete schema.
- Unsupported-claim rate is no greater than 5% in the human-reviewed output set.
- No reviewed ambiguous statement is asserted as a confirmed fact.
- Every designated must-cover regression claim retains its important qualification and direct evidence. Missing logged-out/account linkage, child rules, or over-broad rights restrictions must remain visible failures.
- Every published fixture passes snapshot/reference/link validation. Every candidate in the staged workflow has a reviewable disposition, and every input chunk is accounted for.
- The workflow stays within the preregistered whole-analysis cost and latency ceilings.

Freeze a composite quality formula with #11 before calls. Suggested starting weights: 50% canonical-finding F1, 20% semantically correct citations, 20% qualification preservation, and 10% readability normalized to 0–1. Report each measure separately and results for synthetic versus archived cases; the weighted score does not hide a failed gate.

Adopt the staged workflow only if it passes those gates, does not reduce reviewed material coverage or qualification preservation relative to direct processing, and offers a meaningful quality/readability benefit within the ceilings. If quality scores are within three percentage points, prefer lower total cost, consistent with #11; document latency and maintainability as tradeoffs. If neither qualifies, fix the prompts/contracts and record the failures rather than declaring a winner.

## Offline verification before any paid run

Validate source ranges and exact excerpt reconstruction, including surrogate pairs/Unicode. Exercise unknown or blank references, duplicate IDs, unmapped candidates, missing chunks, unsupported enum values, incomplete provider results, and stage-specific timeouts/quota errors through mocks. Verify that none becomes a successful empty analysis.

Check cross-chunk merging and exception preservation using handcrafted fixtures, with explicit positive and failure examples. Verify summary links and that scoring receives canonical findings rather than raw candidates. Confirm budget admission accounts for both stages and approved retries, and that a missing budget prevents calls.

These are implementation tests to add with the corresponding modules. The [workflow proposal](workflow-proposal.md) includes a worked example for review; this change contains design documentation only.

## Implementation follow-ups

| Follow-up                                  | Expected outcome and coordination                                                                                                                                                                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agree and extend shared contracts          | Work with #6/#12 to define immutable snapshots, citation offsets, canonical findings, confidence/ambiguity, takeaways, disposition artifacts, and incomplete/failure states. Review the synthetic example before introducing competing types.      |
| Add source references and chunk planning   | Freeze text, assign reconstructable passage ranges, cover every supported source range, and plan bounded extraction/consolidation requests. Test Unicode, context overlap, and over-limit input.                                                   |
| Implement analysis orchestration           | Build through #7's server client. Record stage/chunk state, validate responses, resume deliberate retries, account for cost, and return partial/failure states correctly. Select concrete token, timeout, concurrency, and budget limits.          |
| Evaluate and integrate the chosen workflow | Extend deliberate eval work using #11's versioned cases; obtain independent reference review and budget approval. Compare direct/staged totals, document failures and the decision, then coordinate result/Q&A/history handoffs with their owners. |

Create these as GitHub implementation issues after the team reviews the design, linking #17 and the existing owners' issues to avoid duplicate work.
