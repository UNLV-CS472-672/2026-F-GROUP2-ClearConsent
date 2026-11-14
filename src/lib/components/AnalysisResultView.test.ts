import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { AnalysisResult } from '$lib/contracts/analysis';
import {
	FailureFixture,
	InProgressFixture,
	InsufficientFixture as rawInsufficientFixture,
	successFixture as rawSuccessFixture
} from '$lib/contracts/fixtures';
import AnalysisResultView from './AnalysisResultView.svelte';

const successFixture = rawSuccessFixture as Extract<AnalysisResult, { status: 'success' }>;
const InsufficientFixture = rawInsufficientFixture as Extract<
	AnalysisResult,
	{ status: 'insufficient' }
>;

afterEach(cleanup);

describe('saved analysis result view', () => {
	// An unfinished or failed analysis must never look like completed policy findings.
	it.each([
		{
			result: FailureFixture,
			heading: "We couldn't analyze this policy",
			message: 'AI_TIMEOUT'
		},
		{
			result: InProgressFixture,
			heading: 'Analysis in progress',
			message: "We're processing the policy."
		},
		{
			result: InsufficientFixture,
			heading: "There isn't enough information for a result",
			message: InsufficientFixture.reason
		}
	])('shows $heading without presenting findings as complete', ({ result, heading, message }) => {
		render(AnalysisResultView, { result });

		const state = screen.getByRole('status');
		expect(within(state).getByRole('heading', { name: heading })).toBeTruthy();
		expect(within(state).getByText(message)).toBeTruthy();
		expect(screen.queryByRole('heading', { name: 'Key takeaways' })).toBeNull();
		expect(screen.queryByText(successFixture.summary)).toBeNull();
	});

	it('shows the stored summary, attention labels, and only relevant evidence for each point', () => {
		render(AnalysisResultView, { result: successFixture });

		expect(screen.getByRole('heading', { name: 'What this policy says' })).toBeTruthy();
		expect(screen.getByText(successFixture.summary)).toBeTruthy();
		const cards = screen.getAllByRole('article');
		expect(cards).toHaveLength(3);
		expect(within(cards[0]).getByRole('heading', { name: 'Information collection' })).toBeTruthy();
		expect(within(cards[0]).getByText('Closer look')).toBeTruthy();
		expect(cards[0].querySelector('summary span')?.textContent).toBe('3');
		expect(
			within(cards[0]).getByText(
				'We share approximate location with advertising partners only if you enable personalized ads.'
			)
		).toBeTruthy();
		expect(within(cards[0]).queryByText('We do not sell personal data.')).toBeNull();
		expect(within(cards[1]).getByText('Helpful control')).toBeTruthy();
		expect(cards[1].querySelector('summary span')?.textContent).toBe('1');
		expect(within(cards[2]).getByText('Worth knowing')).toBeTruthy();
		expect(screen.queryByText(/Analyzed with/)).toBeNull();
	});

	it('does not show an unrelated finding or its excerpt as part of the result', () => {
		// Saved analyses can contain findings that a particular takeaway does not cite.
		const result: AnalysisResult = {
			...successFixture,
			findings: [
				...successFixture.findings,
				{
					...successFixture.findings[0],
					id: 'unlinked',
					plain_language_description: 'An unlinked finding.',
					evidence: [{ passageId: 'other', excerpt: 'An unrelated excerpt.' }]
				}
			]
		};
		render(AnalysisResultView, { result });

		expect(screen.queryByText('An unlinked finding.')).toBeNull();
		expect(screen.queryByText('An unrelated excerpt.')).toBeNull();
		expect(screen.getAllByRole('article')[0].querySelector('summary span')?.textContent).toBe('3');
	});

	// Detail choices change the initial presentation, but never remove source excerpts.
	it.each([
		{ detail: 'quick', findingsVisible: false, excerptsExpanded: false },
		{ detail: 'balanced', findingsVisible: true, excerptsExpanded: false },
		{ detail: 'detailed', findingsVisible: true, excerptsExpanded: true }
	] as const)(
		'keeps excerpts available in $detail mode with the expected initial detail',
		({ detail, findingsVisible, excerptsExpanded }) => {
			render(AnalysisResultView, { result: successFixture, detail });

			const description =
				'Approximate location is collected from your IP address to operate the service.';
			expect(Boolean(screen.queryByText(description))).toBe(findingsVisible);
			const excerpts = screen.getAllByText(
				'We collect approximate location from your IP address to operate the service.'
			);
			expect(excerpts.length).toBeGreaterThan(0);
			const panels = document.querySelectorAll<HTMLDetailsElement>('details.evidence');
			expect(panels).toHaveLength(3);
			expect([...panels].every((panel) => panel.open === excerptsExpanded)).toBe(true);
		}
	);

	it('shows finding metadata only where the finding supplies it', () => {
		render(AnalysisResultView, { result: successFixture });

		const cards = screen.getAllByRole('article');
		expect(within(cards[0]).getByText('Location data, IP address')).toBeTruthy();
		expect(within(cards[0]).getByText('Service operation')).toBeTruthy();
		expect(within(cards[0]).getByText('Advertising partners')).toBeTruthy();
		expect(within(cards[1]).queryByText('Purpose')).toBeNull();
		expect(within(cards[1]).queryByText('Recipients')).toBeNull();
	});

	it('shows recorded model metadata for a saved result and insufficient outcome', () => {
		const model = { model: 'gpt-6-luna', reasoningEffort: 'medium' };
		const note = 'Analyzed with gpt-6-luna · medium reasoning';
		const success = render(AnalysisResultView, { result: { ...successFixture, model } });
		expect(screen.getByText(note)).toBeTruthy();
		success.unmount();

		render(AnalysisResultView, { result: { ...InsufficientFixture, model } });
		expect(screen.getByText(note)).toBeTruthy();
		expect(screen.queryByRole('heading', { name: 'Key takeaways' })).toBeNull();
	});

	it('labels ambiguous findings as unclear wording', () => {
		const result: AnalysisResult = {
			...successFixture,
			takeaways: [
				{ ...successFixture.takeaways[0], label: 'unclear' },
				...successFixture.takeaways.slice(1)
			]
		};
		render(AnalysisResultView, { result });

		expect(within(screen.getAllByRole('article')[0]).getByText('Unclear wording')).toBeTruthy();
	});
});
