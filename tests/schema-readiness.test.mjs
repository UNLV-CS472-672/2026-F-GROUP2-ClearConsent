import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { checkSchemaReadiness } from '../scripts/check-schema-readiness.mjs';

const env = {
	PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
	PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic'
};

test('successful contract uses one bounded read-only request and no user credentials', async () => {
	let calls = 0;
	await checkSchemaReadiness(env, async (url, options) => {
		calls++;
		assert.equal(url.href, env.PUBLIC_SUPABASE_URL + '/rest/v1/rpc/analysis_schema_ready_v2');
		assert.equal(options.method, 'GET');
		assert.equal(options.redirect, 'error');
		assert.equal(options.cache, 'no-store');
		assert.deepEqual(options.headers, {
			apikey: env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
			Accept: 'application/json',
			'Accept-Profile': 'public'
		});
		assert.ok(options.signal instanceof AbortSignal);
		assert.equal(options.body, undefined);
		return new Response('true');
	});
	assert.equal(calls, 1);
});

for (const url of [
	undefined,
	'',
	'not a URL',
	'http://abcdefghijklmnopqrst.supabase.co',
	'https://example.com',
	'https://abcdefghijklmnopqrst.supabase.co/path',
	'https://user:password@abcdefghijklmnopqrst.supabase.co',
	env.PUBLIC_SUPABASE_URL + '?key=private',
	env.PUBLIC_SUPABASE_URL + '#fragment',
	env.PUBLIC_SUPABASE_URL + ':8443'
]) {
	test(`invalid origin fails before network: ${url}`, async () => {
		await assert.rejects(
			checkSchemaReadiness({ ...env, PUBLIC_SUPABASE_URL: url }, () =>
				assert.fail('network called')
			),
			/Release blocked/
		);
	});
}

for (const key of [
	undefined,
	'',
	'sb_secret_private',
	'eyJ.service-role.jwt',
	'sb_publishable_bad\nvalue'
]) {
	test('invalid or privileged key fails before network', async () => {
		await assert.rejects(
			checkSchemaReadiness({ ...env, PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }, () =>
				assert.fail('network called')
			),
			/Release blocked/
		);
	});
}

for (const status of [204, 301, 400, 401, 403, 404, 429, 500, 503]) {
	test(`HTTP ${status} never proves readiness`, async () => {
		await assert.rejects(
			checkSchemaReadiness(env, async () => new Response(null, { status })),
			new RegExp(`HTTP ${status}.*Release blocked`)
		);
	});
}

for (const body of [
	'false',
	'null',
	'{}',
	'[]',
	'"true"',
	'{"ready":true}',
	'1',
	'private invalid body'
]) {
	test(`reject non-contract response: ${body}`, async () => {
		await assert.rejects(
			checkSchemaReadiness(env, async () => new Response(body)),
			(error) => {
				assert.match(error.message, /Release blocked/);
				assert.ok(!error.message.includes('private invalid body'));
				return true;
			}
		);
	});
}

for (const name of ['TypeError', 'TimeoutError', 'AbortError']) {
	test(`${name} fails closed with sanitized operator guidance`, async () => {
		await assert.rejects(
			checkSchemaReadiness(env, async () => {
				throw new DOMException('private upstream detail', name);
			}),
			(error) => {
				assert.match(error.message, /network, timeout.*docs\/deployment.md/);
				assert.ok(!error.message.includes('private upstream detail'));
				return true;
			}
		);
	});
}

test('CI runs regression tests and release guard precedes Wrangler without continue-on-error', async () => {
	const ci = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
	const deploy = await readFile(
		new URL('../.github/workflows/deploy.yml', import.meta.url),
		'utf8'
	);
	assert.match(ci, /run: npm run test:schema-readiness/);
	assert.ok(
		deploy.indexOf('run: npm run check:schema-readiness') <
			deploy.indexOf('npm exec -- wrangler deploy')
	);
	assert.ok(deploy.includes('run: npm run check:schema-readiness'));
	assert.ok(!deploy.includes('continue-on-error'));
});

test('a passing legacy v1 endpoint cannot bypass a missing v2 contract', async () => {
	const paths = [];
	await assert.rejects(
		checkSchemaReadiness(env, async (url) => {
			paths.push(url.pathname);
			return url.pathname.endsWith('analysis_schema_ready_v1')
				? new Response('true')
				: new Response(null, { status: 404 });
		}),
		/HTTP 404.*Release blocked/
	);
	assert.deepEqual(paths, ['/rest/v1/rpc/analysis_schema_ready_v2']);
});
