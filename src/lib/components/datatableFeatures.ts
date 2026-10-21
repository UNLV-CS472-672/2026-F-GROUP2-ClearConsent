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
	sortFn_datetime
} from '@tanstack/svelte-table';

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
			datetime: sortFn_datetime
		},
		filterFns: {
			includesString: filterFn_includesString
		}
	});
