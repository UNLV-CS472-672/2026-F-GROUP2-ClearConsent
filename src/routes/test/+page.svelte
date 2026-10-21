<script lang="ts">
	import DataTable from '$lib/components/DataTable.svelte';
	import {
		createTable,
		FlexRender,
		rowAggregationFeature,
		tableFeatures
	} from '@tanstack/svelte-table';
	import type { ColumnDef } from '@tanstack/svelte-table';

	// 1. Define the shape of your data
	type Person = {
		firstName: string;
		lastName: string;
		age: number;
	};

	// 2. Store data with a $state rune for reactivity
	let data = $state<Array<Person>>([
		{ firstName: 'tanner', lastName: 'linsley', age: 24 },
		{ firstName: 'tandy', lastName: 'miller', age: 40 },
		{ firstName: 'joe', lastName: 'dirte', age: 45 }
	]);

	// 3. New in v9: declare which features this table uses (none yet)
	const features = tableFeatures({});

	// 4. Define your columns
	const fromKey = (asdf: string) => {
		return asdf
			.replace(/\b([a-z])\b([a-z])([A-Z])/g, '$1 $2')
			.replace(/[-_]/, ' ')
			.replace(/^./, (ch) => ch.toUpperCase());
	};

	const columns: ColumnDef<typeof features, Person>[] = [
		{
			accessorKey: 'firstName', // accessorKey shorthand
			header: 'First Name',
			cell: (info) => info.getValue() // explicit
		},
		{
			accessorFn: (row) => row.lastName, // accessorFn alternative with a custom id
			id: 'lastName',
			header: () => fromKey('lastName'),
			cell: (info) => info.getValue()
		},
		{
			accessorKey: 'age',
			header: () => 'Age'
		}
	];

	// 5. Create the table instance
	const table = createTable({
		features,
		columns,
		get data() {
			return data; // a getter keeps the table in sync with the $state rune
		}
	});
</script>

<!-- 6. Render markup from the table instance APIs -->
<div class="flex flex-col gap-5">
	<div class="m-20 flex items-center justify-center">
		<table>
			<thead>
				{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
					<tr>
						{#each headerGroup.headers as header (header.id)}
							<th class="border p-1">
								{#if !header.isPlaceholder}
									<FlexRender {header} />
								{/if}
							</th>
						{/each}
					</tr>
				{/each}
			</thead>
			<tbody class="">
				{#each table.getRowModel().rows as row (row.id)}
					<tr>
						{#each row.getAllCells() as cell (cell.id)}
							<td class="border p-0.5 pl-1">
								<FlexRender {cell} />
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="flex items-center justify-center">
		<DataTable></DataTable>
	</div>
</div>
