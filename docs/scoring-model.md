# Personalized risk indicators design (#12)

Part of [#12](https://github.com/UNLV-CS472-672/2026-F-GROUP2-ClearConsent/issues/12). This is a proposal for team review. It contains no code; the implementation comes in a later PR after the open decisions at the end are settled.

## What changed after review

- **Category no longer decides the side.** Each finding says whether it `exposes` (a practice, or a missing or restricted protection) or `protects`. "Users cannot delete their data" is a `user_rights` finding that exposes, so it can conflict (section 3).
- **Not everything is red.** Findings get a tier (routine, notable, serious) from their recipients and purposes. A payment processor completing a purchase is routine and never conflicts. Selling to data brokers is serious (section 4).
- **"Only if" conditions count.** A practice that only happens if the user opts in drops one tier (section 4).
- **Unclear text has a fallback.** An ambiguous finding, or one without `effect`, goes to a review list and is not used, so the concern falls back to insufficient evidence (section 3).
- **Opposing choices give opposite results (FR-9).** Every concern is evaluated at every level. The same finding is a conflict at "major" and an alignment at "acceptable" (section 5).

These fields are produced by Stage 2 consolidation (`ConsolidatedFinding` in `src/lib/server/analysis/consolidation/`). They still need to be added to the public #22 contract.

## 1. The idea

The AI finds privacy practices in a policy and cites the text for each one. It does not judge them against the user's preferences. A plain TypeScript function does that: it takes the findings and the user's chosen preference profile, and returns one indicator per concern. Same input, same output, every time. Because no AI call is involved, the result can be unit tested, every indicator points to a cited finding (or says evidence is missing), and a user can switch profiles and see new results instantly, even when the AI service is down or over its usage limit.

```ts
evaluatePreferences(findings: Finding[], profile: PreferenceProfile): PreferenceEvaluation;
```

The function never touches the network, the database, or a model. Loading findings and preferences, and saving the result, happen outside it.

## 2. Indicators, not a score

Each concern gets one of the three indicators FR-9 already defines:

- **`conflict`**: the policy does something at or above the level this user cares about.
- **`alignment`**: the policy addresses this concern, and nothing in it crosses the user's line.
- **`insufficient_evidence`**: the policy doesn't clearly say, so we don't guess.

These map directly onto the existing `preference_evaluations` table, so no database changes are needed.

#12 originally asked for an overall 0–100 score as well. For the MVP, this design leaves it out:

- MVP-4, FR-9, DP1, and the database all describe indicators. The score only appeared in #12.
- A single number is mainly useful for comparing policies, and DP1 puts policy comparison out of scope.
- A number like "85/100" looks precise but would rest on weights nobody has calibrated yet. A specific conflict with a quoted excerpt is easier to check and fits NFR-8 (informational, not legal advice).

A score can still be added after the MVP (see section 10).

## 3. Input: findings

Findings come from Stage 2 consolidation. Agreed with the #22 owner: `category` is a fixed list, there is no `practice` field, and there is no `confidence` field. Offsets use the #17 convention (start-inclusive, end-exclusive UTF-16); scoring doesn't need them.

The six categories are the six concerns:

```ts
'collection' | 'use' | 'sharing' | 'retention' | 'user_rights' | 'security_practices';
```

Category alone can't say whether a finding is good or bad for the user, or how serious it is, so each finding also has:

| Field            | Values                                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `effect`         | `exposes` (a practice, or a missing or restricted protection) or `protects` (a protection, or a denial like "we do not sell") |
| `ambiguous`      | true when the text is genuinely unclear                                                                                       |
| `conditional`    | true when the practice only happens if the user opts in                                                                       |
| `recipientTypes` | `service_provider`, `affiliate`, `advertiser`, `data_broker`, `government`, `other`, `unspecified`                            |
| `purposeTypes`   | `service`, `legal_security`, `analytics`, `advertising`, `sale`, `other`, `unspecified`                                       |

Stage 2 produces all of these today. Until #22 adopts them publicly, the module defines a matching local input type.

### Which findings count

Each finding is checked in this order:

1. **No evidence** (no excerpt with real text): put in the `ungrounded` list and ignored.
2. **Missing `effect`**: put in `needsReview` with reason `missing_effect` and ignored.
3. **`ambiguous: true`**: put in `needsReview` with reason `ambiguous` and ignored. FR-7 says unclear text must not be treated as fact, so the concern falls back to insufficient evidence instead of guessing.
4. **Everything else** is used. Empty recipient or purpose types count as `unspecified`, and a missing `conditional` counts as false.

Only call the function for a result with status `success` or `insufficient`. An `insufficient` result has no findings, so every concern comes back `insufficient_evidence`. `in_progress` and `failed` results are never evaluated, so a failed analysis is never shown as an evaluation (NFR-5).

## 4. Tiers

Only `exposes` findings get a tier. For `sharing`, take the highest tier any recipient or purpose type reaches.

| Category             | Serious                                                                     | Notable                                                                                          | Routine                                                                    |
| -------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `sharing`            | Recipient `data_broker` or `advertiser`, or purpose `sale` or `advertising` | Recipient `affiliate`, `other`, or `unspecified`; purpose `analytics`, `other`, or `unspecified` | Only `service_provider` or `government`, for `service` or `legal_security` |
| `use`                | Purpose `advertising` or `sale`                                             | Purpose `analytics`, `other`, or `unspecified`                                                   | Purpose `service` or `legal_security`                                      |
| `collection`         | (sensitive data, later)                                                     | Purpose `advertising` or `sale`                                                                  | Everything else                                                            |
| `retention`          | —                                                                           | Always                                                                                           | —                                                                          |
| `user_rights`        | Always (a missing or restricted right)                                      | —                                                                                                | —                                                                          |
| `security_practices` | Always (a missing or weak protection)                                       | —                                                                                                | —                                                                          |

`conditional: true` drops a finding one tier (serious to notable, notable to routine). The table lives in its own data file so it can be tuned without touching the logic.

This answers the "everything is red" problem: sharing card numbers with a payment processor to complete a purchase is routine, sharing location with ad partners is serious, and sharing it with ad partners only if the user turns on personalized ads is notable.

## 5. Levels and profiles

Each concern has one of three levels. The level sets the lowest tier that causes a conflict:

| Level        | Conflict at        | Otherwise |
| ------------ | ------------------ | --------- |
| `acceptable` | Never              | Alignment |
| `concern`    | Serious            | Alignment |
| `major`      | Notable or serious | Alignment |

Routine findings never cause a conflict at any level.

Every concern gets an indicator at every level; nothing is skipped. That is how FR-9 is met: the same notable finding is a `conflict` for a user who marked the concern `major` and an `alignment` for one who marked it `acceptable`.

For the MVP, users pick one of three built-in profiles (FR-2). Custom levels per concern are out of scope.

| Concern              | Balanced | Strict | Relaxed    |
| -------------------- | -------- | ------ | ---------- |
| `collection`         | concern  | major  | acceptable |
| `use`                | concern  | major  | acceptable |
| `sharing`            | major    | major  | concern    |
| `retention`          | concern  | major  | acceptable |
| `user_rights`        | concern  | major  | concern    |
| `security_practices` | concern  | major  | concern    |

**Storage:**

- `privacy_preferences.preferences`: `{ "profile": "balanced" }`
- `analyses.preference_snapshot`: `{ "profile": "balanced", "levels": { ... }, "rulesVersion": "1" }`

The snapshot copies the actual levels. If a built-in profile changes later, old saved results still show what was used at the time, as FR-12 requires.

## 6. Rules

For each concern:

| Indicator               | When                                                     | Linked finding                                                                     |
| ----------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `conflict`              | Any usable `exposes` finding meets the level's threshold | The highest-tier one                                                               |
| `alignment`             | No conflict, and at least one usable finding             | A `protects` finding if there is one, otherwise the highest-tier `exposes` finding |
| `insufficient_evidence` | No usable finding                                        | None (the database allows this)                                                    |

Each becomes one `preference_evaluations` row: `preference_key` is the concern, `preference_value` is the level.

**Same result in any order:** ties go to the lowest finding ID, so input order never changes the result.

**Adding a finding never removes a conflict:** a conflict only needs one qualifying finding to exist.

**Display order:** conflicts first (serious before notable, then `major` before `concern`), then insufficient evidence, then alignment. Remaining ties go by the concern order in section 3.

**No findings is not "no risk."** If nothing usable is found, every concern is `insufficient_evidence`. Nothing is shown as safe just because the policy didn't mention it (FR-7, FR-10).

**Explanations** name the concern, the user's level, and the finding, for example: _"Conflict: you marked sharing as a major concern. The policy shares your location with ad partners if personalized ads are on."_ An evidence gap is explained instead of cited: _"Not enough evidence: the policy doesn't clearly describe how long it keeps your data."_

## 7. Output shape

```ts
type ConcernId =
	'collection' | 'use' | 'sharing' | 'retention' | 'user_rights' | 'security_practices';
type Level = 'acceptable' | 'concern' | 'major';
type Tier = 'routine' | 'notable' | 'serious';

interface PreferenceEvaluation {
	rulesVersion: '1';
	profile: { id: string; levels: Record<ConcernId, Level> };

	// One entry per concern, in display order.
	indicators: {
		concern: ConcernId;
		level: Level;
		indicator: 'conflict' | 'alignment' | 'insufficient_evidence';
		findingId: string | null; // null only for insufficient_evidence
		tier: Tier | null; // tier of the linked exposes finding; null for protects or no finding
		explanation: string;
	}[];

	counts: { conflict: number; alignment: number; insufficient_evidence: number };

	needsReview: { findingId: string; reason: 'ambiguous' | 'missing_effect' }[];
	ungrounded: { findingId: string }[];

	// e.g. "2 conflicts with your preferences. Most important: you cannot delete your workout history (user rights)."
	summary: string;
}
```

## 8. Example

An invented fitness app's policy produces six findings:

| Finding | Category             | What the policy says                                               | Treated as                               |
| ------- | -------------------- | ------------------------------------------------------------------ | ---------------------------------------- |
| A       | `sharing`            | Shares card numbers with a payment processor to complete purchases | exposes, routine                         |
| B       | `sharing`            | Shares location with ad partners only if personalized ads are on   | exposes, serious → notable (conditional) |
| C       | `user_rights`        | Users cannot delete their workout history                          | exposes, serious                         |
| D       | `security_practices` | Encrypts data in transit                                           | protects                                 |
| E       | `retention`          | Keeps messages "as long as necessary"                              | ambiguous → needs review                 |
| F       | `collection`         | Collects email to create an account                                | exposes, routine                         |

**Results:**

| Concern              | Balanced                          | Strict                            | Relaxed                           |
| -------------------- | --------------------------------- | --------------------------------- | --------------------------------- |
| `user_rights`        | Conflict, C: **1st**              | Conflict, C: **1st**              | Conflict, C: **1st**              |
| `sharing`            | Conflict, B: 2nd                  | Conflict, B: 2nd                  | Alignment, B                      |
| `use`                | Not enough evidence               | Not enough evidence               | Not enough evidence               |
| `retention`          | Not enough evidence (E in review) | Not enough evidence (E in review) | Not enough evidence (E in review) |
| `collection`         | Alignment, F                      | Alignment, F                      | Alignment, F                      |
| `security_practices` | Alignment, D                      | Alignment, D                      | Alignment, D                      |

What this shows:

- **Not everything is red.** A (payment processor) and F (account email) are routine and never conflict.
- **A missing right conflicts.** C is a `user_rights` finding, but it exposes, so it is a serious conflict instead of an alignment.
- **Conditions matter.** B is serious without its condition. Because it only happens if the user opts in, it is notable: a conflict for Balanced and Strict (sharing is `major`), but an alignment for Relaxed (sharing is `concern`, which only conflicts at serious).
- **Ambiguous text isn't guessed.** E is listed for review, and retention is "not enough evidence."
- **Silence isn't safety.** The policy says nothing about use, so that's "not enough evidence," not alignment.

## 9. Test plan for the implementation PR

| Requirement                                  | Test                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------- |
| No network, database, or model access        | Module imports only types and data; a test checks `fetch` is never called.            |
| Same input gives same output                 | Run twice and compare deeply.                                                         |
| Input order doesn't matter                   | Shuffle the findings several times; output is identical.                              |
| Opposing levels give opposite results (FR-9) | The same notable finding gives `conflict` at `major` and `alignment` at `acceptable`. |
| Routine never conflicts                      | A routine finding gives no conflict at any level.                                     |
| `conditional` drops a tier                   | A serious finding marked conditional is treated as notable.                           |
| `effect` decides the side                    | A missing right (`exposes`) conflicts; a `protects` finding gives alignment.          |
| Unclear findings go to review                | Ambiguous or missing-`effect` findings are in `needsReview` and change no indicator.  |
| Uncited findings are reported                | A finding with blank excerpts appears in `ungrounded` and affects nothing.            |
| No findings gives no false reassurance       | Empty input gives `insufficient_evidence` for every concern.                          |
| Adding a finding never removes a conflict    | Adding any finding to any subset never turns a conflict into something else.          |
| Display order                                | Conflicts by tier then level, then insufficient evidence, then alignment.             |
| Each indicator names its finding or gap      | `findingId` is set for conflict and alignment; explanations mention the concern.      |
| The example gives the results above          | The fitness example matches section 8 for all three profiles.                         |
| Checks pass, no new dependencies             | CI passes, and `package-lock.json` is unchanged.                                      |

## 10. Later, not MVP

- **Overall score.** One number computed from the conflict tiers. It needs calibration and a place to store it first.
- **Sensitive data.** A serious tier for `collection` of health, location, or children's data, once there is a fixed data-type list to match on.
- **Finer concerns.** Sale or ad tracking as separate concerns.
- **Custom levels** per concern instead of built-in profiles.

## 11. Still to calibrate

- **Tier table.** Whether each recipient and purpose type sits in the right tier. Check by having teammates sort example findings by hand.
- **Profiles.** Whether these three cover what users actually want.
- **Retention.** Whether every retention finding should be notable, or whether stated short periods should be routine.

## 12. Decisions needed

- [ ] Team: indicators only for the MVP, with an overall score left for later.
- [ ] #22 owner: add `effect`, `ambiguous`, `conditional`, `recipientTypes`, and `purposeTypes` to the public contract (Stage 2 already produces them).
- [ ] Database owner: the preference and snapshot formats.
- [ ] Team: the tier table, the three levels, and the three profiles.
- [ ] Results UI owner: does `PreferenceEvaluation` include everything the results page needs?

## 13. Requirements this design covers

| Requirement | How                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------- |
| FR-2        | Built-in profiles with plain-language levels, and a defined storage format                     |
| FR-7        | Ambiguous findings aren't used; no findings gives "insufficient evidence"                      |
| FR-9        | One indicator per concern naming the finding or the gap; opposing levels give opposite results |
| FR-10       | Output includes indicators in priority order, explanations, counts, and the review list        |
| FR-12       | Levels and rules version are saved in the analysis snapshot                                    |
| NFR-5       | `failed` and `in_progress` results are never evaluated or shown as complete                    |
| NFR-6       | Indicators are shown as text, not only as colors                                               |
| NFR-7       | Every conflict and alignment cites evidence; evidence gaps are explained instead               |
| NFR-8       | Specific, cited indicators instead of an uncalibrated overall rating                           |
| NFR-10      | Every #12 requirement gets a Vitest test in the implementation PR                              |
