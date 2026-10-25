<script lang="ts">
	import type { AnalysisResult } from '$lib/contracts/analysis';
	let {
		result,
		detail = 'detailed'
	}: { result: AnalysisResult; detail?: 'quick' | 'balanced' | 'detailed' } = $props();
</script>

{#if result.status === 'failed'}
	<p>We couldn't analyze this policy. Please try again.</p>
{/if}

{#if result.status === 'insufficient'}
	<p>Analysis could not be completed.</p>
	<p>Reason: {result.reason}</p>
{/if}

{#if result.status === 'in_progress'}
	<p>Analysis is being processed...</p>
	<!-- TODO: add UI showing progress (progress bar, spinner, or a rotation of messages) here -->
{/if}

{#if result.status === 'success'}
	<div class="mt-2 max-w-4xl border border-gray-300 p-3">
		<div class="p-3">
			<h2 class="max-w-prose leading-relaxed font-semibold">Summary:</h2>
			<p>{result.summary}</p>
		</div>

		<h2 class="mt-3 leading-relaxed font-semibold">Takeaways:</h2>
		{#each result.takeaways as takeaway (takeaway.id)}
			{@const linked = result.findings.filter((finding) =>
				takeaway.findingIds.includes(finding.id)
			)}
			<div class="mt-4 rounded-lg border border-gray-300 p-4">
				<!-- TODO: confirm formatting and link format to dashboard interface -->
				<h2 class="mt-2 leading-relaxed font-bold">{takeaway.topic}</h2>
				<p class="mt-1">Label: {takeaway.label}</p>
				<p>Reason: {takeaway.reason}</p>
				<!-- <p>Finding IDs: {takeaway.findingIds.join(', ')}</p> -->
				<!-- TODO: determine if layout requires finding IDs to be shown as a list -->

				{#if detail !== 'quick'}
					{#each linked as finding (finding.id)}
						{@const number = result.findings.indexOf(finding) + 1}
						<div class="mt-3 ml-3 border-l-4 border-gray-300 pl-4">
							<h2 class="mt-4 leading-relaxed font-semibold">
								#{number} | Category: {finding.category}
							</h2>
							<p>Description: {finding.plain_language_description}</p>

							{#if finding.dataCategories.length > 0}
								<p>Data Category: [ {finding.dataCategories.join(', ')} ]</p>
							{/if}

							{#if finding.purposes.length > 0}
								<p>Purpose: [ {finding.purposes.join(', ')} ]</p>
							{/if}

							{#if finding.recipients.length > 0}
								<p>Recipients: [ {finding.recipients.join(', ')} ]</p>
							{/if}
							{#if detail === 'detailed'}
								<h2 class="mt-2 leading-relaxed font-semibold">Evidence:</h2>
								{#each finding.evidence as evid, j (j)}
									<p>#{number}.{j + 1}</p>
									<p>Excerpt: "{evid.excerpt}"</p>
								{/each}
							{/if}
						</div>
					{/each}
				{/if}
			</div>
		{/each}
	</div>
{/if}
