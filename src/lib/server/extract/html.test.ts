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

	it('uses one visible main region and keeps its nested final section', () => {
		const result = htmlToText(
			'<title>Terms</title><nav>Site menu</nav><aside>Related links</aside>' +
				'<main><h1>Terms</h1><section><p>We collect account data.</p></section>' +
				'<section><h2>Final section</h2><p>You can request deletion.</p></section></main>' +
				'<div>More products</div>'
		);
		expect(result).toEqual({
			title: 'Terms',
			text: 'Terms We collect account data. Final section You can request deletion.'
		});
	});

	it('falls back to the full page when main is missing, empty, or ambiguous', () => {
		expect(htmlToText('<nav>Menu</nav><p>Policy text</p>').text).toBe('Menu Policy text');
		expect(htmlToText('<nav>Menu</nav><main><div></div></main><p>Policy text</p>').text).toBe(
			'Menu Policy text'
		);
		expect(htmlToText('<main>First</main><main>Second</main>').text).toBe('First Second');
	});
});
