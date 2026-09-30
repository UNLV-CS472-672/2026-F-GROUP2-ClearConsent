import { extractText, getDocumentProxy } from 'unpdf';

export async function pdfToText(bytes: ArrayBuffer, url: URL) {
	const pdf = await getDocumentProxy(new Uint8Array(bytes));
	const { text } = await extractText(pdf, { mergePages: true });

	const title = url.pathname.split('/').pop();

	return { title, text: text.trim() };
}
