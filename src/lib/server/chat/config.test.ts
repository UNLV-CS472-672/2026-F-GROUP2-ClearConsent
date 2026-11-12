import { describe, expect, it } from 'vitest';
import { DEFAULT_OPENAI_MODEL } from '../analysis/openai-provider';
import { chatProviderConfig } from './config';

describe('chatProviderConfig', () => {
	it.each([
		['unset', undefined],
		['set to anything but 1', 'true']
	])('blocks paid calls when ENABLE_PAID_ANALYSIS is %s', (_name, value) => {
		expect(() =>
			chatProviderConfig({ ENABLE_PAID_ANALYSIS: value, OPENAI_API_KEY: 'test-key' })
		).toThrow(expect.objectContaining({ code: 'analysis_disabled', status: 503 }));
	});

	it('requires an API key', () => {
		expect(() => chatProviderConfig({ ENABLE_PAID_ANALYSIS: '1' })).toThrow(
			expect.objectContaining({ code: 'configuration_error' })
		);
	});

	it('uses the analysis model, or the default when none is set', () => {
		expect(chatProviderConfig({ ENABLE_PAID_ANALYSIS: '1', OPENAI_API_KEY: 'key' })).toEqual({
			apiKey: 'key',
			model: DEFAULT_OPENAI_MODEL
		});
		expect(
			chatProviderConfig({
				ENABLE_PAID_ANALYSIS: '1',
				OPENAI_API_KEY: 'key',
				OPENAI_MODEL: ' gpt-x '
			})
		).toEqual({ apiKey: 'key', model: 'gpt-x' });
	});

	it('ignores the analysis reasoning, timeout and output settings', () => {
		const config = chatProviderConfig({
			ENABLE_PAID_ANALYSIS: '1',
			OPENAI_API_KEY: 'key',
			OPENAI_REASONING_EFFORT: 'high',
			OPENAI_TIMEOUT_MS: '180000',
			OPENAI_MAX_OUTPUT_TOKENS: '32000'
		});
		expect(config).toEqual({ apiKey: 'key', model: DEFAULT_OPENAI_MODEL });
	});
});
