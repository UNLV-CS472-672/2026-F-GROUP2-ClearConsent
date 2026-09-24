import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import prettier from 'prettier';

// This imports public, version-pinned archive documents. It never calls a model API.
const documents = [
	{
		id: 'spotify-full-privacy-policy',
		title: 'Complete Spotify Privacy Policy',
		service: 'Spotify',
		effectiveDate: '2026-07-01',
		archiveCommit: 'd5c33c897fc01686cf98a24b15c31076f7bd3bf1',
		archiveBlobSha: '4f3bab7ee5bea212ac906292ba4d5ee9c16a8e03',
		path: 'Spotify/Privacy Policy.md'
	},
	{
		id: 'facebook-full-privacy-policy',
		title: 'Complete Facebook Privacy Policy',
		service: 'Facebook',
		effectiveDate: '2026-07-23',
		archiveCommit: '53fdfebe3c470bb1433e830394e86fd699f485e7',
		archiveBlobSha: '5895929f58bb8fcc3d21dbf2ce1a9d34d8324282',
		path: 'Facebook/Privacy Policy.md'
	}
];

function blobSha(bytes) {
	return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

const cases = documents.map((document) => {
	const encodedPath = document.path.replaceAll(' ', '%20');
	const endpoint = `repos/OpenTermsArchive/pga-versions/contents/${encodedPath}?ref=${document.archiveCommit}`;
	const response = JSON.parse(
		execFileSync('gh', ['api', endpoint], { encoding: 'utf8', maxBuffer: 4_000_000 })
	);
	const bytes = Buffer.from(response.content, 'base64');
	if (bytes.length !== response.size || blobSha(bytes) !== document.archiveBlobSha) {
		throw new Error(`Archive content mismatch: ${document.id}`);
	}
	return {
		id: document.id,
		title: document.title,
		policyText: bytes.toString('utf8'),
		source: {
			service: document.service,
			document: 'Privacy Policy',
			collection: 'Platform Governance Archive v2',
			effectiveDate: document.effectiveDate,
			archiveCommit: document.archiveCommit,
			archiveBlobSha: document.archiveBlobSha,
			archiveUrl: `https://github.com/OpenTermsArchive/pga-versions/blob/${document.archiveCommit}/${encodedPath}`
		}
	};
});

const fixture = {
	datasetVersion: '0.1.0',
	description:
		'Entire archived Markdown privacy-policy files from pinned Platform Governance Archive v2 versions, without additional excerpting. These are distinct from the short excerpt cases.',
	reviewStatus: 'unlabeled-needs-human-review',
	cases
};

const destination = new URL('../fixtures/full-policy-cases.json', import.meta.url);
const formatted = await prettier.format(JSON.stringify(fixture), {
	filepath: destination.pathname
});
await writeFile(destination, formatted);
console.log(`Imported ${cases.length} complete, pinned privacy policies. No model calls made.`);
