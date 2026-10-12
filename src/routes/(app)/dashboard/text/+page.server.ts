import type { Actions } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';

// TEMPORARY TEXT INPUT FIELD TILL API IS COMPLETED

function isPolicy(text: string) {
	// temporary, replace /w text classification?
	const terms: RegExp[] = [
		/\bterms of (use|service)\bprivacy\b/,
		/\b(personal information|personal data|)\b/,
		/\bconfidential(?:ity)?\b/,
		/\bcollect(?:s|ed|ing)?\b/,
		/\buse(?:s|d|ing)?\b.{0-40}\b(information|data)\b\bstore(?:s|ed)?\b/,
		/\bshar(?:es|ed|ing)?\b/,
		/\b(cookies|tracking)\b/,
		/\b(retain|retains|retention|delete|deletion)\b/,
		/\b(your rights|access|correct|opt-out|opt out|opt-in|opt in)\b/,
		/\banonymiz(?:e|ed|ation)?\b/,
		/\breport(?:ed|ing)?\b\bdisclos(?:e|ed|ure)?\b\n/,
		/\b(data controller|privacy officier)\b/,
		/\b(term|termination|licensing|liability)\b/
	];

	return terms.filter((pattern) => pattern.test(text.toLowerCase())).length >= 5;
}

export const actions: Actions = {
	default: async ({ request }: { request: Request }) => {
		try {
			// get data from the form and extract text from 'text_submission' textbox
			const data = await request.formData();
			const text = data.get('text_submission');

			if (!text || typeof text !== 'string')
				return {
					success: false,
					error: 'Text is not a string.'
				};

			const tmp = text.trim();

			if (tmp.length === 0) {
				return fail(400, {
					success: false,
					error: 'Text field cannot be empty.'
				});
			}

			// Average character count of large company ToS 160k
			if (tmp.length > 200000)
				return fail(400, {
					success: false,
					error: 'Input exceeds character limit (200000): ' + tmp.length
				});

			// Ensure that text is a policy - ToS/EULA/etc...
			if (!isPolicy(tmp)) {
				return fail(400, {
					success: false,
					error: 'Input does not appear to be a policy.'
				});
			}


			return {
				success: true,
				message: 'Successfully submitted input.',
				data: tmp
			};
		} catch (error) {
			console.error('Error:', error);
			return {
				success: false,
				error: 'Error encountered on text box form.'
			};
		}
	}
};
