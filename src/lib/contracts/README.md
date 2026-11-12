# Contracts

`src/lib/contracts` holds the shared shapes that the analysis pipeline, the server, the database, and the
UI agree on. Each schema is a Zod object, and its TypeScript type comes from `z.infer`, so code and
validation cannot drift apart.

| File                  | What it defines                                                                     |
| --------------------- | ----------------------------------------------------------------------------------- |
| `analysis.ts`         | The analysis result shown on the results page: findings, takeaways, and four states |
| `preferences.ts`      | Stored preferences, the preference snapshot, and the personalized evaluation        |
| `fixtures.ts`         | One valid example of each analysis state, used by tests and `/dev/analysis`         |
| `scoring-fixtures.ts` | The `docs/scoring-model.md` §8 example: six findings and their Balanced evaluation  |

Contracts describe what the app exchanges, not how the database stores it. Server code converts
between database rows and these shapes, so a column name does not have to match a field name. The
tables below record where each field comes from, where it is stored, and whether users see it.

**How to read the tables**

- **Source:** _model_ means Stage 2 consolidation produces it from the policy text. _Server_ means
  application code assigns or derives it. _User_ means the person chose it.
- **Stored in:** the database column, or _not stored_ when it is rebuilt each time the page loads.
- **Shown:** whether `AnalysisResultView` displays the field. Some fields depend on the detail level
  (Quick scan, Balanced, Detailed). The results page takes it from the `?detail=` URL parameter, and
  the History pop-up always uses Quick scan.

## `analysis.ts`

### Result states

`AnalysisResultSchema` is one of four states, chosen by `status`. Only completed analyses are saved as
analyses. Running and failed attempts are stored separately, in `analysis_runs` (added in #69), and are
not analyses.

| State          | How it is decided                                                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `success`      | A saved row in `analyses` with `outcome = 'findings_identified'` and at least one row in `findings`                                                       |
| `insufficient` | A saved row in `analyses` with no findings (`outcome = 'no_findings'`)                                                                                    |
| `in_progress`  | `analysis_runs.status = 'running'`; nothing is saved in `analyses`                                                                                        |
| `failed`       | `analysis_runs.status = 'failed'`, with `error_code` and `error_message`; nothing is saved in `analyses`. A failed save is never shown as `insufficient`. |

### Shared result fields

| Field           | Source | Stored in                                                                                       | Shown |
| --------------- | ------ | ----------------------------------------------------------------------------------------------- | ----- |
| `status`        | Server | Derived from the rows above; not stored as a column                                             | Yes   |
| `analysisId`    | Server | `analyses.id` (for `in_progress` and `failed`, the loader currently uses the source ID instead) | No    |
| `schemaVersion` | Server | `analyses.result_schema_version` (the loader currently always returns `1`)                      | No    |
| `summary`       | Model  | `analyses.summary`                                                                              | Yes   |
| `reason`        | Server | `analyses.summary` for `insufficient`                                                           | Yes   |
| `errorCode`     | Server | `analysis_runs.error_code`                                                                      | Yes   |
| `message`       | Server | `analysis_runs.error_message`                                                                   | No    |
| `findings`      | Model  | `findings` rows, ordered by `display_order`                                                     | Yes   |
| `takeaways`     | Server | Not stored; built from the findings each time the page loads                                    | Yes   |

### Finding

| Field                        | Source | Stored in                                                                  | Shown                                 |
| ---------------------------- | ------ | -------------------------------------------------------------------------- | ------------------------------------- |
| `id`                         | Server | `findings.id` (a UUID; Stage 2's `F001`-style IDs are replaced when saved) | No                                    |
| `category`                   | Model  | `findings.category` (same six values, enforced by a check constraint)      | No                                    |
| `plain_language_description` | Model  | `findings.plain_language_description`                                      | Yes, except Quick scan                |
| `dataCategories`             | Model  | `findings.data_categories`                                                 | Yes, except Quick scan ("Data")       |
| `purposes`                   | Model  | `findings.purposes`                                                        | Yes, except Quick scan ("Purpose")    |
| `recipients`                 | Model  | `findings.recipients`                                                      | Yes, except Quick scan ("Recipients") |
| `evidence`                   | Model  | `findings.evidence` (JSON; see Evidence)                                   | Yes                                   |
| `effect`                     | Model  | `findings.effect` (nullable; see Open questions)                           | No                                    |
| `ambiguous`                  | Model  | `findings.ambiguous`                                                       | No                                    |
| `conditional`                | Model  | `findings.conditional`                                                     | No                                    |
| `recipientTypes`             | Model  | `findings.recipient_types`                                                 | No                                    |
| `purposeTypes`               | Model  | `findings.purpose_types`                                                   | No                                    |

The five scoring fields (`effect` through `purposeTypes`) are optional in the contract. They are used
by personalized evaluation (#12), not displayed directly.

### Evidence

| Field       | Source | Stored in                                                           | Shown                                                           |
| ----------- | ------ | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| `passageId` | Model  | `findings.evidence[].passageId`                                     | No                                                              |
| `excerpt`   | Model  | `findings.evidence[].excerpt` (checked by `evidence_objects_valid`) | Yes, under "Policy excerpts" (open by default only on Detailed) |

The stored evidence also has `startOffset`, `endOffset`, and `match`, which locate the excerpt in
`analyses.source_text`. The contract does not include them.

### Takeaway

Takeaways are not stored. The results loader builds one per finding category from the saved findings.

| Field        | Source | How it is built                                                | Shown                                                    |
| ------------ | ------ | -------------------------------------------------------------- | -------------------------------------------------------- |
| `id`         | Server | The category name                                              | No                                                       |
| `topic`      | Server | A fixed label per category                                     | Yes                                                      |
| `reason`     | Server | A sentence built from the findings' `effect` values            | Yes                                                      |
| `label`      | Server | `unclear` if any finding is ambiguous, otherwise from `effect` | Yes                                                      |
| `findingIds` | Server | The IDs of the findings in that category                       | No (groups the findings and excerpts under the takeaway) |

## `preferences.ts`

### Stored preferences

`StoredPreferencesSchema` is saved as one JSON object in `privacy_preferences.preferences`, one row per
user (`privacy_preferences.user_id`), with `privacy_preferences.schema_version = 1`. Missing fields get
defaults when read, so older objects still load.

| Field        | Source | Default    | Intended use                                                       |
| ------------ | ------ | ---------- | ------------------------------------------------------------------ |
| `profile`    | User   | `balanced` | Personalized evaluation: which profile's levels to compare against |
| `focusAreas` | User   | `[]`       | Results page relevance and ordering only; not scoring              |
| `detail`     | User   | `balanced` | How much text the results page shows                               |
| `style`      | User   | `bullets`  | How answers are written                                            |

Today these are saved and loaded by the Preferences page only. No other page reads them yet; see Open
questions.

`profile` controls what gets flagged. `focusAreas`, `detail`, and `style` only control how results are
shown. The Preferences page does not have a profile control yet, so every user is `balanced` until one
is added; saving display preferences keeps an existing `profile`.

### Preference snapshot

`PreferenceSnapshotSchema` is saved in `analyses.preference_snapshot`, with
`analyses.preference_schema_version`. The database requires both or neither. It records the exact
levels used for that analysis, so a saved result stays explainable after profiles or rules change
(FR-12). Build new snapshots with `createPreferenceSnapshot`.

| Field          | Source | Stored in                                   |
| -------------- | ------ | ------------------------------------------- |
| `profile`      | User   | `analyses.preference_snapshot.profile`      |
| `levels`       | Server | `analyses.preference_snapshot.levels`       |
| `rulesVersion` | Server | `analyses.preference_snapshot.rulesVersion` |

The analysis endpoint does not save a snapshot yet; see Open questions.

### Preference evaluation

`PreferenceEvaluationSchema` is the output of `evaluatePreferences` (#12). Only its six indicators are
stored, as rows in `preference_evaluations`.

| Field                       | Source | Stored in                                                                                         | Shown   |
| --------------------------- | ------ | ------------------------------------------------------------------------------------------------- | ------- |
| `indicators[].concern`      | Server | `preference_evaluations.preference_key`                                                           | Planned |
| `indicators[].level`        | Server | `preference_evaluations.preference_value` (JSON)                                                  | Planned |
| `indicators[].indicator`    | Server | `preference_evaluations.indicator` (same three values as the database enum)                       | Planned |
| `indicators[].findingId`    | Server | `preference_evaluations.finding_id` (a `findings.id` UUID; null only for `insufficient_evidence`) | Planned |
| `indicators[].tier`         | Server | Not stored; see Open questions                                                                    | Planned |
| `indicators[].explanation`  | Server | `preference_evaluations.explanation`                                                              | Planned |
| Order of `indicators`       | Server | `preference_evaluations.display_order`                                                            | Planned |
| `rulesVersion`, `profile`   | Server | Not stored here; recorded in `analyses.preference_snapshot`                                       | No      |
| `counts`, `summary`         | Server | Not stored; derived from the indicators                                                           | Planned |
| `needsReview`, `ungrounded` | Server | Not stored                                                                                        | No      |

## IDs and versions

- **Analysis ID:** `analyses.id`, a UUID created when an analysis is saved.
- **Finding ID:** Stage 2 uses IDs like `F001` while it runs. `toFindingRows` replaces them with
  `findings.id` UUIDs when saving and returns the mapping, so evaluations can reference the saved
  finding. After saving, the contract's `id` is always the UUID.
- **`schemaVersion`:** the version of the analysis result shape, stored as `result_schema_version`.
- **`RULES_VERSION`:** the version of the scoring rules in `docs/scoring-model.md`. Currently `'1'`.
  Bump it when the rules change; old snapshots keep their version.
- **`privacy_preferences.schema_version`:** the version of the stored preferences shape. Currently `1`.

## Open questions

These are places where the contract and the database or loader do not line up yet. Each needs a
decision or a follow-up issue.

1. **`effect` can be null in the database.** The contract's `effect` is optional, not nullable, so the
   loader must leave the field out when the column is null.
2. **The results loader drops the scoring fields.** It reads `effect` and `ambiguous` only for
   takeaways, does not read `conditional`, `purpose_types`, or `recipient_types`, and passes none of
   the five into findings. The result is also not validated against `AnalysisResultSchema`.
3. **`schemaVersion` is hard-coded to `1`** in the loader instead of read from
   `result_schema_version`.
4. **`analysisId` for `in_progress` and `failed` is the source ID,** because no analysis row exists
   yet. Determine whether that is the intended meaning.
5. **`tier` is not stored.** A reopened result can show conflict or alignment but not how serious the
   linked finding was, unless the tier is recomputed or a column is added.
6. **Stored-only finding fields:** `condition_note`, `uncertainty_note`, and `relevant_preferences`
   exist in `findings` but not in the contract. Determine whether the results page needs them.
7. **No snapshot or evaluations are saved yet.** The analysis endpoint passes `p_evaluations: []` and
   no `preference_snapshot`. This is waiting on the scorer (#12) and its wiring.
8. **Chat** (`chats`, `chat_messages`, #74 and #80) has no contract here yet. It is planned with the
   chat API (#75).
9. **Saved display preferences are not applied.** The results page takes the detail level from the
   `?detail=` URL parameter, not from the user's saved `detail`, and nothing reads `focusAreas` or
   `style` yet.

## Reviewing this file

Changes to a contract, a column it maps to, or the loader that converts between them should update
this README in the same PR.
