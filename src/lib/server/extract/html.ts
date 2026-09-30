export function htmlToText(html: string): { title: string; text: string } {
	const title = html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1].trim() ?? '';

	const text = html
		// Remove <script>, <style>, and <head> blocks along with everything inside them.
		.replace(/<(script|style|head)[^>]*>.*?<\/\1>/gis, ' ')
		// Remove every remaining tag, keeping the text between them.
		.replace(/<[^>]+>/g, ' ')
		// Turn non-breaking spaces into normal spaces.
		.replace(/&nbsp;/g, ' ')
		// Turn escaped ampersands back into "&".
		.replace(/&amp;/g, '&')
		// Collapse runs of spaces, tabs, and newlines into a single space.
		.replace(/\s+/g, ' ')
		.trim();
	return { title, text };
}
