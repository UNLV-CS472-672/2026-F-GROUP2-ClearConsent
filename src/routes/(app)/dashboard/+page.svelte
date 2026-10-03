<script lang="ts">
	import type { PageProps } from './$types';
	import Card from '$lib/components/Card.svelte';
	let { data }: PageProps = $props();
</script>

<div class="inline-block h-screen w-screen items-center justify-center">
	<!-- <p class="flex justify-center text-slate-600">Overview</p> -->
	<div class="m-auto flex py-5">
		<Card cardtitle="" mono={true} center={true}>Overview</Card>
	</div>
	<div class="grid grid-row-3 gap-10 py-10">
		<div class="history-container relative block row-span-1">
			<Card cardtitle="History">
				Lorem ipsum dolor sit, amet consectetur adipisicing elit. Iusto repellat, molestiae laborum
				nisi exercitationem dicta blanditiis ullam officia magnam, qui eaque distinctio atque
				aspernatur expedita reiciendis? Ad quasi adipisci necessitatibus?
				<!-- Table + Table item component -->
			</Card>
		</div>
		<div class="upload-container relative block col-span-1">
			<Card cardtitle="Upload">
				Lorem ipsum dolor sit amet, consectetur adipisicing elit. Eius atque velit ad aliquam natus,
				autem a repellendus tempore laudantium asperiores ea, perferendis vitae sit. Laborum quas
				cumque quia ab dicta.
			</Card>
		</div>
	</div>
</div>
