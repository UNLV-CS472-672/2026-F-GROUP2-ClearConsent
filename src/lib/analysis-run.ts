import type { AnalysisResult } from '$lib/contracts/analysis';
import type { PreferenceEvaluation } from '$lib/contracts/preferences';

// What the result page shows for a source. Only 'not_started' leads the page to request a run.
export type AnalysisState =
	// preferenceEvaluation is null for analyses saved before personalized indicators were.
	| {
			status: 'complete';
			result: AnalysisResult;
			preferenceEvaluation: PreferenceEvaluation | null;
	  }
	| { status: 'running' }
	| { status: 'failed'; result: Extract<AnalysisResult, { status: 'failed' }> }
	| { status: 'not_started' };

// The result page's load depends on this, and the page invalidates it to poll a running analysis.
export const ANALYSIS_DEPENDENCY = 'app:analysis';
