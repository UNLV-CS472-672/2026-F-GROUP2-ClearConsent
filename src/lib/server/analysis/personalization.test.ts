import { describe, expect, it, vi } from 'vitest';
import {
	PreferenceSnapshotSchema,
	ProfileIdEnum,
	createPreferenceSnapshot,
	type ProfileId
} from '$lib/contracts/preferences';
import type { Finding } from '$lib/contracts/analysis';
import { evaluatePreferences } from '$lib/risk';
import { FINDING_COLUMNS, type FindingRow, toAnalysisResult } from '../analysis';
import { runConsolidation, toFindingRows } from './consolidation';
import {
	SUMMARY,
	consolidationProviderWith,
	extractionResult,
	fitnessCandidates,
	fitnessFindings
} from './consolidation/test-fixtures';
import {
	PREFERENCE_SNAPSHOT_VERSION,
	PreferenceLoadError,
	buildPreferenceSave,
	loadPreferenceEvaluation,
	loadProfile
} from './personalization';

const USER_ID = '11000000-0000-4000-8000-000000000001';
const CONCERNS = ['collection', 'use', 'sharing', 'retention', 'user_rights', 'security_practices'];

// A privacy_preferences read that returns one result, recording how it was filtered.
function preferencesClient(result: { data: unknown; error: { message: string } | null }) {
	const eq = vi.fn(() => ({ maybeSingle: async () => result }));
	const select = vi.fn(() => ({ eq }));
	const from = vi.fn(() => ({ select }));
	return { client: { from } as unknown as Parameters<typeof loadProfile>[0], from, select, eq };
}

function savedRow(preferences: unknown, schemaVersion = 1) {
	return { data: { preferences, schema_version: schemaVersion }, error: null };
}

// Complete Stage 2 output for the fitness policy (sect. 8), saved under fixed UUIDs.
async function savedFitnessAnalysis() {
	const result = await runConsolidation(
		await extractionResult(fitnessCandidates()),
		consolidationProviderWith({ summary: SUMMARY, findings: fitnessFindings(), exclusions: [] })
	);
	let next = 0;
	const { rows, idMap } = toFindingRows(result, 'analysis-uuid', () => `finding-uuid-${++next}`);
	return { result, rows, idMap };
}

describe('loadProfile', () => {
	it('uses Balanced for a user who has never saved preferences', async () => {
		const { client, from, select, eq } = preferencesClient({ data: null, error: null });

		await expect(loadProfile(client, USER_ID)).resolves.toBe('balanced');
		expect(from).toHaveBeenCalledWith('privacy_preferences');
		expect(select).toHaveBeenCalledWith('preferences, schema_version');
		// Only the signed-in user's row.
		expect(eq).toHaveBeenCalledWith('user_id', USER_ID);
	});

	it.each(ProfileIdEnum.options)('uses a saved %s profile', async (profile) => {
		const { client } = preferencesClient(savedRow({ profile, detail: 'detailed' }));

		await expect(loadProfile(client, USER_ID)).resolves.toBe(profile);
	});

	it('uses Balanced when saved preferences have no profile yet', async () => {
		// #71 saves display choices without a profile until the picker exists.
		const { client } = preferencesClient(savedRow({ focusAreas: ['sharing'], detail: 'quick' }));

		await expect(loadProfile(client, USER_ID)).resolves.toBe('balanced');
	});

	it('fails with 503 instead of guessing when the preferences cannot be read', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { client } = preferencesClient({ data: null, error: { message: 'timeout' } });

		const failure = loadProfile(client, USER_ID);
		await expect(failure).rejects.toBeInstanceOf(PreferenceLoadError);
		await expect(failure).rejects.toMatchObject({ status: 503 });
	});

	it.each([
		['an unknown profile', savedRow({ profile: 'paranoid' })],
		['an unknown field', savedRow({ profile: 'strict', extra: true })],
		['a newer schema version', savedRow({ profile: 'strict' }, 2)]
	])('fails with 500 for %s', async (_label, row) => {
		const { client } = preferencesClient(row);

		await expect(loadProfile(client, USER_ID)).rejects.toMatchObject({
			name: 'PreferenceLoadError',
			status: 500
		});
	});
});

describe('buildPreferenceSave', () => {
	it.each(ProfileIdEnum.options)(
		'saves one indicator per concern and the %s snapshot',
		async (profile) => {
			const { result, rows, idMap } = await savedFitnessAnalysis();
			const saved = buildPreferenceSave(result.findings, profile, idMap);

			expect(saved.snapshot).toEqual(createPreferenceSnapshot(profile));
			expect(PreferenceSnapshotSchema.parse(saved.snapshot)).toEqual(saved.snapshot);
			expect(saved.snapshotVersion).toBe(PREFERENCE_SNAPSHOT_VERSION);

			expect(saved.evaluations).toHaveLength(6);
			expect(new Set(saved.evaluations.map((e) => e.concern))).toEqual(new Set(CONCERNS));

			const savedIds = new Set(rows.map((row) => row.id));
			for (const item of saved.evaluations) {
				expect(Object.keys(item).sort()).toEqual(
					['concern', 'explanation', 'findingId', 'indicator', 'level'].sort()
				);
				expect(item.level).toBe(saved.snapshot.levels[item.concern]);
				expect(item.explanation.trim()).not.toBe('');
				// Matches the database check: only insufficient evidence has no finding, and a linked
				// finding is one saved in the same call.
				if (item.indicator === 'insufficient_evidence') {
					expect(item.findingId).toBeNull();
				} else {
					expect(savedIds.has(item.findingId!)).toBe(true);
				}
			}
		}
	);

	it('keeps the scorer order and content, with finding IDs mapped to saved UUIDs', async () => {
		const { result, idMap } = await savedFitnessAnalysis();
		const evaluation = evaluatePreferences(result.findings, 'balanced');

		expect(buildPreferenceSave(result.findings, 'balanced', idMap).evaluations).toEqual(
			evaluation.indicators.map((item) => ({
				concern: item.concern,
				level: item.level,
				indicator: item.indicator,
				findingId: item.findingId === null ? null : idMap[item.findingId],
				explanation: item.explanation
			}))
		);
	});

	it('gives Strict and Relaxed users different indicators for the same policy (FR-9)', async () => {
		const { result, idMap } = await savedFitnessAnalysis();
		const indicators = (profile: ProfileId) =>
			buildPreferenceSave(result.findings, profile, idMap).evaluations.map(
				(e) => `${e.concern}:${e.indicator}`
			);

		expect(indicators('strict')).not.toEqual(indicators('relaxed'));
		expect(indicators('strict').filter((i) => i.endsWith(':conflict')).length).toBeGreaterThan(
			indicators('relaxed').filter((i) => i.endsWith(':conflict')).length
		);
	});

	it('never links an ambiguous finding to an indicator', async () => {
		const { result, idMap } = await savedFitnessAnalysis();
		const ambiguous = result.findings.filter((finding) => finding.ambiguous);
		expect(ambiguous.length).toBeGreaterThan(0);

		for (const profile of ProfileIdEnum.options) {
			const linked = buildPreferenceSave(result.findings, profile, idMap).evaluations.map(
				(e) => e.findingId
			);
			for (const finding of ambiguous) {
				expect(linked).not.toContain(idMap[finding.id]);
			}
		}
	});

	it('throws instead of saving an indicator whose finding was not saved', async () => {
		const { result, idMap } = await savedFitnessAnalysis();
		const partial = { ...idMap };
		for (const item of evaluatePreferences(result.findings, 'balanced').indicators) {
			if (item.findingId !== null) delete partial[item.findingId];
		}

		expect(() => buildPreferenceSave(result.findings, 'balanced', partial)).toThrow(
			/No saved ID for finding F\d{3}/
		);
	});
});

// What the results page loads back for an analysis saved under a profile: the findings as
// toAnalysisResult gives them, and the analyses and preference_evaluations rows as stored.
async function savedForLoading(profile: ProfileId) {
	const { result, rows, idMap } = await savedFitnessAnalysis();
	const saved = buildPreferenceSave(result.findings, profile, idMap);
	const columns = FINDING_COLUMNS.split(',').map((column) => column.trim());
	const loaded = toAnalysisResult(
		{ id: 'analysis-uuid', summary: SUMMARY, model: null, reasoning_effort: null },
		rows.map(
			(row) =>
				Object.fromEntries(
					columns.map((column) => [column, (row as Record<string, unknown>)[column]])
				) as FindingRow
		)
	);
	if (loaded.status !== 'success') throw new Error('Expected a success result');
	return {
		findings: loaded.findings,
		analysis: {
			preference_snapshot: saved.snapshot,
			preference_schema_version: saved.snapshotVersion
		},
		evaluationRows: saved.evaluations.map((item) => ({
			preference_key: item.concern,
			preference_value: item.level,
			indicator: item.indicator,
			finding_id: item.findingId,
			explanation: item.explanation
		}))
	};
}

type Read = { data: unknown; error: { message: string } | null };

// Answers the analyses read and the preference_evaluations read, recording which tables were read.
function savedClient(analysis: Read, evaluations: Read) {
	const from = vi.fn((table: string) => {
		const result = table === 'analyses' ? analysis : evaluations;
		const chain = {
			select: () => chain,
			eq: () => chain,
			order: async () => result,
			maybeSingle: async () => result
		};
		return chain;
	});
	return { client: { from } as unknown as Parameters<typeof loadPreferenceEvaluation>[0], from };
}

const ok = (data: unknown): Read => ({ data, error: null });

describe('loadPreferenceEvaluation', () => {
	it.each(ProfileIdEnum.options)(
		'rebuilds the full %s evaluation the scorer gave when it was saved',
		async (profile) => {
			const { findings, analysis, evaluationRows } = await savedForLoading(profile);
			const { client } = savedClient(ok(analysis), ok(evaluationRows));

			const loaded = await loadPreferenceEvaluation(client, 'analysis-uuid', findings);

			// Same indicators, tiers, review list, counts, and summary, against the saved finding IDs.
			expect(loaded).toEqual(evaluatePreferences(findings, profile));
		}
	);

	it('shows what was saved, not what the current rules would give', async () => {
		const { findings, analysis, evaluationRows } = await savedForLoading('strict');
		const changed = evaluationRows.map((row, index) =>
			index === 0 ? { ...row, explanation: 'Saved wording from an earlier version.' } : row
		);
		const { client } = savedClient(ok(analysis), ok(changed));

		const loaded = await loadPreferenceEvaluation(client, 'analysis-uuid', findings);

		expect(loaded!.profile.id).toBe('strict');
		expect(loaded!.indicators[0].explanation).toBe('Saved wording from an earlier version.');
	});

	it('lists ambiguous findings for review instead of as indicators', async () => {
		const { findings, analysis, evaluationRows } = await savedForLoading('balanced');
		const { client } = savedClient(ok(analysis), ok(evaluationRows));
		const ambiguous = findings.filter((finding: Finding) => finding.ambiguous);
		expect(ambiguous.length).toBeGreaterThan(0);

		const loaded = (await loadPreferenceEvaluation(client, 'analysis-uuid', findings))!;

		for (const finding of ambiguous) {
			expect(loaded.needsReview).toContainEqual({ findingId: finding.id, reason: 'ambiguous' });
			expect(loaded.indicators.map((item) => item.findingId)).not.toContain(finding.id);
		}
	});

	it('returns null for an analysis saved before indicators were', async () => {
		const { findings } = await savedForLoading('balanced');
		const { client, from } = savedClient(
			ok({ preference_snapshot: null, preference_schema_version: null }),
			ok([])
		);

		await expect(loadPreferenceEvaluation(client, 'analysis-uuid', findings)).resolves.toBeNull();
		expect(from).not.toHaveBeenCalledWith('preference_evaluations');
	});

	it.each([
		['the snapshot cannot be read', 'analyses'],
		['the indicators cannot be read', 'preference_evaluations']
	])('throws instead of showing no indicators when %s', async (_label, failing) => {
		const { findings, analysis, evaluationRows } = await savedForLoading('balanced');
		const failure = { data: null, error: { message: 'timeout' } };
		const { client } = savedClient(
			failing === 'analyses' ? failure : ok(analysis),
			failing === 'analyses' ? ok(evaluationRows) : failure
		);

		await expect(loadPreferenceEvaluation(client, 'analysis-uuid', findings)).rejects.toThrow(
			/timeout/
		);
	});

	it.each([
		['an unknown snapshot version', { preference_schema_version: 2 }],
		['a malformed snapshot', { preference_snapshot: { profile: 'paranoid' } }]
	])('throws for %s', async (_label, override) => {
		const { findings, analysis, evaluationRows } = await savedForLoading('balanced');
		const { client } = savedClient(ok({ ...analysis, ...override }), ok(evaluationRows));

		await expect(loadPreferenceEvaluation(client, 'analysis-uuid', findings)).rejects.toThrow();
	});

	it('throws when the saved indicators do not fit the snapshot', async () => {
		const { findings, analysis, evaluationRows } = await savedForLoading('balanced');
		// Missing a concern, and a level that doesn't match the Balanced snapshot.
		const broken = [
			{ ...evaluationRows[0], preference_value: 'acceptable' },
			...evaluationRows.slice(2)
		];
		const { client } = savedClient(ok(analysis), ok(broken));

		await expect(loadPreferenceEvaluation(client, 'analysis-uuid', findings)).rejects.toThrow();
	});

	it('throws when an indicator links a finding that was not loaded', async () => {
		const { findings, analysis, evaluationRows } = await savedForLoading('balanced');
		const linked = evaluationRows.find((row) => row.finding_id !== null)!.finding_id;
		const { client } = savedClient(ok(analysis), ok(evaluationRows));

		await expect(
			loadPreferenceEvaluation(
				client,
				'analysis-uuid',
				findings.filter((finding: Finding) => finding.id !== linked)
			)
		).rejects.toThrow(/was not loaded/);
	});
});
