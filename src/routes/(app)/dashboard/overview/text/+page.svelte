<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { detailLevel } from '$lib/detail-level';

	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import type { PageProps, SubmitFunction } from './$types';
	let { form }: PageProps = $props();
	let loading: boolean = $state(false);
	let error: string = $state('');
	let enhancedSubmission = $state(false);
	// Native submissions use the server action's form data; enhanced ones use local feedback.
	const formError = $derived(
		form && 'error' in form && typeof form.error === 'string' ? form.error : ''
	);
	const visibleError = $derived(enhancedSubmission ? error : formError);
	let input = $state('');

	const submit: SubmitFunction = async () => {
		enhancedSubmission = true;
		loading = true;
		error = '';

		return async ({ result }) => {
			try {
				if (result.type !== 'success' && result.type !== 'failure') {
					error = 'Unable to validate the submitted text. Please try again.';
					return;
				}
				const data = result.data;
				if (data?.success && 'data' in data && typeof data.data === 'string') {
					await saveSource(data.data);
				} else {
					error =
						typeof data?.error === 'string' ? data.error : 'Unable to validate the submitted text.';
				}
			} catch {
				error = 'Unable to save the submitted text. Please try again.';
			} finally {
				loading = false;
			}
		};
	};

	const saveSource = async (content: string) => {
		const res = await fetch('/source', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ content })
		});
		const body: unknown = await res.json();
		if (!res.ok) {
			error = 'Unable to save the submitted text. Please try again.';
			return;
		}
		if (
			!body ||
			typeof body !== 'object' ||
			!('id' in body) ||
			typeof body.id !== 'string' ||
			!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id)
		) {
			error = 'The save response was invalid. Please try again.';
			return;
		}
		await goto(
			resolve(
				`/dashboard/overview/analyze/${body.id}?detail=${detailLevel(page.url.searchParams.get('detail'))}`
			)
		);
	};

	const keydown = (e: KeyboardEvent) => {
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			(e.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
		}
	};
</script>

<div class="flex flex-col pb-10">
	<form method="POST" class="m-auto flex flex-col items-end gap-2" use:enhance={submit}>
		<textarea
			id="text_submission"
			name="text_submission"
			title="Ctrl+Enter to submit."
			bind:value={input}
			placeholder="Paste policy..."
			onkeypress={keydown}
			required
			class="h-50 w-200 resize-none overflow-scroll border border-gray-300 px-2 py-2 text-base"
			disabled={loading}></textarea>
		<button
			type="submit"
			class="w-fit bg-black px-3 py-1 font-bold text-floral-white"
			disabled={loading}>{loading ? 'Submitting...' : 'Submit'}</button
		>
	</form>
	<div class="w-200 items-center justify-center">
		{#if visibleError}
			<p role="alert" class="mt-4 bg-red-50 p-3 text-red-700">{visibleError}</p>
		{/if}
	</div>
</div>
