<script lang="ts">
	import AnalysisResultView from '$lib/components/AnalysisResultView.svelte';

	import {
		successFixture,
		InsufficientFixture,
		FailureFixture,
		InProgressFixture
	} from '$lib/contracts/fixtures';
</script>

<!-- TODO: replace synthetic fixtures with real links to data from LLM and DB -->
<div class="mt-3 max-w-4xl border border-gray-300 p-2">
	<h2 class="mt-3 text-xl font-bold">Failed</h2>
	<AnalysisResultView result={FailureFixture} />
</div>

<div class="mt-3 max-w-4xl border border-gray-300 p-2">
	<h2 class="mt-3 text-xl font-bold">Insufficient</h2>
	<AnalysisResultView result={InsufficientFixture} />
</div>

<div class="mt-3 max-w-4xl border border-gray-300 p-2">
	<h2 class="mt-3 text-xl font-bold">In Progress</h2>
	<AnalysisResultView result={InProgressFixture} />
</div>

<div class="mt-3 max-w-4xl border border-gray-300 p-2">
	<h2 class="mt-3 text-xl font-bold">Success</h2>
	<AnalysisResultView result={successFixture} />
</div>
