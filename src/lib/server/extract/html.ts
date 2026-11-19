function decodeEntities(text: string): string {
	// Decode once so escaped literal text such as &amp;#39; stays &#39;, rather than
	// becoming an apostrophe through recursive decoding.
	return text.replace(/&(?:nbsp|amp|apos|quot|#(?:x[0-9a-f]+|[0-9]+));/gi, (entity) => {
		const named: Record<string, string> = { nbsp: ' ', amp: '&', apos: "'", quot: '"' };
		const value = entity.slice(1, -1).toLowerCase();
		if (!value.startsWith('#')) return named[value];
		const code = value.startsWith('#x') ? parseInt(value.slice(2), 16) : Number(value.slice(1));
		return [34, 39, 38, 160].includes(code) ? String.fromCodePoint(code) : entity;
	});
}

export function htmlToText(html: string): { title: string; text: string } {
	const title = decodeEntities(html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1].trim() ?? '');
	const visibleText = (markup: string) =>
		decodeEntities(markup.replace(/<[^>]+>/g, ' '))
			.replace(/\s+/g, ' ')
			.trim();

	// A single semantic main region keeps navigation and related page chrome out of the policy.
	// If the page has no clear main region, preserve the existing whole-page extraction.
	const withoutIgnoredBlocks = html.replace(
		/<(script|style|head|header|footer|title)[^>]*>.*?<\/\1>/gis,
		' '
	);
	const mainRegions = [...withoutIgnoredBlocks.matchAll(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/gi)];
	const mainText = mainRegions.length === 1 ? visibleText(mainRegions[0][1]) : '';
	const text = mainText || visibleText(withoutIgnoredBlocks);
	return { title, text };
}
