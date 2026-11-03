import type { FullResult, Reporter, Suite, TestCase } from '@playwright/test/reporter';

export default class CountReporter implements Reporter {
	private tests: TestCase[] = [];

	onBegin(_config: unknown, suite: Suite) {
		this.tests = suite.allTests();
	}

	async onEnd(result: FullResult) {
		const counts = { passed: 0, failed: 0, skipped: 0, interrupted: 0, notRun: 0 };
		for (const test of this.tests) {
			const status = test.results.at(-1)?.status;
			if (status === 'passed') counts.passed++;
			else if (status === 'skipped') counts.skipped++;
			else if (status === 'failed' || status === 'timedOut') counts.failed++;
			else if (status === 'interrupted') counts.interrupted++;
			else counts.notRun++;
		}

		const selected = this.tests.length;
		const authenticated = this.tests.filter((test) => test.tags.includes('@authenticated')).length;
		console.log(
			`Browser cases: selected=${selected}, authenticated=${authenticated}, passed=${counts.passed}, failed=${counts.failed}, skipped=${counts.skipped}, interrupted=${counts.interrupted}, not-run=${counts.notRun}`
		);

		const expected = process.env.CI_E2E_EXPECTED;
		if (expected !== undefined && (selected !== Number(expected) || counts.passed !== selected)) {
			console.error(
				`Expected ${expected} selected browser cases to execute and pass with zero skips.`
			);
			return { status: 'failed' as const };
		}
		return { status: result.status };
	}
}
