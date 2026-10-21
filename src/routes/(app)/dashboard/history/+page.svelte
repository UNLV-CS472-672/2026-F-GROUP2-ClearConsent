<script lang="ts">
	import DataTable from '$lib/components/DataTable.svelte';
	import type { features } from '$lib/components/datatableFeatures';
	import { createColumnHelper } from '@tanstack/svelte-table';
	import type { ColumnDef } from '@tanstack/svelte-table';
	// Temporary for display purposes
	interface temporary_data {
		name: string;
		hash: string;
		salt?: string;
		timestamp: number | string | Date;
		url: string | any;
	}

	const companies = [
		'Apple',
		'Microsoft',
		'Amazon',
		'Alphabet',
		'Meta',
		'NVIDIA',
		'Tesla',
		'Netflix',
		'Adobe',
		'Salesforce',
		'IBM',
		'Intel',
		'Cisco',
		'Oracle',
		'Qualcomm',
		'AMD',
		'Shopify',
		'Spotify',
		'Uber',
		'Airbnb',
		'PayPal',
		'Visa',
		'Mastercard',
		'JPMorgan Chase',
		'Goldman Sachs',
		'Bank of America',
		'Walmart',
		'Target',
		'Costco',
		'Coca-Cola',
		'PepsiCo',
		'Nike',
		'Adidas',
		'Toyota',
		'Honda',
		'Ford',
		'General Motors',
		'BMW',
		'Mercedes-Benz',
		'Samsung',
		'Sony',
		'LG',
		'Nintendo',
		'IKEA',
		'Unilever',
		'Procter & Gamble',
		'Johnson & Johnson',
		'Pfizer',
		'DHL',
		'FedEx'
	];
	async function gethash(data: string, salt: string = '') {
		const bytes = new TextEncoder().encode(data + salt);
		const digest = await crypto.subtle.digest('SHA-256', bytes);
		return Array.from(new Uint8Array(digest))
			.map((byte) => byte.toString(16).padStart(2, '0'))
			.join('');
	}
	function randomtimestamp(): string {
		let s = new Date('2016-01-01').getTime();
		// Return as ISOString and format as necessary
		return new Date(Math.random() * (Date.now() - s) + s).toISOString();
	}
	async function gen_randomtempdata(): Promise<temporary_data[]> {
		let data: temporary_data[] = [];
		for (let i = 0; i < companies.length; i++)
			data.push({
				name: companies[i],
				hash: await gethash(companies[i]),
				timestamp: randomtimestamp(),
				get url() {
					return '#' + this.hash;
				}
			});
		return data;
	}

	let data: temporary_data[] = $state([]);
	gen_randomtempdata().then((res) => data = res);
	// ---
	const columnHelper = createColumnHelper<typeof features, temporary_data>();

	const columns: ColumnDef<typeof features, temporary_data>[] = columnHelper.columns([
		columnHelper.accessor('name', {
			header: 'Name',
			size: 40
		}),
	
		columnHelper.accessor('hash', {
			header: 'Hash',
			minSize: 50,
			maxSize: 300
		}),
		columnHelper.accessor('timestamp', {
			id: 'timestamp',
			header: 'Timestamp',
			cell: (info) => new Date(info.getValue()).toLocaleString(),
			minSize: 50,
			maxSize: 75
		}),
		columnHelper.accessor('url', {
			id: 'url',
			header: ' ',
			minSize: 0,
			maxSize: 35,
			enableSorting: false
		})
	]);
</script>

<div class="flex flex-col w-full items-center justify-center pb-5">
	<!-- <div
		class="flex h-7/8 w-7/8 flex-col items-center justify-center overflow-scroll border border-black/40 inset-shadow-xs inset-shadow-black"
	> -->
		<h1 class="font-lg mb-5 font-bold">Nothing substantial here yet.</h1>
		<DataTable {data} {columns}></DataTable>
	<!-- </div> -->
</div>
