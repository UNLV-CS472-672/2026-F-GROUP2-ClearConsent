import { Stage1Error, isStage1Error } from './errors';
import type { ProviderExtraction, Stage1Provider } from './provider';
import { validateAndResolveCandidates } from './references';
import { Stage1RequestSchema } from './schemas';
import type { Stage1Request, Stage1Result } from './schemas';
import { createSourceSnapshot } from './source';

export const MAX_SOURCE_CHARACTERS = 30_000;
export const MAX_TITLE_CHARACTERS = 500;
export const MAX_URL_CHARACTERS = 2_048;
export const MAX_PREFERENCES_JSON_CHARACTERS = 10_000;

function validateMetadata(request: Stage1Request): void {
	if (
		request.title !== undefined &&
		(!request.title.trim() || request.title.length > MAX_TITLE_CHARACTERS)
	) {
		throw new Stage1Error(
			'invalid_request',
			400,
			`title must be nonblank and at most ${MAX_TITLE_CHARACTERS} characters when supplied.`
		);
	}

	if (request.url !== undefined) {
		if (request.url.length > MAX_URL_CHARACTERS) {
			throw new Stage1Error(
				'invalid_request',
				400,
				`url must be at most ${MAX_URL_CHARACTERS} characters.`
			);
		}
		let url: URL;
		try {
			url = new URL(request.url);
		} catch {
			throw new Stage1Error('invalid_request', 400, 'url must be a valid http or https URL.');
		}
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			throw new Stage1Error('invalid_request', 400, 'url must be a valid http or https URL.');
		}
	}

	if (
		request.preferences !== undefined &&
		JSON.stringify(request.preferences).length > MAX_PREFERENCES_JSON_CHARACTERS
	) {
		throw new Stage1Error(
			'invalid_request',
			400,
			`preferences must serialize to at most ${MAX_PREFERENCES_JSON_CHARACTERS} characters.`
		);
	}
}

export function parseStage1Request(input: unknown): Stage1Request {
	const parsed = Stage1RequestSchema.safeParse(input);
	if (!parsed.success) {
		throw new Stage1Error(
			'invalid_request',
			400,
			'Request must contain text and may include title, url, and a preferences object.',
			{ cause: parsed.error }
		);
	}

	if (!parsed.data.text.trim()) {
		throw new Stage1Error('input_empty', 400, 'text must contain non-whitespace policy content.');
	}
	if (parsed.data.text.length > MAX_SOURCE_CHARACTERS) {
		throw new Stage1Error(
			'input_too_large',
			413,
			`text exceeds the Stage 1 limit of ${MAX_SOURCE_CHARACTERS} UTF-16 code units.`
		);
	}

	validateMetadata(parsed.data);
	return parsed.data;
}

export async function runStage1Analysis(
	input: unknown,
	provider: Stage1Provider
): Promise<Stage1Result> {
	const request = parseStage1Request(input);
	const source = await createSourceSnapshot(request.text, {
		title: request.title,
		url: request.url
	});

	let extraction: ProviderExtraction;
	try {
		extraction = await provider.extract(source);
	} catch (error) {
		if (isStage1Error(error)) throw error;
		throw new Stage1Error(
			'provider_unavailable',
			502,
			'The Stage 1 provider failed unexpectedly.',
			{ cause: error }
		);
	}

	const { candidates, rejectedCandidates } = validateAndResolveCandidates(
		extraction.output,
		source
	);
	return {
		stage: 'evidence_extraction',
		schemaVersion: 'stage1-internal-v1',
		stageStatus:
			candidates.length === 0
				? 'no_candidates'
				: rejectedCandidates.length > 0
					? 'partial'
					: 'complete',
		analysisStatus: 'in_progress',
		coverage: 'complete',
		source,
		candidates,
		rejectedCandidates,
		downstream: {
			nextStage: 'consolidation',
			preferences: request.preferences ?? null
		},
		provider: {
			model: extraction.model,
			reasoningEffort: extraction.reasoningEffort,
			attempts: extraction.attempts,
			usage: extraction.usage
		},
		limitations: {
			referenceValidation: 'structural_and_referential_only',
			semanticReviewRequired: true
		}
	};
}
