import { cleanup, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TextPage from './+page.svelte';
import { actions } from './+page.server';

const mocks = vi.hoisted(() => ({ goto: vi.fn(), submit: undefined as any }));
vi.mock('$app/navigation', () => ({ goto: mocks.goto }));
vi.mock('$app/paths', () => ({ resolve: (path: string) => path }));
vi.mock('$app/state', () => ({ page: { url: new URL('https://example.test/?detail=detailed') } }));
vi.mock('$app/forms', () => ({
	enhance: (_form: unknown, submit: unknown) => {
		mocks.submit = submit;
	}
}));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

const policy =
	'Privacy Policy. We collect personal information. Cookies and tracking. We retain data. You may access or correct your information.';

describe('paste validation', () => {
	it.each(['', '   ', 'x'.repeat(50001)])('rejects empty or over-limit input', async (text) => {
		const form = new FormData();
		form.set('text_submission', text);
		const result = await actions.default!({
			request: new Request('https://example.test', { method: 'POST', body: form })
		} as any);
		expect(result).toMatchObject({ status: 400, data: { success: false } });
	});
	it('accepts a near-limit policy containing Unicode and URL-reserved characters', async () => {
		const text = (policy + '日本語😀&?#%+'.repeat(6000)).slice(0, 50000);
		const form = new FormData();
		form.set('text_submission', text);
		expect(
			await actions.default!({
				request: new Request('https://example.test', { method: 'POST', body: form })
			} as any)
		).toMatchObject({ success: true, data: text });
	});
});

describe('paste save feedback', () => {
	async function complete(response: unknown) {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
		render(TextPage);
		const callback = await mocks.submit({ cancel: vi.fn() });
		await callback({
			update: vi.fn(),
			result: { type: 'success', data: { success: true, data: policy } }
		});
		await tick();
	}
	it.each([
		{ ok: false, json: async () => ({ message: 'Save failed' }) },
		{ ok: true, json: async () => ({}) },
		{
			ok: true,
			json: async () => {
				throw new SyntaxError();
			}
		}
	])('shows rejected and invalid responses without navigation', async (response) => {
		await complete(response);
		expect(screen.getByRole('alert').textContent).toMatch(/save|invalid/i);
		expect(mocks.goto).not.toHaveBeenCalled();
		expect(screen.getByRole('textbox').hasAttribute('disabled')).toBe(false);
	});
	it('shows network failures and permits retry', async () => {
		await complete(Promise.reject(new TypeError('offline')));
		expect(screen.getByRole('alert').textContent).toContain('Unable to save');
		expect(mocks.goto).not.toHaveBeenCalled();
	});
	it('navigates only after the save returns a valid source ID', async () => {
		await complete({
			ok: true,
			json: async () => ({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
		});
		expect(mocks.goto).toHaveBeenCalledWith(
			'/dashboard/overview/analyze/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?detail=detailed'
		);
		expect(screen.queryByRole('alert')).toBeNull();
	});
	it('shows validation rejection before attempting persistence', async () => {
		const fetch = vi.fn();
		vi.stubGlobal('fetch', fetch);
		render(TextPage);
		const callback = await mocks.submit({ cancel: vi.fn() });
		await callback({
			update: vi.fn(),
			result: {
				type: 'failure',
				data: { success: false, error: 'Input does not appear to be a policy.' }
			}
		});
		await tick();
		expect(screen.getByRole('alert').textContent).toContain('does not appear');
		expect(fetch).not.toHaveBeenCalled();
	});
});
