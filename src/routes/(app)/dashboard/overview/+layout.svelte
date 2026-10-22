<script lang="ts">
	import type { LayoutProps } from './$types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	let { children }: LayoutProps = $props();

	import Table from '$lib/components/Table.svelte';

	// --- Temporary
	interface historyitem {
		name: string;
		hash: string;
		timestamp: string;
	}

	const TABS = [
		{ name: 'URL', href: '/dashboard/overview/extract' },
		{ name: 'Paste Text', href: '/dashboard/overview/text' },
		{ name: 'Search', href: '#search' }
	] as const;

	let sampledata: historyitem[] = $state(
		[
			{
				name: 'da9ba6d0-535f-4b2d-91e7-963a11b2be80',
				hash: '54248a1050215c844265b0cd7c8195550b078da89b3020f9e08c39adbca5d61e',
				timestamp: '2026-05-21T20:58:15.036527'
			},
			{
				name: '64e62b78-2301-4885-8abe-a055a52baea9',
				hash: '51be3220bb1ff77823a593f3d1feff521e3ce64fc4c5f6eefbc4bd6b0e8a83c2',
				timestamp: '2023-06-02T19:01:09.048173'
			},
			{
				name: '3009af3f-9887-4b2e-a8f6-86034b8a05ee',
				hash: '94332a41dfb863a1783c56599272044af4619ee3cf3cafd70abf91b0f9a800c3',
				timestamp: '2023-05-17T15:52:20.032869'
			},
			{
				name: 'b2477fa4-e287-47de-a6bd-9d3f7fd0e85e',
				hash: 'b8c365a93890fb1e26847a44ce313bf3a8ad8a492b2c2b141541b2de03b8e1a9',
				timestamp: '2024-05-24T12:34:06.031373'
			},
			{
				name: '67a6f38f-f984-482b-b850-6b0ab37385b7',
				hash: '0885decab358e032855611289e5a88dff0b9d3fdab5dff3854455b6aeeca42b0',
				timestamp: '2021-03-27T17:46:40.077959'
			}
		].toSorted((a, b) => {
			return new Date(b.timestamp).valueOf() - new Date(a.timestamp).valueOf();
		})
	);
	// ----------------
	let sortedTimestamp: boolean = $state(true);
</script>

<div class="dashboard-frame">
	<div class="workspace">
		<header class="masthead">
			<div class="identity">
				<span class="brand-mark" aria-hidden="true">C</span>
				<span><strong>ClearConsent</strong><small>Policy workspace</small></span>
			</div>
			<nav aria-label="Dashboard links" class="dashboard-links">
				<a href={resolve('/preferences')}>Preferences</a>
			</nav>
		</header>

		<section class="hero" aria-labelledby="dashboard-title">
			<div>
				<p class="eyebrow">CLEARCONSENT / WORKSPACE</p>
				<h1 id="dashboard-title">Policy workspace</h1>
				<p>Submit a policy URL or paste its text to begin.</p>
			</div>
		</section>

		<div class="dashboard-content">
			<section class="submission-panel" aria-labelledby="submission-title">
				<div class="section-heading">
					<div>
						<p class="section-label">01 / SUBMIT</p>
						<h2 id="submission-title">Start with a policy</h2>
						<p>
							These forms currently validate text or extract it from a URL. Full analysis is still
							being connected.
						</p>
					</div>
				</div>
				<nav aria-label="Policy input methods" class="input-nav">
					{#each TABS as tab (tab.name)}
						{#if tab.href === '#search'}
							<a href="#search" class:active={page.url.hash === '#search'}>{tab.name}</a>
						{:else}
							<a href={resolve(tab.href)} class:active={page.url.pathname === tab.href}
								>{tab.name}</a
							>
						{/if}
					{/each}
				</nav>
				<div class="route-content">
					{#if page.url.pathname === '/dashboard/overview'}
						<p class="choose-method">
							Select <strong>URL</strong> or <strong>Paste Text</strong> above to try an input form.
						</p>
					{/if}
					{@render children()}
				</div>
			</section>

			<section class="history-panel" aria-labelledby="history-title">
				<div class="section-heading history-heading">
					<div>
						<p class="section-label">02 / HISTORY</p>
						<h2 id="history-title">History</h2>
						<p>
							Sample entries show the planned history layout. Saved analyses are not connected yet.
						</p>
					</div>
					<span class="sample-badge">SAMPLE DATA</span>
				</div>
				<div class="history-table">
					<Table>
						<tr class="border border-floral-white bg-darker text-darktext">
							<td
								class="border-r text-center text-xl font-bold hover:cursor-pointer hover:bg-dark"
								onclick={() => {
									if (sortedTimestamp) {
										sampledata.sort((a, b) => a.name.localeCompare(b.name)).reverse();
										sortedTimestamp = false;
									} else sampledata.reverse();
								}}>Name</td
							>
							<td class="border-r text-center text-xl font-bold">Hash</td>
							<td
								class="border-r text-center text-xl font-bold hover:cursor-pointer hover:bg-dark"
								onclick={() => {
									if (!sortedTimestamp) {
										sampledata.sort((a, b) => {
											return new Date(b.timestamp).valueOf() - new Date(a.timestamp).valueOf();
										});
									} else {
										sampledata.reverse();
									}
									sortedTimestamp = true;
								}}>Timestamp</td
							>
							<td></td>
							<!--- stub for styling -->
						</tr>
						{#each sampledata as item (item.name)}
							<tr class="border border-floral-white bg-darker text-darktext">
								<td class="truncate border-r pr-1 pl-1" title={item.name}>{item.name}</td>
								<td class="truncate border-r pr-1 pl-1" title={item.hash}>{item.hash}</td>
								<td class="border-r pr-1 pl-1" title={item.timestamp}
									>{new Date(item.timestamp).toLocaleString()}</td
								>
								<td class="view pt-2 pb-2 text-center">
									<a
										href="#{item.name}"
										class="rounded-lg bg-dark pt-1 pr-2 pb-1 pl-2 text-center text-darktext hover:bg-dark-fg hover:text-url-hover"
										>View</a
									>
								</td>
							</tr>
						{/each}
					</Table>
				</div>
				<p class="scroll-hint">Scroll sideways to see the full sample table.</p>
			</section>
		</div>
		<footer>
			<strong>ClearConsent</strong><span>Privacy policy workspace</span>
		</footer>
	</div>
</div>

<style>
	.dashboard-frame {
		min-height: 100vh;
		padding: 0 28px;
		background: #0b1220;
		color: #17263a;
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
	}
	.workspace {
		max-width: 1240px;
		min-height: 100vh;
		margin: 0 auto;
		background: #f3f6fa;
		box-shadow: 0 24px 70px #0005;
	}
	.masthead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		padding: 19px 46px;
		border-bottom: 1px solid #2c4058;
		background: #0e1a2e;
		color: white;
	}
	.identity {
		display: flex;
		align-items: center;
		gap: 13px;
	}
	.brand-mark {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border: 1px solid #62d7d0;
		border-radius: 8px;
		color: #62d7d0;
		font-size: 21px;
		font-weight: 750;
		transform: rotate(-6deg);
	}
	.identity span:last-child {
		display: grid;
		gap: 3px;
	}
	.identity strong {
		font-size: 14px;
		font-weight: 750;
		letter-spacing: 0.08em;
	}
	.identity small {
		color: #a9c0d1;
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.dashboard-links {
		display: flex;
		align-items: center;
		gap: 25px;
		font-size: 12px;
		font-weight: 700;
	}
	.dashboard-links a {
		color: #d9e8f1;
		text-decoration: none;
	}
	.dashboard-links a:hover {
		color: #70ebe0;
	}
	.hero {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 30px;
		min-height: 218px;
		padding: 40px 46px;
		background-color: #10233d;
		background-image:
			linear-gradient(90deg, #10233dfc, #10233ddc), linear-gradient(#71e6d010 1px, transparent 1px),
			linear-gradient(90deg, #71e6d010 1px, transparent 1px);
		background-size:
			auto,
			32px 32px,
			32px 32px;
		color: white;
	}
	.eyebrow,
	.section-label {
		margin: 0 0 12px;
		color: #137b80;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.18em;
	}
	.eyebrow {
		color: #6ee7de;
	}
	.hero h1 {
		margin: 0;
		font-size: clamp(34px, 4vw, 50px);
		font-weight: 690;
		letter-spacing: -0.05em;
		line-height: 1.1;
	}
	.hero p:last-child {
		max-width: 540px;
		margin: 14px 0 0;
		color: #d1dfeb;
		font-size: 14px;
		line-height: 1.6;
	}
	.dashboard-content {
		display: grid;
		gap: 26px;
		padding: 38px 46px 54px;
	}
	.submission-panel,
	.history-panel {
		min-width: 0;
		padding: 27px;
		border: 1px solid #d7e1ea;
		border-radius: 8px;
		background: white;
	}
	.submission-panel {
		border-top: 3px solid #2ca6af;
	}
	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 20px;
	}
	.section-heading h2 {
		margin: 0 0 7px;
		font-size: 28px;
		font-weight: 690;
		letter-spacing: -0.035em;
	}
	.section-heading p:last-child {
		margin: 0;
		color: #5a6b80;
		font-size: 13px;
		line-height: 1.55;
	}
	.input-nav {
		display: flex;
		gap: 7px;
		margin-top: 26px;
		padding-bottom: 11px;
		border-bottom: 1px solid #d7e1ea;
	}
	.input-nav a {
		padding: 10px 15px;
		border: 1px solid transparent;
		border-radius: 5px;
		color: #456075;
		font-size: 13px;
		font-weight: 750;
		text-decoration: none;
	}
	.input-nav a:hover,
	.input-nav a.active {
		border-color: #b9e9e4;
		background: #e3f8f4;
		color: #116873;
	}
	.route-content {
		min-width: 0;
		padding-top: 27px;
	}
	.route-content :global(form),
	.route-content :global(.w-200) {
		max-width: 100%;
	}
	.route-content :global(textarea),
	.route-content :global(input) {
		border: 1px solid #cbdde4;
		border-radius: 5px;
		background: white;
		color: #17263a;
	}
	.route-content :global(button[type='submit']) {
		padding: 10px 16px;
		border-radius: 4px;
		background: #167f88;
		color: white;
		font-size: 13px;
		font-weight: 750;
	}
	.route-content :global(button[type='submit']:hover:not(:disabled)) {
		background: #116873;
	}
	.choose-method {
		margin: 0;
		padding: 20px 22px;
		border: 1px dashed #accbd3;
		border-radius: 5px;
		background: #f6fafb;
		color: #526b7c;
		font-size: 14px;
	}
	.history-heading {
		margin-bottom: 24px;
	}
	.sample-badge {
		flex-shrink: 0;
		padding: 7px 9px;
		border-radius: 3px;
		background: #e8f1f6;
		color: #266c83;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.1em;
	}
	.history-table {
		overflow-x: auto;
		border: 1px solid #d7e1ea;
		border-radius: 6px;
	}
	.history-table :global(table) {
		width: 100%;
		min-width: 720px;
		border-collapse: collapse;
		table-layout: fixed;
	}
	.history-table :global(tr:first-child) {
		background: #e8f1f6;
		color: #2e5267;
	}
	.history-table :global(tr:not(:first-child)) {
		border-top: 1px solid #e4ebf1;
		background: white;
		color: #294456;
	}
	.history-table :global(tr:not(:first-child):hover) {
		background: #f6fafb;
	}
	.history-table :global(td) {
		padding: 13px 10px;
		border-color: #e4ebf1;
		font-size: 12px;
	}
	.history-table :global(tr:first-child td) {
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.04em;
	}
	.history-table :global(tr:first-child td[title]:hover) {
		cursor: pointer;
	}
	.history-table :global(.view a) {
		background: #e3f8f4;
		color: #126573;
		font-size: 11px;
		font-weight: 750;
		text-decoration: none;
	}
	.scroll-hint {
		display: none;
		margin: 9px 0 0;
		color: #6a7e92;
		font-size: 11px;
	}
	footer {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 20px 46px;
		border-top: 1px solid #d7e1ea;
		color: #66798d;
		font-size: 11px;
	}
	footer strong {
		color: #17263a;
	}
	a:focus-visible {
		outline: 3px solid #42cabc;
		outline-offset: 3px;
	}
	@media (max-width: 720px) {
		.dashboard-frame {
			padding: 0;
		}
		.masthead,
		.hero,
		footer {
			padding-right: 20px;
			padding-left: 20px;
		}
		.hero {
			align-items: start;
			flex-direction: column;
			gap: 20px;
		}
		.dashboard-content {
			padding: 24px 16px 40px;
		}
		.submission-panel,
		.history-panel {
			padding: 20px;
		}
		.route-content :global(textarea),
		.route-content :global(form),
		.route-content :global(input) {
			max-width: 100%;
		}
		.scroll-hint {
			display: block;
		}
	}
	@media (max-width: 480px) {
		.masthead {
			align-items: start;
			flex-direction: column;
			gap: 15px;
		}
		.hero h1 {
			font-size: 36px;
		}
		.input-nav {
			overflow-x: auto;
		}
		.input-nav a {
			flex-shrink: 0;
		}
		.section-heading {
			align-items: start;
			flex-direction: column;
		}
		footer {
			flex-direction: column;
		}
	}
</style>
