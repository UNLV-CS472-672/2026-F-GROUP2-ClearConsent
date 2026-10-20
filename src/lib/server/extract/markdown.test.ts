import { describe, expect, it } from 'vitest';
import { markdownToText } from './markdown';

describe('markdownToText', () => {
	it('leaves ordinary policy text unchanged', () => {
		const text = [
			'We collect your email address to operate your account.',
			'',
			'Prices marked * exclude tax. Section 3 | Sharing covers #1 priority requests.',
			'We keep logs for 30 days - 90 days for security events.'
		].join('\n');

		expect(markdownToText(text)).toBe(text);
	});

	it('flattens a policy table with <br> line breaks and bulleted cells', () => {
		const markdown = [
			'| **Purpose** | **Categories of personal data** |',
			'| --- | --- |',
			'| To provide the Spotify Service.<br><br>For example, when we use your data to:<br><br>*   set up an account for you<br>*   personalize your account | *   User Data<br>*   Usage Data |'
		].join('\n');

		expect(markdownToText(markdown)).toBe(
			[
				'Purpose',
				'',
				'Categories of personal data',
				'',
				'To provide the Spotify Service.',
				'',
				'For example, when we use your data to:',
				'',
				'set up an account for you',
				'personalize your account',
				'',
				'User Data',
				'Usage Data'
			].join('\n')
		);
	});

	it('removes headings, links, emphasis, and escapes while keeping their text', () => {
		const markdown = [
			'**Spotify Privacy Policy**',
			'==========================',
			'',
			'[1\\. About this Policy](#_kfosu7ttf89l)',
			'',
			'## Your rights',
			'',
			'> Read our [cookie policy](https://example.com/cookies) and `Settings` page. Prices \\* apply.',
			'',
			'---',
			'',
			'- First item',
			'+ Second item'
		].join('\n');

		expect(markdownToText(markdown)).toBe(
			[
				'Spotify Privacy Policy',
				'',
				'1. About this Policy',
				'',
				'Your rights',
				'',
				'Read our cookie policy and Settings page. Prices * apply.',
				'',
				'First item',
				'Second item'
			].join('\n')
		);
	});

	it('keeps escaped pipes inside a table cell', () => {
		expect(markdownToText('| Data \\| Usage | Kept |')).toBe('Data | Usage\n\nKept');
	});

	it('is stable when applied twice', () => {
		const markdown = '| **A** | B<br>*   c |\n| --- | --- |\n[x](y) and **z**';
		const once = markdownToText(markdown);
		expect(markdownToText(once)).toBe(once);
	});
});
