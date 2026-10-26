# Saving completed analyses

Migration `20261025015740_link_sources_and_save_analysis.sql` adds
`analyses.source_id` and `public.save_analysis`.

## Source relationship

The source and analysis must belong to the same authenticated user.
Historical analyses may retain a null source reference; the save function
requires a source.

Delete linked analyses before deleting their source. Account deletion
removes both analyses and sources. Each analysis preserves its source
text snapshot, and findings link to the source through their analysis.

## Function inputs

Call `save_analysis` with three arguments:

- `p_analysis`: analysis metadata and completion status.
- `p_findings`: database-ready finding rows.
- `p_evaluations`: preference indicators with mapped finding UUIDs.

The analysis object includes:

| Field                       | Requirement                                                   |
| --------------------------- | ------------------------------------------------------------- |
| `id`                        | Stable analysis UUID                                          |
| `source_id`                 | Existing source owned by the authenticated user               |
| `source_type`               | `url` or `pasted_text`                                        |
| `submitted_url`             | Required for URL input; absent/null for pasted text           |
| `source_text`               | Exact text stored in the source                               |
| `summary`                   | Nonblank summary                                              |
| `outcome`                   | `findings_identified` or `no_findings`, matching the findings |
| `analysis_status`           | `complete`                                                    |
| `result_schema_version`     | Positive integer; defaults to 1                               |
| `preference_snapshot`       | Preference context used for personalization                   |
| `preference_schema_version` | Positive snapshot format version                              |

Snapshot and version must both be absent/null without personalization.
Evaluations require both. Title and final URL are copied from the source.
Ownership is derived from `auth.uid()`.

## Mapping findings and evaluations

Use `toFindingRows(result, analysisId)` from
`src/lib/server/analysis/consolidation/rows.ts`.

Its `rows` are the finding input. Its `idMap` maps Stage 2 IDs such as
`F003` to database UUIDs.

```ts
const mapped = toFindingRows(result, analysisId);

const evaluations = evaluation.indicators.map((item) => {
	const findingId = item.findingId === null ? null : mapped.idMap[item.findingId];

	if (item.findingId !== null && !findingId) {
		throw new Error('Evaluation references an unknown finding');
	}

	return {
		concern: item.concern,
		level: item.level,
		indicator: item.indicator,
		findingId,
		explanation: item.explanation
	};
});
```

Alignment and conflict require a finding reference.
Insufficient evidence can use explicit null.
Evaluation array order determines display order.
Concern maps to `preference_key`; level maps to `preference_value`
as a JSON string.

## Saving

Use a Supabase client carrying the authenticated user's session.
Build `analysis` using the fields listed above.

```ts
const { data: savedId, error } = await supabase.rpc('save_analysis', {
	p_analysis: analysis,
	p_findings: mapped.rows,
	p_evaluations: evaluations
});

if (error) throw error;
```

The function returns the analysis UUID. It runs with caller privileges
and existing row-level security policies.

## Transactions and retries

All three record types save in one transaction. A failure rolls back
the entire call.

Retain and reuse the exact payload for retries, including analysis UUID,
finding UUIDs, and array order. Identical retries return the existing
analysis UUID without duplicates. Changed inputs with the same analysis
UUID are rejected.

Do not regenerate finding UUIDs between retries.

The application validates AI completion and scoring before saving.
The function checks the completion flag and database consistency; it
does not prove AI completion or calculate preference alignment.

Direct table insert privileges remain available. Atomic saving is
guaranteed for calls through this function.

## Verification

Run `npm run test:db` with Docker running. Tests cover successful saves,
ownership, retries, rollback, incomplete results, source-text mismatch,
null finding references, source deletion, anonymous access, and account
deletion.
