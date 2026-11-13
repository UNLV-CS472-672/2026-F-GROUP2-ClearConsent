import {
	tableFeatures,
	rowSortingFeature,
	createFilteredRowModel,
	createPaginatedRowModel,
	createSortedRowModel,
	columnFilteringFeature,
	columnSizingFeature,
	rowPaginationFeature,
	filterFn_includesString,
	sortFn_alphanumeric,
	sortFn_text,
	sortFn_datetime
} from '@tanstack/svelte-table';
import type { AnalysisResult } from '$lib/contracts/analysis';

export const features = tableFeatures({
	rowPaginationFeature,
	rowSortingFeature,
	columnFilteringFeature,
	columnSizingFeature,
	filteredRowModel: createFilteredRowModel(),
	paginatedRowModel: createPaginatedRowModel(),
	sortedRowModel: createSortedRowModel(),
	sortFns: {
		alphanumeric: sortFn_alphanumeric,
		text: sortFn_text,
		datetime: sortFn_datetime
	},
	filterFns: {
		includesString: filterFn_includesString
	}
});

export type RecentSource = {
	id: string;
	title: string | null;
	url: string | null;
	created_at: string;
};

export type SourceAndResult = {
	source: RecentSource;
	result: AnalysisResult;
};

// Helper functions
// Some table logic described here to make testing easier.
// These functions do not explicitly differentiate between pasted text or url submission.
export function titleOrId(source: RecentSource) {
	// Returns a sources title if it's not null or 'Untitled' if title is null.
	return source.title ?? 'Untitled';
}
export function urlOrText(source: RecentSource) {
	// Returns a source's url if it's not null or 'No URL Available' if it is null.
	return source.url ?? 'No URL Available';
}
