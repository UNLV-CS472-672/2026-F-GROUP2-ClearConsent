import { describe, expect, it, vi } from 'vitest';
import { Stage1Error } from '../errors';
import { NO_FINDINGS_SUMMARY, runStage2Consolidation } from './pipeline';
import type { Stage2Provider } from './provider';
import {
	FITNESS_POLICY,
	fitnessCandidates,
	fitnessFindings,
	modelFinding,
	sentence,
	stage1Candidate,
	stage1Result,
	stage2ProviderWith,
	SUMMARY
} from './test-fixtures';

function output(findings = fitnessFindings(), exclusions: unknown[] = []) {
	return { summary: SUMMARY, findings, exclusions };
}

describe('Stage 2 consolidation', () => {
	it('turns the fitness example into complete, source-linked findings', async () => {
		const stage1 = await stage1Result(fitnessCandidates());
		const provider = stage2ProviderWith(output());
		const result = await runStage2Consolidation(stage1, provider);

		expect(result).toMatchObject({
			stage: 'consolidation',
			stageStatus: 'complete',
			analysisStatus: 'complete',
			outcome: 'findings_identified',
			summary: SUMMARY,
			excludedCandidates: [],
			rejectedOutput: [],
			downstream: { nextStage: 'personalized_evaluation', preferences: null }
		});
		expect(result.findings).toHaveLength(6);
		expect(result.extraction).toBe(stage1);
		expect(result.provider?.usage?.totalTokens).toBe(15);
		expect(result).not.toHaveProperty('score');

		// Merged candidates contribute all of their evidence, in source order.
		const sharing = result.findings.find((finding) => finding.candidateIds.includes('C002'))!;
		expect(sharing.candidateIds).toEqual(['C002', 'C007']);
		expect(sharing.evidence.map((item) => item.excerpt)).toEqual([sentence(1), sentence(6)]);
		expect(sharing).toMatchObject({ conditional: true, recipientTypes: ['advertiser'] });
	});

	it('builds evidence only from verified Stage 1 excerpts sliced from the source', async () => {
		const result = await runStage2Consolidation(
			await stage1Result(fitnessCandidates()),
			stage2ProviderWith(output())
		);
		for (const finding of result.findings) {
			expect(finding.evidence.length).toBeGreaterThan(0);
			for (const item of finding.evidence) {
				expect(item.status).toBe('verified');
				expect(FITNESS_POLICY.slice(item.startOffset, item.endOffset)).toBe(item.excerpt);
			}
		}
	});

	it('rejects model output that tries to supply its own evidence', async () => {
		const injected = { ...modelFinding(), evidence: [{ excerpt: 'We sell your data.' }] };
		await expect(
			runStage2Consolidation(
				await stage1Result(fitnessCandidates()),
				stage2ProviderWith(output([injected]))
			)
		).rejects.toMatchObject({ code: 'provider_malformed' });
	});

	it('orders findings by category, then source position, when there are no preferences', async () => {
		const result = await runStage2Consolidation(
			await stage1Result(fitnessCandidates()),
			stage2ProviderWith(output())
		);
		expect(result.findings.map((finding) => [finding.id, finding.category])).toEqual([
			['F001', 'collection'],
			['F002', 'sharing'],
			['F003', 'sharing'],
			['F004', 'retention'],
			['F005', 'user_rights'],
			['F006', 'security_practices']
		]);
		expect(result.findings[1].candidateIds).toEqual(['C001']);
	});

	it('gives the same result whatever order the model returns findings in', async () => {
		const stage1 = await stage1Result(fitnessCandidates());
		const forward = await runStage2Consolidation(stage1, stage2ProviderWith(output()));
		const reversed = await runStage2Consolidation(
			stage1,
			stage2ProviderWith(output(fitnessFindings().reverse()))
		);
		expect(reversed.findings).toEqual(forward.findings);
	});

	it('sends preferences to the model and shows findings related to them first', async () => {
		const preferences = { retention: 'major', sharing: 'some' };
		const stage1 = await stage1Result(fitnessCandidates(), preferences);
		const findings = fitnessFindings();
		findings[4].relevantPreferences = ['retention', 'not_a_user_key'];
		findings[1].relevantPreferences = ['sharing', 'retention', 'sharing'];
		const provider = stage2ProviderWith(output(findings));
		const result = await runStage2Consolidation(stage1, provider);

		expect(provider.consolidate).toHaveBeenCalledWith(expect.objectContaining({ preferences }));
		expect(result.downstream.preferences).toEqual(preferences);
		// Relevant findings first, then the rest in the normal order.
		expect(result.findings.map((finding) => finding.category)).toEqual([
			'sharing',
			'retention',
			'collection',
			'sharing',
			'user_rights',
			'security_practices'
		]);
		// Unknown keys are dropped; keys keep the preferences' own order.
		expect(result.findings[0].relevantPreferences).toEqual(['retention', 'sharing']);
		expect(result.findings[1].relevantPreferences).toEqual(['retention']);
		// Preferences change only relevance and order, never the finding content.
		const neutral = await runStage2Consolidation(
			await stage1Result(fitnessCandidates()),
			stage2ProviderWith(output(findings))
		);
		const strip = (items: typeof result.findings) =>
			items
				.map((finding) => ({ ...finding, id: '', relevantPreferences: [] }))
				.sort((a, b) => a.candidateIds[0].localeCompare(b.candidateIds[0]));
		expect(strip(result.findings)).toEqual(strip(neutral.findings));
		expect(neutral.findings.every((finding) => finding.relevantPreferences.length === 0)).toBe(
			true
		);
	});

	it('holds back candidates with any unverified excerpt and never sends them to the model', async () => {
		const candidates = fitnessCandidates();
		candidates[2] = stage1Candidate(sentence(2), [sentence(2), 'You may delete it later.']);
		const stage1 = await stage1Result(candidates);
		const findings = fitnessFindings().filter((finding) => finding.candidateIds[0] !== 'C003');
		const provider = stage2ProviderWith(output(findings));
		const result = await runStage2Consolidation(stage1, provider);

		const sent = vi.mocked(provider.consolidate).mock.calls[0][0];
		expect(sent.candidates.map((candidate) => candidate.id)).not.toContain('C003');
		expect(result.excludedCandidates).toEqual([
			expect.objectContaining({ candidateId: 'C003', code: 'unverified_evidence' })
		]);
		// A reported hold-back does not block completion.
		expect(result.analysisStatus).toBe('complete');
	});

	it('rejects a finding that cites a held-back or unknown candidate', async () => {
		const candidates = fitnessCandidates();
		candidates[2] = stage1Candidate(sentence(2), [sentence(2), 'You may delete it later.']);
		const findings = fitnessFindings();
		findings[0].candidateIds = ['C001', 'C099'];
		const result = await runStage2Consolidation(
			await stage1Result(candidates),
			stage2ProviderWith(output(findings))
		);

		expect(result.rejectedOutput).toEqual([
			{ kind: 'finding', index: 0, reason: expect.stringContaining('C099') },
			{ kind: 'finding', index: 2, reason: expect.stringContaining('C003') }
		]);
		expect(result.excludedCandidates.map((item) => [item.candidateId, item.code])).toEqual([
			['C001', 'unaccounted'],
			['C003', 'unverified_evidence']
		]);
		expect(result).toMatchObject({
			stageStatus: 'partial',
			analysisStatus: 'in_progress',
			outcome: null
		});
	});

	it('reports a candidate the model left out instead of dropping it', async () => {
		const findings = fitnessFindings().filter((finding) => finding.candidateIds[0] !== 'C006');
		const result = await runStage2Consolidation(
			await stage1Result(fitnessCandidates()),
			stage2ProviderWith(output(findings))
		);

		expect(result.excludedCandidates).toEqual([
			expect.objectContaining({ candidateId: 'C006', code: 'unaccounted' })
		]);
		expect(result.analysisStatus).toBe('in_progress');
	});

	it('keeps a model exclusion with its reason and still completes', async () => {
		const candidates = [
			...fitnessCandidates(),
			stage1Candidate('Location is sold to data brokers.', [sentence(1)])
		];
		const result = await runStage2Consolidation(
			await stage1Result(candidates),
			stage2ProviderWith(
				output(fitnessFindings(), [
					{ candidateId: 'C008', reason: 'The sentence describes sharing, not sale.' }
				])
			)
		);

		expect(result.excludedCandidates).toEqual([
			{
				candidateId: 'C008',
				code: 'model_excluded',
				reason: 'The sentence describes sharing, not sale.'
			}
		]);
		expect(result.analysisStatus).toBe('complete');
	});

	it.each([
		[{ candidateId: 'C001', reason: 'Contradicts a finding.' }, 'both excluded and used'],
		[{ candidateId: 'C042', reason: 'Unknown.' }, 'unknown candidate'],
		[{ candidateId: 'C001', reason: '   ' }, 'no reason']
	])('rejects an invalid exclusion %#', async (exclusion, message) => {
		const result = await runStage2Consolidation(
			await stage1Result(fitnessCandidates()),
			stage2ProviderWith(output(fitnessFindings(), [exclusion]))
		);
		expect(result.rejectedOutput).toEqual([
			{ kind: 'exclusion', index: 0, reason: expect.stringContaining(message) }
		]);
		expect(result.stageStatus).toBe('partial');
	});

	it('rejects a repeated exclusion of the same candidate', async () => {
		const findings = fitnessFindings().filter((finding) => finding.candidateIds[0] !== 'C006');
		const reason = 'Not supported.';
		const result = await runStage2Consolidation(
			await stage1Result(fitnessCandidates()),
			stage2ProviderWith(
				output(findings, [
					{ candidateId: 'C006', reason },
					{ candidateId: 'C006', reason }
				])
			)
		);
		expect(result.rejectedOutput).toEqual([
			{ kind: 'exclusion', index: 1, reason: expect.stringContaining('more than once') }
		]);
		expect(result.excludedCandidates).toEqual([
			{ candidateId: 'C006', code: 'model_excluded', reason }
		]);
	});

	it.each([
		[{ conditional: true, conditionNote: '  ' }, 'no condition note'],
		[{ ambiguous: true, uncertaintyNote: null }, 'no uncertainty note'],
		[{ description: ' ' }, 'blank description'],
		[{ candidateIds: [] }, 'cites no candidate']
	])('rejects a finding with missing required text %#', async (overrides, message) => {
		const findings = fitnessFindings();
		findings[0] = { ...findings[0], ...overrides };
		const result = await runStage2Consolidation(
			await stage1Result(fitnessCandidates()),
			stage2ProviderWith(output(findings))
		);
		expect(result.rejectedOutput).toEqual([
			{ kind: 'finding', index: 0, reason: expect.stringContaining(message) }
		]);
		expect(result.analysisStatus).toBe('in_progress');
	});

	it('cleans text lists and keeps fixed-value lists in their declared order', async () => {
		const findings = fitnessFindings();
		findings[0] = {
			...findings[0],
			description: '  Card numbers are shared.  ',
			conditionNote: '   ',
			recipients: [' payment processor ', 'payment processor', ''],
			purposeTypes: ['legal_security', 'service', 'service'],
			recipientTypes: ['other', 'service_provider']
		};
		const result = await runStage2Consolidation(
			await stage1Result(fitnessCandidates()),
			stage2ProviderWith(output(findings))
		);
		const finding = result.findings.find((item) => item.candidateIds[0] === 'C001')!;
		expect(finding).toMatchObject({
			description: 'Card numbers are shared.',
			conditionNote: null,
			recipients: ['payment processor'],
			purposeTypes: ['service', 'legal_security'],
			recipientTypes: ['service_provider', 'other']
		});
	});

	it('completes with no findings when the model excludes every candidate', async () => {
		const exclusions = fitnessCandidates().map((_, index) => ({
			candidateId: `C00${index + 1}`,
			reason: 'Not about personal data.'
		}));
		const result = await runStage2Consolidation(
			await stage1Result(fitnessCandidates()),
			stage2ProviderWith(output([], exclusions))
		);
		expect(result).toMatchObject({
			analysisStatus: 'complete',
			outcome: 'no_findings',
			findings: []
		});
	});

	it('fails when every finding the model returned is invalid', async () => {
		const findings = fitnessFindings().map((finding) => ({ ...finding, candidateIds: ['C999'] }));
		await expect(
			runStage2Consolidation(
				await stage1Result(fitnessCandidates()),
				stage2ProviderWith(output(findings))
			)
		).rejects.toMatchObject({ code: 'provider_malformed' });
	});

	it('fails on a blank summary', async () => {
		await expect(
			runStage2Consolidation(
				await stage1Result(fitnessCandidates()),
				stage2ProviderWith({ ...output(), summary: '  ' })
			)
		).rejects.toMatchObject({ code: 'provider_malformed' });
	});

	it('fails on output that does not match the schema', async () => {
		await expect(
			runStage2Consolidation(
				await stage1Result(fitnessCandidates()),
				stage2ProviderWith({ summary: SUMMARY, findings: [{ category: 'privacy' }] })
			)
		).rejects.toMatchObject({ code: 'provider_malformed' });
	});

	it('skips the model and reports no findings when Stage 1 found no candidates', async () => {
		const provider = stage2ProviderWith(output());
		const result = await runStage2Consolidation(await stage1Result([]), provider);

		expect(provider.consolidate).not.toHaveBeenCalled();
		expect(result).toMatchObject({
			stageStatus: 'complete',
			analysisStatus: 'complete',
			outcome: 'no_findings',
			summary: NO_FINDINGS_SUMMARY,
			findings: [],
			provider: null
		});
		expect(result.summary).toMatch(/does not mean the policy has no privacy risks/);
		expect(JSON.stringify(result)).not.toMatch(/\bsafe\b|low.risk/i);
	});

	it('fails without a model call when no candidate is fully verified', async () => {
		const candidates = [stage1Candidate(sentence(0), [sentence(0), 'Invented sentence here.'])];
		const provider = stage2ProviderWith(output());
		await expect(
			runStage2Consolidation(await stage1Result(candidates), provider)
		).rejects.toMatchObject({ code: 'reference_validation_failed' });
		expect(provider.consolidate).not.toHaveBeenCalled();
	});

	it('refuses a Stage 1 result whose evidence no longer matches the source', async () => {
		const stage1 = await stage1Result(fitnessCandidates());
		const evidence = stage1.candidates[0].evidence[0];
		if (evidence.status === 'verified') evidence.excerpt = 'We sell card numbers.';
		const provider = stage2ProviderWith(output());
		await expect(runStage2Consolidation(stage1, provider)).rejects.toMatchObject({
			code: 'reference_validation_failed'
		});
		expect(provider.consolidate).not.toHaveBeenCalled();
	});

	it('keeps provider failures distinct and wraps unexpected ones', async () => {
		const stage1 = await stage1Result(fitnessCandidates());
		const timeout: Stage2Provider = {
			consolidate: vi
				.fn()
				.mockRejectedValue(
					new Stage1Error('provider_timeout', 504, 'Timed out.', { retryable: true })
				)
		};
		await expect(runStage2Consolidation(stage1, timeout)).rejects.toMatchObject({
			code: 'provider_timeout'
		});

		const broken: Stage2Provider = { consolidate: vi.fn().mockRejectedValue(new Error('boom')) };
		await expect(runStage2Consolidation(stage1, broken)).rejects.toMatchObject({
			code: 'provider_unavailable'
		});
	});
});
