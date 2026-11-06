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
