import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		conditions: ['browser']
	},
	test: {
		environment: 'jsdom',
		include: ['src/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			include: ['src/**/*.{ts,svelte}'],
			exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
			reporter: ['text', 'json-summary'],
			// Regression floors below the measured S2 baseline (60.40% lines / 66.77% branches).
			// See docs/testing-and-ci.md for the baseline and current-main verification.
			thresholds: {
				lines: 59,
				branches: 65
			}
		}
	}
});
