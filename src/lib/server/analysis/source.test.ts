import { describe, expect, it } from 'vitest';
import { Stage1Error } from './errors';
import { createSourceSnapshot, splitIntoPassages, validateSourceSnapshot } from './source';

describe('source snapshots', () => {
	it('preserves the exact source and uses UTF-16 slice offsets around surrogate pairs', async () => {
		const text = 'Intro 😀 clause.\nDeletion follows after verification.';
		const snapshot = await createSourceSnapshot(text, {}, 16);

		expect(snapshot.offsetConvention).toBe('utf16-start-inclusive-end-exclusive');
		expect(snapshot.textLength).toBe(text.length);
		expect(snapshot.passages.map((passage) => passage.text).join('')).toBe(text);

		for (const passage of snapshot.passages) {
			expect(text.slice(passage.startOffset, passage.endOffset)).toBe(passage.text);
			const lastCodeUnit = text.charCodeAt(passage.endOffset - 1);
			const nextCodeUnit = text.charCodeAt(passage.endOffset);
			const splitSurrogate =
				lastCodeUnit >= 0xd800 &&
				lastCodeUnit <= 0xdbff &&
				nextCodeUnit >= 0xdc00 &&
				nextCodeUnit <= 0xdfff;
			expect(splitSurrogate).toBe(false);
		}
	});

	it('creates stable snapshot and passage IDs', async () => {
		const text = 'We do not sell personal data.';
		const first = await createSourceSnapshot(text);
		const second = await createSourceSnapshot(text);

		expect(first.id).toBe(second.id);
		expect(first.passages[0].id).toBe('P001');
	});

	it('rejects an empty or out-of-bounds source map', async () => {
		const snapshot = await createSourceSnapshot('We do not sell personal data.');
		expect(() => validateSourceSnapshot({ ...snapshot, textLength: 0, passages: [] })).toThrow(
			Stage1Error
		);
		snapshot.passages[0].endOffset += 1;
		expect(() => validateSourceSnapshot(snapshot)).toThrow(Stage1Error);
	});

	it('keeps valid Unicode identities distinct and rejects lone surrogates', async () => {
		const replacement = await createSourceSnapshot('Policy \ufffd');
		const emoji = await createSourceSnapshot('Policy 😀');
		expect(replacement.id).not.toBe(emoji.id);
		const withBom = await createSourceSnapshot('\ufeffPolicy 😀');
		expect(withBom.passages[0].text).toBe('\ufeffPolicy 😀');
		await expect(createSourceSnapshot('Policy \ud800')).rejects.toMatchObject({
			code: 'invalid_request'
		});
	});

	it('rejects duplicate passage IDs', () => {
		const passages = splitIntoPassages('One complete passage. Another complete passage.', 24);
		passages[1].id = passages[0].id;

		expect(() =>
			validateSourceSnapshot({
				id: 'S-test',
				identity: 'sha256-utf8',
				offsetConvention: 'utf16-start-inclusive-end-exclusive',
				textLength: passages.reduce((total, passage) => total + passage.text.length, 0),
				title: null,
				url: null,
				passages
			})
		).toThrowError(Stage1Error);
	});
});
