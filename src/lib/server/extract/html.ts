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

// Templates can be nested; their contents are inert, including any apparent main region.
function withoutTemplates(html: string): string {
	let depth = 0;
	let cursor = 0;
	let result = '';
	for (const tag of html.matchAll(/<\/?template\b[^>]*>/gi)) {
		if (depth === 0) result += html.slice(cursor, tag.index) + ' ';
		if (tag[0].startsWith('</')) depth = Math.max(0, depth - 1);
		else depth++;
		cursor = tag.index + tag[0].length;
	}
	return result + (depth === 0 ? html.slice(cursor) : '');
}

export function htmlToText(html: string): { title: string; text: string } {
	// Remove inert content before looking for either a title or a semantic main region.
	const activeMarkup = withoutTemplates(
		html
			.replace(/<!--[\s\S]*?(?:-->|$)/g, ' ')
			.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
	);
	const title = decodeEntities(
		activeMarkup.match(/<title[^>]*>(.*?)<\/title>/is)?.[1].trim() ?? ''
	);
	const visibleText = (markup: string) =>
		decodeEntities(markup.replace(/<[^>]+>/g, ' '))
			.replace(/\s+/g, ' ')
			.trim();

	const withoutIgnoredBlocks = activeMarkup.replace(
		/<(head|title)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
		' '
	);
	// Keep policy headers and footers inside a selected main. Only strip them in the
	// whole-page fallback, where they may be site-wide navigation and page chrome.
	const mainRegions = [...withoutIgnoredBlocks.matchAll(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/gi)];
	const mainText = mainRegions.length === 1 ? visibleText(mainRegions[0][1]) : '';
	const text =
		mainText ||
		visibleText(withoutIgnoredBlocks.replace(/<(header|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' '));
	return { title, text };
}
