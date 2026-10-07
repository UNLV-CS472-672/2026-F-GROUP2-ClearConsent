import { describe, expect, it } from 'vitest';
import { htmlToText } from './html';

describe('HTML text extraction', () => {
	it('decodes named, decimal and hexadecimal quotes in body and title', () => {
		const result = htmlToText(
			'<head><title>&quot;Policy&quot; &apos;A&apos;</title></head><p>don&#39;t &#34;share&#34; &#x27;email&#x27; &#x22;data&#x22;</p>'
		);
		expect(result.title).toBe(`"Policy" 'A'`);
		expect(result.text).toBe(`don't "share" 'email' "data"`);
	});
	it('keeps ignored blocks out and decodes entities only once', () => {
		expect(
			htmlToText(
				'<script>secret</script><header>nav</header><p>A&nbsp;&amp; B &amp;#39;</p><footer>footer</footer>'
			).text
		).toBe('A & B &#39;');
	});
});
