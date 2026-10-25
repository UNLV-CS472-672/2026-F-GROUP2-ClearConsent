import type { AnalysisResult } from '$lib/contracts/analysis';

export const studyResult: AnalysisResult = {
	status: 'success',
	analysisId: 'study_sample_01',
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
		},
		{
			id: 'F4',
			category: 'retention',
			plain_language_description:
				'Account data is deleted within 30 days of a verified deletion request, except records the service must keep for legal obligations',
			dataCategories: ['Account data'],
			purposes: ['Legal record keeping.'],
			recipients: [],
			evidence: [
				{
					passageId: 'P5',
					excerpt:
						'We delete your account data within 30 days of a verified deletion request, except records we must keep for legal obligations.'
				}
			]
		}
	],
	takeaways: [
		{
			id: 'T1',
			topic: 'Information collection',
			reason:
				'The service collects approximate location and shares it with advertising partners, but sharing only happens if you opt in and can be turned off in Settings.',
			label: 'higher_concern',
			findingIds: ['F1', 'F2']
		},
		{
			id: 'T2',
			topic: 'Data management',
			reason: 'The policy states that personal data is not sold.',
			label: 'positive',
			findingIds: ['F3']
		},
		{
			id: 'T3',
			topic: 'Account deletion',
			reason:
				'Account data is deleted within 30 days of a verified deletion request, except legally required records. The deadline has both a verification condition and a legal-record exception.',
			label: 'worth_knowing',
			findingIds: ['F4']
		}
	]
};

export const samplePolicy =
	'ClearConsent Study Sample Privacy Policy\n\nWe collect approximate location from your IP address to operate the service.\nWe share approximate location with advertising partners only if you enable personalized ads.\nYou can disable personalized ads in Settings; this stops that sharing.\nWe do not sell personal data.\nWe delete your account data within 30 days of a verified deletion request, except records we must keep for legal obligations.';
export function isSamplePolicy(text: string) {
	return text.trim().replace(/\s+/g, ' ') === samplePolicy.replace(/\s+/g, ' ');
}
export function detailLevel(value: string | null) {
	return value === 'quick' || value === 'detailed' ? value : 'balanced';
}
