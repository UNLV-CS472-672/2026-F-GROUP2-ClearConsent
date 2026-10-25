import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Handle, RequestEvent } from '@sveltejs/kit';

const mocks = vi.hoisted(() => ({
	env: {} as Record<string, string>,
	publicEnv: {
		PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
		PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-public-key'
	},
	createClient: vi.fn(),
	insert: vi.fn(),
	getSession: vi.fn(),
	getUser: vi.fn()
}));
vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));
vi.mock('$env/static/public', () => mocks.publicEnv);
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('@supabase/ssr', () => ({
	createServerClient: () => ({ auth: { getSession: mocks.getSession, getUser: mocks.getUser } })
}));

async function request(path: string) {
	const { handle } = await import('./hooks.server');
	const event = {
		url: new URL(path, 'https://example.test'),
		locals: {},
		cookies: { getAll: () => [], set: vi.fn() },
		request: new Request('https://example.test', {
			headers: { referer: 'https://example.test/?code=secret' }
		}),
		getClientAddress: () => '127.0.0.1'
	} as unknown as RequestEvent;
	const resolve = vi.fn(async () => new Response('resolved'));
	const response = await handle({ event, resolve } as Parameters<Handle>[0]);
	return { response, event, resolve };
}

beforeEach(() => {
	vi.resetModules();
	vi.resetAllMocks();
	delete mocks.env.SUPABASE_SERVICE_ROLE_KEY;
	mocks.publicEnv.PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
	mocks.createClient.mockReturnValue({ from: () => ({ insert: mocks.insert }) });
	mocks.insert.mockResolvedValue({ error: null });
	mocks.getSession.mockResolvedValue({ data: { session: null } });
	mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('optional callback logging', () => {
	it.each(['/', '/login', '/auth/callback?code=secret'])(
		'serves %s without a service key',
		async (path) => {
			expect((await request(path)).response.status).toBe(200);
			expect(mocks.createClient).not.toHaveBeenCalled();
		}
	);
	it.each(['/', '/login'])('never initializes the logger for %s even with a key', async (path) => {
		mocks.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
		await request(path);
		expect(mocks.createClient).not.toHaveBeenCalled();
	});
	it('skips logging when URL configuration is absent', async () => {
		mocks.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
		mocks.publicEnv.PUBLIC_SUPABASE_URL = '';
		await request('/auth/callback');
		expect(mocks.createClient).not.toHaveBeenCalled();
	});
	it.each(['initialization', 'rejection', 'returned error', 'table selection'])(
		'continues authentication after logger %s failure',
		async (failure) => {
			mocks.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
			if (failure === 'initialization')
				mocks.createClient.mockImplementation(() => {
					throw new Error('secret');
				});
			if (failure === 'rejection') mocks.insert.mockRejectedValue(new Error('secret'));
			if (failure === 'returned error')
				mocks.insert.mockResolvedValue({ error: { message: 'secret' } });
			if (failure === 'table selection')
				mocks.createClient.mockReturnValue({
					from: () => {
						throw new Error('secret');
					}
				});
			const { response } = await request('/auth/callback?code=secret');
			expect(response.status).toBe(200);
			expect(mocks.getSession).toHaveBeenCalledOnce();
			expect(console.warn).toHaveBeenCalledWith('Callback logging unavailable');
			expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('secret'));
		}
	);
	it('does not persist auth codes or referer URLs', async () => {
		mocks.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
		await request('/auth/callback?code=secret&token=secret');
		expect(mocks.insert).toHaveBeenCalledWith(
			expect.objectContaining({ path: '/auth/callback', query: '', referer: null })
		);
		expect(JSON.stringify(mocks.insert.mock.calls)).not.toContain('secret');
	});
	it('still redirects anonymous requests to protected routes', async () => {
		await expect(request('/dashboard')).rejects.toMatchObject({ status: 303, location: '/login' });
	});
	it('still validates existing sessions with getUser', async () => {
		mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'test' } } });
		mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid session') });
		await expect(request('/dashboard')).rejects.toMatchObject({ status: 303, location: '/login' });
		expect(mocks.getUser).toHaveBeenCalledOnce();
	});
});
