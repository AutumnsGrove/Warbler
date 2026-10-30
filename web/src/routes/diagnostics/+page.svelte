<script lang="ts">
	import { onMount } from 'svelte';
	import { api, runningVersion } from '../../lib/api';
	import { mic } from '../../lib/audio/mic.svelte';
	import { eventLog } from '../../lib/eventlog.svelte';
	import { runStorageProbe, type ProbeResult } from '../../lib/storage/probe';

	interface Whoami {
		lock: string;
		identity_header: string;
		identity_header_present: boolean;
		login: string;
	}

	let version = $state<string | null>(null);
	let probe = $state<ProbeResult | null>(null);
	let probeError = $state('');
	let whoami = $state<Whoami | null>(null);
	let whoamiError = $state('');
	let micPermission = $state('not available');
	let copied = $state('');

	const standalone = $derived(
		(navigator as unknown as { standalone?: boolean }).standalone === true ||
			matchMedia('(display-mode: standalone)').matches
	);

	onMount(async () => {
		version = await runningVersion();
		try {
			probe = await runStorageProbe();
		} catch (e) {
			probeError = e instanceof Error ? e.message : 'storage check failed';
		}
		try {
			whoami = await api<Whoami>('/api/whoami');
		} catch (e) {
			whoamiError = e instanceof Error ? e.message : 'request failed';
		}
		try {
			const p = await navigator.permissions.query({ name: 'microphone' as PermissionName });
			micPermission = p.state;
		} catch {
			micPermission = 'not reported by this browser';
		}
	});

	function yesNo(v: boolean | string | undefined | null): string {
		if (v === undefined || v === null) return 'unknown';
		if (typeof v === 'string') return v === 'false' ? 'off' : `on (${v})`;
		return v ? 'on' : 'off';
	}

	function report(): string {
		const g = mic.granted;
		return [
			`Warbler diagnostics, ${new Date().toISOString()}`,
			`Version: ${version ?? 'unknown'}`,
			`Installed to home screen (standalone): ${standalone}`,
			`User agent: ${navigator.userAgent}`,
			`Microphone permission state: ${micPermission}`,
			`Audio sample rate: ${mic.sampleRate ?? 'not started'}`,
			`Audio base latency: ${mic.baseLatency ?? 'not started'}`,
			`Granted echo cancellation: ${yesNo(g?.echoCancellation)}`,
			`Granted noise suppression: ${yesNo(g?.noiseSuppression)}`,
			`Granted auto gain: ${yesNo(g?.autoGainControl)}`,
			`Granted channels: ${g?.channelCount ?? 'unknown'}`,
			`Storage note first written: ${probe ? (probe.justCreated ? 'just now (new)' : probe.firstOpenedAt) : probeError || 'unknown'}`,
			`Storage persistence granted: ${probe?.persisted ?? 'unknown'}`,
			`Storage quota MB / usage KB: ${probe?.quotaMb ?? '?'} / ${probe?.usageKb ?? '?'}`,
			`Identity header: ${whoami ? `${whoami.identity_header} present=${whoami.identity_header_present} lock=${whoami.lock}` : whoamiError || 'unknown'}`,
			'',
			'Events (newest first):',
			...eventLog.entries.map((e) => `${e.at}  ${e.message}`)
		].join('\n');
	}

	async function copy(): Promise<void> {
		try {
			await navigator.clipboard.writeText(report());
			copied = 'Copied. Paste it into the chat.';
		} catch {
			copied = 'Could not copy. Take a screenshot of this page instead.';
		}
	}
</script>

<svelte:head><title>Diagnostics - Warbler</title></svelte:head>

<h1>Diagnostics</h1>
<p class="muted">What your phone and this server report. Use "Copy report" after the Phase 0 phone test.</p>

<section class="card">
	<h2>This app</h2>
	<dl class="facts">
		<dt>Version</dt>
		<dd>{version ?? '...'}</dd>
		<dt>On home screen</dt>
		<dd>{standalone ? 'yes (opened from the icon)' : 'no (opened in the browser)'}</dd>
		<dt>Microphone permission</dt>
		<dd>{micPermission}</dd>
	</dl>
</section>

<section class="card">
	<h2>Audio</h2>
	{#if mic.sampleRate}
		<dl class="facts">
			<dt>Sample rate</dt>
			<dd>{mic.sampleRate.toLocaleString()} Hz</dd>
			<dt>Latency</dt>
			<dd>{mic.baseLatency !== null ? `${(mic.baseLatency * 1000).toFixed(1)} ms` : 'unknown'}</dd>
			<dt>Echo cancellation</dt>
			<dd>{yesNo(mic.granted?.echoCancellation)}</dd>
			<dt>Noise suppression</dt>
			<dd>{yesNo(mic.granted?.noiseSuppression)}</dd>
			<dt>Auto gain</dt>
			<dd>{yesNo(mic.granted?.autoGainControl)}</dd>
		</dl>
		<p class="muted small">Warbler asks for all three to be off. If any show "on", the phone ignored the request.</p>
	{:else}
		<p class="muted">Start the microphone on the Practice tab, then come back here.</p>
	{/if}
</section>

<section class="card">
	<h2>Stored data</h2>
	{#if probe}
		<dl class="facts">
			<dt>Test note</dt>
			<dd>{probe.justCreated ? 'written just now' : `still here, first written ${probe.firstOpenedAt}`}</dd>
			<dt>Kept safe by phone</dt>
			<dd>{probe.persisted === null ? 'not reported' : probe.persisted ? 'yes' : 'not guaranteed'}</dd>
			<dt>Space</dt>
			<dd>{probe.quotaMb ?? '?'} MB allowed, {probe.usageKb ?? '?'} KB used</dd>
		</dl>
		<p class="muted small">Open this page again after a few days. If the note is gone, the phone cleared Warbler's stored data.</p>
	{:else}
		<p class="muted">{probeError || 'Checking...'}</p>
	{/if}
</section>

<section class="card">
	<h2>Server lock</h2>
	{#if whoami}
		<dl class="facts">
			<dt>Lock mode</dt>
			<dd>{whoami.lock}</dd>
			<dt>Identity header</dt>
			<dd>{whoami.identity_header_present ? `arrived (${whoami.login})` : 'did not arrive'}</dd>
		</dl>
	{:else}
		<p class="muted">{whoamiError || 'Checking...'}</p>
	{/if}
</section>

<section class="card">
	<h2>Events</h2>
	{#if eventLog.entries.length === 0}
		<p class="muted">Nothing yet.</p>
	{:else}
		<ul class="events">
			{#each eventLog.entries as e, i (i)}
				<li><span class="muted">{e.at}</span> {e.message}</li>
			{/each}
		</ul>
	{/if}
</section>

<button class="primary" onclick={copy}>Copy report</button>
{#if copied}<p class="muted small">{copied}</p>{/if}

<style>
	.events {
		list-style: none;
		margin: 0;
		padding: 0;
		font-size: 0.875rem;
	}
	.events li {
		padding: 0.2rem 0;
		border-bottom: 1px solid var(--line);
	}
</style>
