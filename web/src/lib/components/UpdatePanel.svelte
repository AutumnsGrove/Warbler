<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { runningVersion } from '../api';
	import { mic } from '../audio/mic.svelte';
	import {
		getAvailable,
		getUpdateStatus,
		getVersion,
		requestCheck,
		requestUpdate
	} from '../update/client';
	import {
		deriveView,
		type Available,
		type UpdateResult,
		type VersionInfo
	} from '../update/view';

	let info = $state<VersionInfo | null>(null);
	let available = $state<Available | null>(null);
	let checkPending = $state(false);
	let updatePending = $state(false);
	let result = $state<UpdateResult | null>(null);
	let startedAt = $state<number | null>(null);
	let startedFromVersion = $state<string | null>(null);
	let runningVer = $state<string | null>(null);
	let serverUnreachable = $state(false);
	let loadError = $state('');
	let actionError = $state('');
	let slow = $state(false);

	let timer: ReturnType<typeof setInterval> | null = null;
	let pollUntil = 0;

	const view = $derived(
		deriveView({
			info,
			available,
			checkPending,
			updatePending,
			result,
			startedAt,
			startedFromVersion,
			runningVersion: runningVer,
			serverUnreachable
		})
	);

	async function refresh(): Promise<void> {
		try {
			info = await getVersion();
			const a = await getAvailable();
			available = a.available;
			checkPending = a.check_pending;
			const st = await getUpdateStatus();
			updatePending = st.pending;
			result = st.result;
			runningVer = info.version;
			serverUnreachable = false;
			loadError = '';
		} catch (err) {
			if (startedAt !== null) serverUnreachable = true;
			else loadError = err instanceof Error ? err.message : 'Could not reach Warbler.';
		}
	}

	async function tick(): Promise<void> {
		if (startedAt !== null) {
			// The page is served by the container being replaced, so /healthz
			// may vanish for a while. That is expected during an update.
			const v = await runningVersion();
			if (v === null) {
				serverUnreachable = true;
			} else {
				serverUnreachable = false;
				runningVer = v;
				await refresh();
			}
		} else {
			await refresh();
		}
		slow = startedAt !== null && Date.now() - startedAt > 5 * 60_000;
		if (view.kind === 'done') {
			stopPolling();
			setTimeout(() => location.reload(), 1500);
		} else if (view.kind === 'failed' || Date.now() > pollUntil) {
			stopPolling();
		} else if (startedAt === null && !checkPending) {
			stopPolling();
		}
	}

	function startPolling(forMs: number): void {
		pollUntil = Date.now() + forMs;
		if (timer) clearInterval(timer);
		timer = setInterval(() => void tick(), 2000);
	}

	function stopPolling(): void {
		if (timer) clearInterval(timer);
		timer = null;
	}

	async function check(): Promise<void> {
		actionError = '';
		try {
			await requestCheck();
			checkPending = true;
			startPolling(60_000);
		} catch (err) {
			actionError = err instanceof Error ? err.message : 'Could not ask for a check.';
		}
	}

	async function update(): Promise<void> {
		actionError = '';
		try {
			startedFromVersion = runningVer;
			startedAt = Date.now();
			await requestUpdate();
			updatePending = true;
			startPolling(10 * 60_000);
		} catch (err) {
			startedAt = null;
			actionError = err instanceof Error ? err.message : 'Could not start the update.';
		}
	}

	onMount(() => void refresh());
	onDestroy(stopPolling);

	function when(iso: string | null): string {
		if (!iso) return '';
		const d = new Date(iso);
		return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
	}
</script>

<section class="card" aria-labelledby="about-heading">
	<h2 id="about-heading">About</h2>

	{#if loadError}
		<p class="note">Could not reach Warbler: {loadError}</p>
	{:else}
		<dl class="facts">
			<dt>Version</dt>
			<dd>{info?.version ?? '...'}</dd>
			<dt>Installed</dt>
			<dd>{info?.deployment === 'docker' ? 'Docker' : (info?.deployment ?? '...')}</dd>
		</dl>
	{/if}

	{#if view.kind === 'no_updater'}
		<p class="note">
			Updates are not set up on this server{view.stale ? ' (the update helper has gone quiet)' : ''}.
			See docs/update.md for the install steps.
		</p>
	{:else if view.kind === 'checking'}
		<p>Checking for a newer version...</p>
	{:else if view.kind === 'up_to_date'}
		<p>
			Up to date.
			{#if view.checkedAt}<span class="muted small">Last checked {when(view.checkedAt)}.</span>{/if}
		</p>
		<button onclick={check}>Check for updates</button>
	{:else if view.kind === 'available'}
		<p>A newer version is ready: <strong>{view.latest}</strong>.</p>
		<button class="primary" onclick={update} disabled={mic.active}>Update now</button>
		{#if mic.active}<p class="muted small">Finish your session first.</p>{/if}
	{:else if view.kind === 'updating'}
		<p>Updating. This takes a minute. Warbler will reload when it is done.</p>
		{#if slow}<p class="note">This is taking longer than expected. It is still working.</p>{/if}
	{:else if view.kind === 'done'}
		<p>Updated to <strong>{view.version}</strong>. Reloading.</p>
	{:else if view.kind === 'failed'}
		{#if view.rollbackFailed}
			<p class="note">
				The update did not work, and Warbler may not be running properly. Check the potato.
			</p>
		{:else}
			<p>The update did not work, and the previous version is running again.</p>
		{/if}
		<p class="muted small">{view.detail}</p>
		{#if !view.rollbackFailed}<button onclick={update}>Try again</button>{/if}
	{:else}
		<p class="muted">Loading...</p>
	{/if}

	{#if actionError}<p class="note">{actionError}</p>{/if}
</section>
