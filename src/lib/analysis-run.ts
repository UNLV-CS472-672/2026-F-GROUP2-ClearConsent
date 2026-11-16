import type { AnalysisResult } from '$lib/contracts/analysis';
import type { PreferenceEvaluation } from '$lib/contracts/preferences';

// What the result page shows for a source. Only 'not_started' leads the page to request a run.
export type AnalysisState =
	| { status: 'complete'; result: AnalysisResult; personalization: Personalization }
	| { status: 'running' }
	| { status: 'failed'; result: Extract<AnalysisResult, { status: 'failed' }> }
	| { status: 'not_started' };

// The personalized indicators saved with a complete analysis (#101):
// - 'ready': the saved indicators, rebuilt as #72's PreferenceEvaluation;
// - 'not_saved': the analysis was saved before personalized indicators were;
// - 'unavailable': they were saved but couldn't be loaded.
// The findings still show in the last two cases; the page should say personalized results are
// missing and why, never present that as no concerns (FR-9, FR-10).
export type Personalization =
	| { status: 'ready'; evaluation: PreferenceEvaluation }
	| { status: 'not_saved' }
	| { status: 'unavailable' };

// The result page's load depends on this, and the page invalidates it to poll a running analysis.
export const ANALYSIS_DEPENDENCY = 'app:analysis';
