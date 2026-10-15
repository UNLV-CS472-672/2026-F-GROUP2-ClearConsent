import { describe, it, expect } from 'vitest';
import { AnalysisResultSchema } from './analysis';
import { successFixture, InsufficientFixture, FailureFixture, InProgressFixture } from './fixtures';

describe('AnalysisResultSchema Contract & Fixtures', () => {
	// success runs on synthetic fixtures (4 tests)
	it('validates the success fixture successfully', () => {
		const result = AnalysisResultSchema.safeParse(successFixture);
		expect(result.success).toBe(true);
	});

	it('validates the insufficient fixture successfully', () => {
		const result = AnalysisResultSchema.safeParse(InsufficientFixture);
		expect(result.success).toBe(true);
	});

	it('validates the failure fixture successfully', () => {
		const result = AnalysisResultSchema.safeParse(FailureFixture);
		expect(result.success).toBe(true);
	});

	it('validates the in_progress fixture successfully', () => {
		const result = AnalysisResultSchema.safeParse(InProgressFixture);
		expect(result.success).toBe(true);
	});

	// malformed payload test runs (9 tests)
	it('rejects malformed payloads', () => {
		const malformed = {
			status: 'success',
			analysisId: 'mock_bad_01',
			schemaVersion: 1,
			summary: 'Missing findings array',
			findings: [], // can't be empty
			takeaways: []
		};

		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects unknown status types', () => {
		const malformed = {
			status: 'non_existent_status',
			analysisId: 'mock_bad_02',
			schemaVersion: 1
		};

		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects successful result with missing evidence', () => {
		const malformed = {
			status: 'success',
			analysisId: 'mock_bad_03',
			schemaVersion: 1,
			summary: 'Success finding with missing evidence',
			findings: [
				{
					id: 'F1',
					category: 'collection',
					plain_language_description:
						'Location services are automatically collected unless user opts out.',
					dataCategories: ['Location data', 'IP address'],
					purposes: ['Service operation'],
					recipients: [],
					evidence: []
				}
			],
			takeaways: [
				{
					id: 'T1',
					topic: 'Information collection',
					reason:
						'The policy collects approximate location for service operation and shares it with advertising partners only when personalized ads are enabled.',
					label: 'higher_concern',
					findingIds: ['F1']
				}
			]
		};

		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects failed state with no error code', () => {
		const malformed = {
			status: 'failed',
			analysisId: 'mock_bad_04',
			schemaVersion: 1,
			message: 'Malformed element, no errorCode'
		};
		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects successful result with missing passageId in evidence', () => {
		const malformed = {
			status: 'success',
			analysisId: 'mock_bad_05',
			schemaVersion: 1,
			summary: 'Success finding with missing passageId link to evidence',
			findings: [
				{
					id: 'F1',
					category: 'sharing',
					plain_language_description:
						'Specific user information is saved and shared to third-parties',
					dataCategories: ['User preferences'],
					purposes: ['Better service'],
					recipients: ['Third-party applications'],
					evidence: [
						{
							excerpt:
								'Our website makes use of sharing user preferences with our other applications as third-party services in an effort to enhance the user experience.'
						}
					]
				}
			],
			takeaways: [
				{
					id: 'T1',
					topic: 'Information shared',
					reason: 'Website owners share user set preferences with their third-party applications.',
					label: 'unclear',
					findingIds: ['F1']
				}
			]
		};

		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects a takeaway that links to a nonexistent finding', () => {
		const malformed = {
			...successFixture,
			takeaways: [
				{
					id: 'T1',
					topic: 'Error message',
					reason: 'This takeaway points to a nonexistent finding.',
					label: 'positive',
					findingIds: ['F9']
				}
			]
		};

		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects an insufficient result that includes findings', () => {
		const malformed = {
			...InsufficientFixture,
			findings: []
		};

		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects a failed result that includes findings', () => {
		const malformed = {
			...FailureFixture,
			findings: []
		};

		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects duplicate finding IDs', () => {
		const finding = {
			id: 'F1',
			category: 'collection',
			plain_language_description: 'Approximate location is collected to operate the service.',
			dataCategories: ['Location data'],
			purposes: ['Service operation'],
			recipients: [],
			evidence: [
				{
					passageId: 'P1',
					excerpt: 'We collect approximate location from your IP address to operate the service.'
				}
			]
		};

		const malformed = {
			...successFixture,
			findings: [finding, finding],
			takeaways: [
				{
					id: 'T1',
					topic: 'Information collection',
					reason: 'Location is collected.',
					label: 'positive',
					findingIds: ['F1']
				}
			]
		};

		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});
});
