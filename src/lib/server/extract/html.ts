function decodeEntities(text: string): string {
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

	const text = decodeEntities(
		html
			// Remove <script>, <style>, <head>, <header>, and <footer> blocks along with everything inside them.
			.replace(/<(script|style|head|header|footer)[^>]*>.*?<\/\1>/gis, ' ')
			// Remove every remaining tag, keeping the text between them.
			.replace(/<[^>]+>/g, ' ')
	)
		// Collapse runs of spaces, tabs, and newlines into a single space.
		.replace(/\s+/g, ' ')
		.trim();
	return { title, text };
}
