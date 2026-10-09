import type { AnalysisResult } from './analysis';

export const successFixture: AnalysisResult = {
	status: 'success',
	analysisId: 'mock_success_01',
	schemaVersion: 1,
	summary:
		'The policy collects approximate location from IP addresses for service operation and shares it with advertising partners only if personalized ads are enabled. Users can disable this in settings. Personal data is not sold, and account data is deleted within 30 days of a verified request, excluding legally required records.',
	findings: [
		{
			id: 'F1',
			category: 'collection',
			plain_language_description:
				'Approximate location is collected from your IP address to operate the service.',
			dataCategories: ['Location data', 'IP address'],
			purposes: ['Service operation'],
			recipients: [],
			evidence: [
				{
					passageId: 'P1',
					excerpt: 'We collect approximate location from your IP address to operate the service.'
				}
			]
		},
		{
			id: 'F2',
			category: 'sharing',
			plain_language_description:
				'Approximate location is shared with advertising partners only when personalized ads are enabled, and disabling them stops the sharing.',
			dataCategories: ['Location data'],
			purposes: ['Personalized advertising'],
			recipients: ['Advertising partners'],
			evidence: [
				{
					passageId: 'P2',
					excerpt:
						'We share approximate location with advertising partners only if you enable personalized ads.'
				},
				{
					passageId: 'P3',
					excerpt: 'You can disable personalized ads in Settings; this stops that sharing.'
				}
			]
		},
		{
			id: 'F3',
			category: 'user_rights',
			plain_language_description: 'The policy explicitly states that personal data is not sold.',
			dataCategories: ['Personal data'],
			purposes: [],
			recipients: [],
			evidence: [
				{
					passageId: 'P4',
					excerpt: 'We do not sell personal data.'
				}
			]
		}
	],
	takeaways: [
		{
			id: 'T1',
			reason:
				'The service collects approximate location and shares it with advertising partners, but sharing only happens if you opt in and can be turned off in Settings.',
			label: 'higher_concern',
			findingIds: ['F1', 'F2']
		},
		{
			id: 'T2',
			reason: 'The policy explicitly guarantees that personal data is not sold to third parties.',
			label: 'positive',
			findingIds: ['F3']
		}
	]
};

export const InsufficientFixture: AnalysisResult = {
	status: 'insufficient',
	analysisId: 'mock_insufficient_01',
	schemaVersion: 1,
	reason:
		'The supplied policy text contains insufficient detail or missing section to extract actionable privacy findings.'
};

export const FailureFixture: AnalysisResult = {
	status: 'failed',
	analysisId: 'mock_failed_01',
	schemaVersion: 1,
	errorCode: 'AI_TIMEOUT',
	message: 'The AI extraction stage exceeded the configured 90-second timeout limit.'
};

export const InProgressFixture: AnalysisResult = {
	status: 'in_progress',
	analysisId: 'mock_in_progress_01',
	schemaVersion: 1
};
