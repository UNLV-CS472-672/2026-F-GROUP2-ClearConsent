import type { AnalysisResult } from '$lib/contracts/analysis';

// What the result page shows for a source. Only 'not_started' leads the page to request a run.
export type AnalysisState =
	| { status: 'complete'; result: AnalysisResult }
	| { status: 'running' }
	| { status: 'failed'; result: Extract<AnalysisResult, { status: 'failed' }> }
	| { status: 'not_started' };

// The result page's load depends on this, and the page invalidates it to poll a running analysis.
export const ANALYSIS_DEPENDENCY = 'app:analysis';
