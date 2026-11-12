import { pathToFileURL } from 'node:url';

const guidance =
	' Release blocked. Check the deployment project configuration, reviewed migrations (including analysis_schema_readiness, paste_schema_readiness_v2, and pasted_source_rpc), and PostgREST schema cache; see docs/deployment.md. Do not bypass this gate or run automatic migrations.';

// Accept only the public key format used by this deployment. Never send a service-role key.
export async function checkSchemaReadiness(env = process.env, fetcher = fetch) {
	const rawUrl = env.PUBLIC_SUPABASE_URL;
	const key = env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
	let url;
	try {
		url = new URL(rawUrl);
	} catch {
		throw new Error('Invalid PUBLIC_SUPABASE_URL.' + guidance);
	}
	if (
		url.protocol !== 'https:' ||
		!/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname) ||
		url.username ||
		url.password ||
		url.port ||
		url.search ||
		url.hash ||
		url.pathname !== '/'
	)
		throw new Error('Expected a hosted Supabase HTTPS project origin.' + guidance);
	if (typeof key !== 'string' || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
		throw new Error('Missing or invalid PUBLIC_SUPABASE_PUBLISHABLE_KEY.' + guidance);
	}
	url.pathname = '/rest/v1/rpc/analysis_schema_ready_v2';
	let response;
	let body;
	try {
		response = await fetcher(url, {
			method: 'GET',
			headers: { apikey: key, Accept: 'application/json', 'Accept-Profile': 'public' },
			redirect: 'error',
			cache: 'no-store',
			signal: AbortSignal.timeout(10_000)
		});
		if (response.status !== 200) {
			throw new Error('http');
		}
		body = await response.json();
	} catch {
		// Neither server response bodies nor exception messages are safe operator output.
		const detail =
			response && response.status !== 200
				? `HTTP ${response.status}`
				: 'network, timeout, or invalid JSON response';
		throw new Error(`Schema readiness check failed (${detail}).` + guidance);
	}
	if (body !== true) throw new Error('Required analysis schema contract is not ready.' + guidance);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		await checkSchemaReadiness();
		console.log('Required analysis schema contract is ready.');
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
