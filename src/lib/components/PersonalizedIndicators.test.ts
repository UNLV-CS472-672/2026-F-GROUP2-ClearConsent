import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { Personalization } from '$lib/analysis-run';
import type { PreferenceEvaluation } from '$lib/contracts/preferences';
import { fitnessBalancedEvaluation, fitnessFindings } from '$lib/contracts/scoring-fixtures';
import PersonalizedIndicators from './PersonalizedIndicators.svelte';

// Utilizing the docs/scoring-model.md sect. 8 example:
// two conflicts, two alignments, two without evidence,
// and finding E set aside for review
const ready: Personalization = { status: 'ready', evaluation: fitnessBalancedEvaluation };

function renderWith(personalization: Personalization, findings = fitnessFindings) {
	return render(PersonalizedIndicators, { personalization, findings });
}

// The six indicator cards, in order
function cards() {
	const list = screen.getByRole('list', { name: 'Preference results' });
	return within(list).getAllByRole('listitem');
}

// The card for one topic
// found by its heading
function card(topic: string) {
	const match = cards().find((item) => within(item).queryByRole('heading', { name: topic }));
	if (!match) throw new Error(`No card for ${topic}`);
	return match;
}

afterEach(cleanup);

describe('PersonalizedIndicators when ready', () => {
	it('shows the summary and the profile it was based on', () => {
		renderWith(ready);

		expect(screen.getByText(fitnessBalancedEvaluation.summary)).toBeTruthy();
		expect(screen.getByText(/your Balanced profile/)).toBeTruthy();
	});

	it('shows one card per concern in the order given', () => {
		renderWith(ready);

		const topics = cards().map((item) => within(item).getByRole('heading').textContent?.trim());
		expect(topics).toEqual([
			'Your rights',
			'Data sharing',
			'How data is used',
			'Data retention',
			'Information collection',
			'Security practices'
		]);
	});

	it('labels each verdict with text, not color alone', () => {
		renderWith(ready);

		expect(within(card('Your rights')).getByText('Conflict')).toBeTruthy();
		expect(within(card('Security practices')).getByText('Fits your preferences')).toBeTruthy();
		expect(within(card('Data retention')).getByText('Not enough evidence')).toBeTruthy();
	});

	it('shows the saved explanation for each concern', () => {
		renderWith(ready);

		for (const item of fitnessBalancedEvaluation.indicators) {
			expect(screen.getByText(item.explanation)).toBeTruthy();
		}
	});

	it('shows the tier only when there is one', () => {
		renderWith(ready);

		expect(within(card('Your rights')).getByText('Severity: Serious')).toBeTruthy();
		expect(within(card('Data sharing')).getByText('Severity: Notable')).toBeTruthy();
		expect(within(card('Data retention')).queryByText(/Severity/)).toBeNull();
		expect(within(card('Security practices')).queryByText(/Severity/)).toBeNull();
	});

	it('shows the linked finding and its excerpt, and nothing for insufficient evidence', () => {
		renderWith(ready);

		const rights = card('Your rights');
		expect(within(rights).getByText('Related policy wording')).toBeTruthy();
		expect(
			within(rights).getByText('Workout history cannot be deleted once recorded.')
		).toBeTruthy();

		expect(within(card('Data retention')).queryByText('Related policy wording')).toBeNull();
	});

	it('still shows the indicator when its finding was not loaded', () => {
		renderWith(ready, []);

		expect(cards()).toHaveLength(6);
		expect(screen.queryByText('Related policy wording')).toBeNull();
	});

	it('lists findings that need review separately, not as indicators', () => {
		renderWith(ready);
		const reviewed = fitnessFindings.find((finding) => finding.id === 'E')!;

		const review = screen.getByRole('list', { name: 'Needs review' });
		expect(within(review).getByText(reviewed.plain_language_description)).toBeTruthy();
		expect(within(review).getByText('The wording is unclear.')).toBeTruthy();

		const list = screen.getByRole('list', { name: 'Preference results' });
		expect(within(list).queryByText(reviewed.plain_language_description)).toBeNull();
	});

	it('leaves out the review section when nothing needs review', () => {
		const evaluation: PreferenceEvaluation = { ...fitnessBalancedEvaluation, needsReview: [] };
		renderWith({ status: 'ready', evaluation });

		expect(screen.queryByRole('heading', { name: 'Needs review' })).toBeNull();
	});

	it('states that the results are not legal advice', () => {
		renderWith(ready);

		expect(screen.getByText(/not legal advice/)).toBeTruthy();
	});
});

describe('PersonalizedIndicators without saved results', () => {
	it.each([
		['not_saved', /saved before they were added/],
		['unavailable', /couldn't be loaded/]
	] as const)('explains why for %s and never reports no concerns', (status, message) => {
		renderWith({ status });

		expect(screen.getByRole('note')).toBeTruthy();
		expect(screen.getByText(message)).toBeTruthy();
		expect(screen.queryByRole('list', { name: 'Preference results' })).toBeNull();
		expect(screen.queryByText(/no conflicts/i)).toBeNull();
		expect(screen.getByText(/not legal advice/)).toBeTruthy();
	});
});
