import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	reporter: [['list'], ['./tests/e2e/count-reporter.ts']],
	// One account is shared by authenticated cases; sign-out can revoke other sessions.
	workers: process.env.STUDY_TEST_EMAIL ? 1 : undefined,
	use: {
		baseURL: 'http://127.0.0.1:4173',
		// Authenticated runs enter a real password; keep it out of trace snapshots.
		trace: process.env.STUDY_TEST_EMAIL ? 'off' : 'on-first-retry'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: {
		command: 'npm run dev -- --host 127.0.0.1 --port 4173',
		url: 'http://127.0.0.1:4173',
		reuseExistingServer: !process.env.CI
	}
});
