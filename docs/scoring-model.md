# Personalized risk indicators design (#12)

Part of [#12](https://github.com/UNLV-CS472-672/2026-F-GROUP2-ClearConsent/issues/12). This is a proposal for team review. It contains no code; the implementation comes in a later PR after the open decisions at the end are settled.

## 1. The idea

The AI finds privacy practices in a policy and cites the text for each one. It does not judge them against the user's preferences. A plain TypeScript function does that: it takes the findings and the user's chosen preference profile, and returns one indicator per concern the user cares about. Same input, same output, every time. Because no AI call is involved, the result can be unit tested, every indicator points to a cited finding (or says evidence is missing), and a user can switch profiles and see new results instantly, even when the AI service is down or over its usage limit.

```ts
evaluatePreferences(findings: Finding[], profile: PreferenceProfile): PreferenceEvaluation;
```

The function never touches the network, the database, or a model. Loading findings and preferences, and saving the result, happen outside it.

## 2. Indicators, not a score

Each concern gets one of the three indicators FR-9 already defines:

- **`conflict`**: the policy does something this user said they care about.
- **`alignment`**: the policy offers a protection this user cares about.
- **`insufficient_evidence`**: the policy doesn't clearly say, so we don't guess.

These map directly onto the existing `preference_evaluations` table, so no database changes are needed.

#12 originally asked for an overall 0–100 score as well. For the MVP, this design leaves it out:

- MVP-4, FR-9, DP1, and the database all describe indicators. The score only appeared in #12.
- A single number is mainly useful for comparing policies, and DP1 puts policy comparison out of scope.
- A number like "85/100" looks precise but would rest on severity values nobody has calibrated yet. A specific conflict with a quoted excerpt is easier to check and fits NFR-8 (informational, not legal advice).
- It removes a formula, score labels, calibration of how findings combine, and a storage decision from the MVP.

A score can still be added after the MVP (see section 11).

## 3. Input: findings from #22

#22 defines `Finding` in `src/lib/contracts/`, so this module uses that type instead of making its own. Agreed with the #22 owner:

- **`category` is a fixed list**, and #12 keys on it alone. There is no separate `practice` field.
- **No `confidence` field** in this version, so this design doesn't use confidence.
- **Ambiguity** isn't in #22 yet. It will be added in a later ticket, and #12 will be included.
- **Offsets**, when added, will use the #17 convention (start-inclusive, end-exclusive UTF-16). Scoring doesn't need them; it only checks that a citation exists.

The fields used are `id`, `category`, the plain-language summary, and `evidence`. The six categories are:

```ts
'collection' | 'use' | 'sharing' | 'retention' | 'user_rights' | 'security_practices';
```

### Flags that come later

Two things can't be read from `category` alone:

- **Ambiguous wording.** FR-7 says unclear text must not be treated as fact.
- **Denials.** "We do not sell your data" is still a `sharing` finding, but it's a promise, not a practice.

The module accepts both as optional flags (`ambiguous?: boolean`, `denies?: boolean`) on top of #22's `Finding`. It works today with plain #22 findings and picks the flags up once #22 adds them. Until then, an ambiguous or denied finding is treated like any other finding in its category. **This is a known MVP limitation:** a denial could show up as a conflict. It's the main reason to include denials in the #22 ambiguity ticket.

### Which findings count

Each finding is checked in this order:

1. **No evidence** (no excerpt with real text): put in the `ungrounded` list and ignored. #22 already rejects these, so this is a safety net.
2. **Flagged `ambiguous`**: put in the `needsReview` list and ignored.
3. **Flagged `denies`**: counts as a protection for its concern, so it gives `alignment`, never `conflict`.
4. **Everything else** is used.

Only call the function for a #22 result with status `success` or `insufficient`. An `insufficient` result has no findings, so every concern comes back `insufficient_evidence`. `in_progress` and `failed` results are not evaluated, so a failed analysis is never shown as an evaluation.

## 4. Concerns

Each #22 category is one concern a user can hold a preference about:

| Concern              | What it covers                                 | A finding in this category gives |
| -------------------- | ---------------------------------------------- | -------------------------------- |
| `collection`         | What data is collected                         | `conflict`                       |
| `use`                | What the data is used for                      | `conflict`                       |
| `sharing`            | Who else gets the data, including sale and ads | `conflict`                       |
| `retention`          | How long data is kept                          | `conflict`                       |
| `user_rights`        | Opting out, accessing, and deleting data       | `alignment`                      |
| `security_practices` | How the data is protected                      | `alignment`                      |

**Why this set:**

- It matches the #22 category list, which the #22 owner said #12 should key on.
- MVP-1 already promises users control over "collection, use, retention, and sharing," which are the first four.
- `user_rights` and `security_practices` describe protections, so they give users something positive to see, not only conflicts.
- Six fit on one settings screen and are small enough to test fully.

**Not in the MVP:** separate concerns for sale, ad tracking, or sensitive data (such as health or location). They would need either new categories or a fixed list of data types from #22. They're listed in section 11.

## 5. Profiles

Each profile sets every concern to one of three levels:

| Level         | Value | Effect                                          |
| ------------- | ----: | ----------------------------------------------- |
| Not a concern |     0 | No indicator; listed as "not a concern for you" |
| Some concern  |   0.5 | Evaluated                                       |
| Major concern |     1 | Evaluated, and its conflicts rank higher        |

For the MVP, users pick one of three built-in profiles. Custom settings per concern are out of scope.

| Concern              | Balanced | Strict | Data minimizer |
| -------------------- | -------- | ------ | -------------- |
| `collection`         | Some     | Major  | Major          |
| `use`                | Some     | Major  | Not a concern  |
| `sharing`            | Major    | Major  | Some           |
| `retention`          | Some     | Major  | Major          |
| `user_rights`        | Some     | Major  | Some           |
| `security_practices` | Some     | Major  | Not a concern  |

- **Balanced:** most people's default. Sharing matters most.
- **Strict:** everything matters.
- **Data minimizer:** cares most about how much is collected and how long it's kept.

Picking or changing a profile is how users "configure and update" preferences under FR-2.

**Storage:**

- `privacy_preferences.preferences`: `{ "profile": "balanced" }`
- `analyses.preference_snapshot`: `{ "profile": "balanced", "levels": { ... }, "rulesVersion": "1" }`

The snapshot copies the actual levels. If a built-in profile changes later, old saved results still show what was used at the time, as FR-12 requires.

## 6. Ranking conflicts

A user with several conflicts should see the most important one first. Each conflict gets a **strength**:

```
strength = level × severity
```

Severity says how serious each category is. It lives in its own data file so it can be tuned without touching the logic:

| Category     | Severity | Reason                                                                          |
| ------------ | -------: | ------------------------------------------------------------------------------- |
| `sharing`    |      0.9 | Data leaves the company. This includes sale and ad partners.                    |
| `use`        |      0.7 | Data can be used for profiling or ads, beyond running the service.              |
| `retention`  |      0.5 | Longer storage raises the damage of a breach, but isn't a disclosure by itself. |
| `collection` |      0.4 | Most services need some data; collection alone doesn't move data anywhere.      |

`user_rights` and `security_practices` only give alignment, so they don't need a severity.

Severity only affects **order**, never which indicator a concern gets. A wrong value can move a conflict down the list, but it can't hide it.

## 7. Rules

For each concern the profile doesn't set to "Not a concern":

| Indicator               | When                                                                                              | Linked finding                  |
| ----------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------- |
| `conflict`              | A usable finding in a `collection`, `use`, `sharing`, or `retention` concern that isn't a denial. | The first by ID                 |
| `alignment`             | No conflict, and a usable `user_rights` or `security_practices` finding, or a denial.             | The first by ID                 |
| `insufficient_evidence` | Neither.                                                                                          | None (the database allows this) |

Each becomes one `preference_evaluations` row: `preference_key` is the concern, `preference_value` is the level.

**Same result in any order:** when several findings qualify, the one with the lowest ID is linked, so input order never changes the result.

**Display order:** conflicts first (strongest first), then insufficient evidence, then alignment. Ties go by the concern order in section 4.

**No findings is not "no risk."** If nothing usable is found, every concern is `insufficient_evidence`. Nothing is shown as safe just because the policy didn't mention it (FR-7, FR-10).

**Explanations** name the concern, the user's level, and the finding, for example: _"Conflict: you marked sharing as a major concern. The policy says it shares device IDs with ad partners."_ An evidence gap is explained instead of cited: _"Not enough evidence: the policy doesn't clearly describe its security practices."_

## 8. Output shape

```ts
type ConcernId =
	'collection' | 'use' | 'sharing' | 'retention' | 'user_rights' | 'security_practices';
type Level = 0 | 0.5 | 1;

interface PreferenceEvaluation {
	rulesVersion: '1';
	profile: { id: string; levels: Record<ConcernId, Level> };

	// One entry per evaluated concern, in display order.
	indicators: {
		concern: ConcernId;
		level: Level;
		indicator: 'conflict' | 'alignment' | 'insufficient_evidence';
		findingId: string | null; // null only for insufficient_evidence
		strength: number; // 0–1 for conflicts, used for ordering; 0 otherwise
		explanation: string;
	}[];

	notEvaluated: ConcernId[]; // concerns set to "Not a concern"
	counts: { conflict: number; alignment: number; insufficient_evidence: number };

	needsReview: { findingId: string; reason: 'ambiguous' }[];
	ungrounded: { findingId: string }[];

	// e.g. "3 conflicts with your preferences. Most important: shares device IDs with ad partners (sharing)."
	summary: string;
}
```

## 9. Example

An invented fitness app's policy produces five findings:

| Finding | Category      | What the policy says                                                       |
| ------- | ------------- | -------------------------------------------------------------------------- |
| A       | `sharing`     | Shares device IDs with ad partners for targeted ads.                       |
| B       | `collection`  | Collects heart-rate data from the watch app.                               |
| C       | `retention`   | Keeps workout history for five years after an account closes.              |
| D       | `user_rights` | Users can delete their account in Settings.                                |
| E       | `use`         | "May use your information for other business purposes." Flagged ambiguous. |

**Results** (strength in brackets):

| Concern              | Balanced                          | Strict                            | Data minimizer              |
| -------------------- | --------------------------------- | --------------------------------- | --------------------------- |
| `sharing`            | Conflict, A [0.90]: **1st**       | Conflict, A [0.90]: **1st**       | Conflict, A [0.45]: 2nd     |
| `retention`          | Conflict, C [0.25]: 2nd           | Conflict, C [0.50]: 2nd           | Conflict, C [0.50]: **1st** |
| `collection`         | Conflict, B [0.20]: 3rd           | Conflict, B [0.40]: 3rd           | Conflict, B [0.40]: 3rd     |
| `use`                | Not enough evidence (E in review) | Not enough evidence (E in review) | Not a concern               |
| `security_practices` | Not enough evidence               | Not enough evidence               | Not a concern               |
| `user_rights`        | Alignment, D                      | Alignment, D                      | Alignment, D                |

What this shows:

- **Different users, different results.** The Data minimizer sees retention as the top conflict and isn't shown use or security at all. The other two profiles lead with sharing.
- **Ambiguous text isn't guessed.** E doesn't become a use conflict. Use is "not enough evidence," and E is listed for review. (Until #22 adds the flag, E would show as a use conflict.)
- **Silence isn't safety.** The policy never describes security, so that's "not enough evidence," not alignment.
- **Protections count.** D gives an alignment for user rights.

## 10. Test plan for the implementation PR

| Requirement                               | Test                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| No network, database, or model access     | Module imports only types and data; a test checks `fetch` is never called.                       |
| Same input gives same output              | Run twice and compare deeply.                                                                    |
| Input order doesn't matter                | Shuffle the findings several times; output is identical.                                         |
| Ambiguous findings are excluded           | With E flagged, the indicators match those without E; E is in `needsReview`.                     |
| Works without the flags                   | Plain #22 findings with no `ambiguous` or `denies` field are evaluated normally.                 |
| Denials give alignment                    | A `sharing` finding flagged `denies` gives `alignment`, not `conflict`.                          |
| Uncited findings are reported             | A finding with blank excerpts appears in `ungrounded` and affects nothing.                       |
| No findings gives no false reassurance    | Empty input gives `insufficient_evidence` for every evaluated concern.                           |
| Adding a finding never removes a conflict | Adding any finding to any subset never turns a conflict into alignment or insufficient evidence. |
| "Not a concern" is not evaluated          | That concern has no indicator and appears in `notEvaluated`.                                     |
| Profiles give different results           | The example above: Balanced and Data minimizer give different top conflicts and indicators.      |
| Each indicator names its finding or gap   | `findingId` is set for conflict and alignment; explanations mention the concern.                 |
| Summary names the strongest conflict      | Summary includes the top conflict's finding summary.                                             |
| Checks pass, no new dependencies          | CI passes, and `package-lock.json` is unchanged.                                                 |

## 11. Later, not MVP

- **Overall score.** One number computed from the conflict strengths, for example with a noisy-OR: `100 × (1 − (1 − s₁)(1 − s₂)…)`. That formula stays between 0 and 100 and never drops when a finding is added. It needs calibration and a place to store it first.
- **Confidence.** If #22 adds it, low-confidence conflicts could rank lower or be marked "possible."
- **Finer concerns.** Sale, ad tracking, and sensitive data (health, location, children's data) as separate concerns, once #22 has categories or fixed data-type lists to match on.
- **Custom settings** per concern instead of built-in profiles.

## 12. Still to calibrate

- **Severity values.** These only affect ordering. Check them by having teammates rank example conflicts by hand.
- **Profiles.** Whether these three cover what users actually want.
- **Conditions.** "Only if you turn on personalized ads" might deserve a weaker conflict. This needs a condition field from #22.
- **Collection conflicts.** Almost every policy collects something, so users with collection as a concern will nearly always see a conflict. Check whether that's useful or just noise.

## 13. Decisions needed

- [ ] Team: indicators only for the MVP, with an overall score left for later.
- [ ] #22 owner: include `denies` along with `ambiguous` in the later ambiguity ticket.
- [ ] Database owner: the preference and snapshot formats.
- [ ] Team: the six concerns, the three levels, and the three profiles.
- [ ] Results UI owner: does `PreferenceEvaluation` include everything the results page needs?

## 14. Requirements this design covers

| Requirement | How                                                                                     |
| ----------- | --------------------------------------------------------------------------------------- |
| FR-2        | Built-in profiles with plain-language concerns, and a defined storage format            |
| FR-7        | Ambiguous findings aren't used; no findings gives "insufficient evidence"               |
| FR-9        | One indicator per evaluated concern, naming the finding or the gap                      |
| FR-10       | Output includes indicators in priority order, explanations, counts, and the review list |
| FR-12       | Levels and rules version are saved in the analysis snapshot                             |
| NFR-5       | `failed` and `in_progress` results are never evaluated or shown as complete             |
| NFR-6       | Indicators are shown as text, not only as colors                                        |
| NFR-7       | Every conflict and alignment cites evidence; evidence gaps are explained instead        |
| NFR-8       | Specific, cited indicators instead of an uncalibrated overall rating                    |
| NFR-10      | Every #12 requirement gets a Vitest test in the implementation PR                       |
