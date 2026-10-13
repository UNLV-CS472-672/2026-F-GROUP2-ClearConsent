import { Stage1Error } from './errors';
import { SourceSnapshotSchema } from './schemas';
import type { SourcePassage, SourceSnapshot } from './schemas';

export const DEFAULT_PASSAGE_SIZE = 1_800;

type SourceMetadata = {
	title?: string;
	url?: string;
};

function avoidSplittingSurrogatePair(text: string, end: number, start: number): number {
	if (end <= start || end >= text.length) return end;

	const previous = text.charCodeAt(end - 1);
	const next = text.charCodeAt(end);
	const endsWithHighSurrogate = previous >= 0xd800 && previous <= 0xdbff;
	const startsWithLowSurrogate = next >= 0xdc00 && next <= 0xdfff;

	return endsWithHighSurrogate && startsWithLowSurrogate ? end - 1 : end;
}

function findPassageEnd(text: string, start: number, passageSize: number): number {
	const hardEnd = Math.min(start + passageSize, text.length);
	if (hardEnd === text.length) return hardEnd;

	const minimum = Math.min(start + Math.floor(passageSize / 2), hardEnd);
	const paragraph = text.lastIndexOf('\n\n', hardEnd - 1);
	if (paragraph >= minimum) return avoidSplittingSurrogatePair(text, paragraph + 2, start);

	const newline = text.lastIndexOf('\n', hardEnd - 1);
	if (newline >= minimum) return avoidSplittingSurrogatePair(text, newline + 1, start);

	for (let index = hardEnd; index > minimum; index -= 1) {
		const previous = text[index - 1];
		const next = text[index];
		if (/[.!?]/.test(previous) && next !== undefined && /\s/.test(next)) {
			return avoidSplittingSurrogatePair(text, index, start);
		}
	}

	for (let index = hardEnd; index > minimum; index -= 1) {
		if (/\s/.test(text[index - 1])) {
			return avoidSplittingSurrogatePair(text, index, start);
		}
	}

	return avoidSplittingSurrogatePair(text, hardEnd, start);
}

export function splitIntoPassages(
	text: string,
	passageSize = DEFAULT_PASSAGE_SIZE
): SourcePassage[] {
	if (!Number.isInteger(passageSize) || passageSize < 2) {
		throw new Stage1Error(
			'configuration_error',
			503,
			'Passage size must be an integer of at least 2.'
		);
	}

	const passages: SourcePassage[] = [];
	let startOffset = 0;

	while (startOffset < text.length) {
		const endOffset = findPassageEnd(text, startOffset, passageSize);
		const sequence = passages.length + 1;
		passages.push({
			id: `P${String(sequence).padStart(3, '0')}`,
			startOffset,
			endOffset,
			text: text.slice(startOffset, endOffset)
		});
		startOffset = endOffset;
	}

	return passages;
}

async function sha256Hex(text: string): Promise<string> {
	const bytes = new TextEncoder().encode(text);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createSourceSnapshot(
	text: string,
	metadata: SourceMetadata = {},
	passageSize = DEFAULT_PASSAGE_SIZE
): Promise<SourceSnapshot> {
	// UTF-8 encoding replaces lone surrogates with U+FFFD. Reject them rather
	// than assigning different received strings the same snapshot identity.
	if (
		new TextDecoder('utf-8', { ignoreBOM: true }).decode(new TextEncoder().encode(text)) !== text
	) {
		throw new Stage1Error('invalid_request', 400, 'text must contain well-formed Unicode.');
	}
	const digest = await sha256Hex(text);
	return {
		id: `S-${digest.slice(0, 24)}`,
		identity: 'sha256-utf8',
		offsetConvention: 'utf16-start-inclusive-end-exclusive',
		textLength: text.length,
		title: metadata.title ?? null,
		url: metadata.url ?? null,
		passages: splitIntoPassages(text, passageSize)
	};
}

export function validateSourceSnapshot(snapshot: SourceSnapshot): void {
	const parsed = SourceSnapshotSchema.safeParse(snapshot);
	if (!parsed.success) {
		throw new Stage1Error(
			'reference_validation_failed',
			502,
			'The source snapshot has an invalid structure.',
			{ cause: parsed.error }
		);
	}
	const seenIds = new Set<string>();
	let expectedStart = 0;

	for (const passage of snapshot.passages) {
		if (seenIds.has(passage.id)) {
			throw new Stage1Error(
				'reference_validation_failed',
				502,
				`Source snapshot contains duplicate passage ID ${passage.id}.`
			);
		}
		seenIds.add(passage.id);

		if (
			passage.startOffset !== expectedStart ||
			passage.endOffset <= passage.startOffset ||
			passage.text.length !== passage.endOffset - passage.startOffset
		) {
			throw new Stage1Error(
				'reference_validation_failed',
				502,
				`Source passage ${passage.id} has invalid UTF-16 ranges.`
			);
		}
		expectedStart = passage.endOffset;
	}

	if (expectedStart !== snapshot.textLength) {
		throw new Stage1Error(
			'reference_validation_failed',
			502,
			'Source passages do not cover the complete frozen snapshot.'
		);
	}
}
