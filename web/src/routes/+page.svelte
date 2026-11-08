<script lang="ts">
	import Mic from '@lucide/svelte/icons/mic';
	import Square from '@lucide/svelte/icons/square';
	import Meter from '../lib/components/Meter.svelte';
	import PitchTrace from '../lib/components/PitchTrace.svelte';
	import { mic, TRACE_SECONDS } from '../lib/audio/mic.svelte';
	import { hzToNoteName } from '../lib/dsp/notes';
	import { runningVersion } from '../lib/api';
	import { onMount } from 'svelte';

	let version = $state<string | null>(null);
	onMount(async () => (version = await runningVersion()));

	const rate = $derived(mic.sampleRate ? `${mic.sampleRate.toLocaleString()} Hz` : null);
	const hzText = $derived(mic.pitchHz === null ? null : `${Math.round(mic.pitchHz)} Hz`);
	const noteText = $derived(mic.pitchHz === null ? null : hzToNoteName(mic.pitchHz));
</script>

<svelte:head><title>Warbler</title></svelte:head>

<header class="top">
	<img src="/favicon.svg" alt="" width="44" height="44" />
	<h1>Warbler</h1>
</header>

{#if mic.active}
	<p class="safety">Stop if anything hurts or strains.</p>
{/if}

{#if mic.state === 'idle' || mic.state === 'starting'}
	<p class="muted">Tap the button, allow the microphone, and say something. The bar should move.</p>
	<button class="primary start" onclick={() => mic.start()} disabled={mic.state === 'starting'}>
		<Mic size={26} aria-hidden="true" />
		{mic.state === 'starting' ? 'Starting...' : 'Tap to start'}
	</button>
{:else if mic.state === 'denied' || mic.state === 'error'}
	<div class="card">
		<h2>Warbler cannot hear you yet</h2>
		<p>{mic.message}</p>
		{#if mic.state === 'denied'}
			<p class="muted">
				Allow the microphone for Warbler in your phone's settings (Settings, then Safari or
				Warbler, then Microphone), and try again.
			</p>
		{/if}
	</div>
	<button class="primary start" onclick={() => mic.start()}>
		<Mic size={26} aria-hidden="true" /> Try again
	</button>
{:else}
	<div class="card">
		<h2>{mic.state === 'paused' ? 'Paused' : 'Listening'}</h2>
		<PitchTrace frames={mic.frames} seconds={TRACE_SECONDS} />
		<p class="readout">
			{#if hzText}
				{hzText} <span class="note-name">note {noteText}</span>
			{:else}
				<span class="muted">{mic.state === 'paused' ? 'No reading while paused' : 'Waiting for your voice'}</span>
			{/if}
		</p>
		<p class="muted small">Approximate measurement, not a diagnosis.</p>
		<Meter level={mic.level} peak={mic.peak} db={mic.db} clipping={mic.clipping} />
		{#if mic.clipping}
			<p class="note">That was very loud and the sound got distorted. Try a little more distance.</p>
		{/if}
		{#if mic.state === 'paused'}
			<p class="note">{mic.message || 'The microphone was interrupted.'}</p>
		{/if}
		{#if rate}<p class="muted small">Your phone is listening at {rate}.</p>{/if}
	</div>
	<div class="row">
		{#if mic.state === 'paused'}
			<button class="primary" onclick={() => mic.resume()}>Resume</button>
		{/if}
		<button onclick={() => mic.stop()}><Square size={18} aria-hidden="true" /> Stop</button>
	</div>
{/if}

<p class="muted small footer">
	{version ? `Version ${version}` : ''}
	<a href="/diagnostics">Diagnostics</a>
</p>

<style>
	.top {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}
	.top h1 {
		margin: 0;
	}
	.start {
		width: 100%;
		min-height: 72px;
		font-size: 1.15rem;
		margin-top: 0.5rem;
	}
	.row {
		display: flex;
		gap: 0.75rem;
	}
	.row button {
		flex: 1;
	}
	.readout {
		font-size: 1.75rem;
		font-weight: 600;
		margin: 0.75rem 0 0.15rem;
	}
	.note-name {
		font-size: 1.1rem;
		font-weight: 500;
		color: var(--muted);
	}
	.safety {
		margin: 0 0 0.75rem;
		padding: 0.6rem 0.9rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-small);
		background: var(--paper);
		color: var(--muted);
		font-size: 0.9rem;
	}
	.footer {
		margin-top: 2rem;
		display: flex;
		justify-content: space-between;
	}
</style>
