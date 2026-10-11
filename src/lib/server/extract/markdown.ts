// Converts Markdown, such as archived policy files, into plain text before analysis.
// It removes only unambiguous formatting so ordinary policy text passes through unchanged:
// a lone "*", "|" or "#" inside a sentence is left alone.
export function markdownToText(markdown: string): string {
	const blocks: string[] = [];

	for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
		// Drop heading underlines ("====", "----"), horizontal rules, and table divider rows.
		if (/^\s*(=+|-{3,})\s*$/.test(line)) continue;
		if (/^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$/.test(line)) continue;

		// Split a table row into cells, ignoring escaped pipes inside a cell. Cells and rows are
		// separated by blank lines so table boundaries stay visible once the pipes are gone.
		const isTableRow = /^\s*\|.*\|\s*$/.test(line);
		const cells = isTableRow
			? line
					.trim()
					.slice(1, -1)
					.split(/(?<!\\)\|/)
					.map((cell) => cell.trim())
					.filter(Boolean)
			: [line];

		for (const [index, cell] of cells.entries()) {
			if (index > 0) blocks.push('');
			// Table cells use <br> for line breaks; split on them before handling list markers.
			for (const segment of cell.split(/<br\s*\/?>/i)) {
				blocks.push(
					segment
						// Remove heading, blockquote, and bullet markers at the start of a line.
						.replace(/^\s*#{1,6}\s+/, '')
						.replace(/\s+#+\s*$/, '')
						.replace(/^\s*>\s?/, '')
						.replace(/^\s*[*+-]\s+/, '')
						// Keep image alt text and link text; drop the URLs.
						.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
						.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
						// Remove bold and inline-code markers.
						.replace(/\*\*([^*\n]+)\*\*/g, '$1')
						.replace(/__([^_\n]+)__/g, '$1')
						.replace(/`([^`\n]+)`/g, '$1')
						// Unescape Markdown punctuation such as "1\." and "\*" last, so it stays literal.
						.replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, '$1')
						.trimEnd()
				);
			}
		}
		if (isTableRow) blocks.push('');
	}

	// Keep paragraph breaks but collapse the empty lines left by removed rows and <br><br>.
	return blocks
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}
