import { extractText, getDocumentProxy } from 'unpdf';

export async function pdfToText(bytes: Uint8Array, url: URL) {
	const pdf = await getDocumentProxy(bytes);
	const { text } = await extractText(pdf, { mergePages: true });

	const title = url.pathname.split('/').pop();

	return { title, text: text.trim() };
}
