<script lang="ts">
	import Mic from '@lucide/svelte/icons/mic';
	import Square from '@lucide/svelte/icons/square';
	import Meter from '../lib/components/Meter.svelte';
	import PitchTrace from '../lib/components/PitchTrace.svelte';
	import ReferenceTone from '../lib/components/ReferenceTone.svelte';
	import { mic, TRACE_SECONDS } from '../lib/audio/mic.svelte';
	import { hzToNoteName } from '../lib/dsp/notes';
	import { describeDistance } from '../lib/dsp/zones';
	import { practiceZone, startZone } from '../lib/settings/settings';
	import { settings } from '../lib/settings/store.svelte';
	import {
		PRACTICE_BANNER,
		STOP_SCREEN_LINES,
		formatClock,
		requiresStopScreen,
		sessionPhase
	} from '../lib/session/practice';
	import { runningVersion } from '../lib/api';
	import { onMount } from 'svelte';

	let version = $state<string | null>(null);
	let acknowledged = $state(false);
	let startedAt = $state<number | null>(null);
	let now = $state(Date.now());
	let breaksTaken = $state(0);

	onMount(() => {
		void runningVersion().then((v) => (version = v));
		// A one-second tick drives the clock, the break prompt and the session limit.
		const tick = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(tick);
	});

	const values = $derived(settings.values);
	const plan = $derived({ sessionMinutes: values.sessionMinutes, breakMinutes: values.breakMinutes });
	const phase = $derived(sessionPhase(startedAt, now, plan, breaksTaken, mic.state === 'running'));
	const elapsed = $derived(startedAt === null ? 0 : Math.floor((now - startedAt) / 1000));
	const rate = $derived(mic.sampleRate ? `${mic.sampleRate.toLocaleString()} Hz` : null);
	const hzText = $derived(mic.pitchHz === null ? null : `${Math.round(mic.pitchHz)} Hz`);
	const noteText = $derived(
		mic.pitchHz === null || !values.showNoteNames ? null : hzToNoteName(mic.pitchHz)
	);
	/** The ramped band, or null in voice-only mode and until both zones are set. */
	const zone = $derived(practiceZone(values));
	const startBand = $derived(values.voiceOnly ? null : startZone(values));
	const sentence = $derived(describeDistance(mic.pitchHz, zone, 'your practice zone'));

	/** Start the microphone, then begin timing only if it actually started. */
	async function startPractice(): Promise<void> {
		await mic.start();
		if (mic.state === 'running') {
			startedAt = Date.now();
			now = Date.now();
			breaksTaken = 0;
		}
	}

	/** End the session and reset the gate, so the next start passes the stop screen again. */
	async function finish(): Promise<void> {
		await mic.stop();
		startedAt = null;
		breaksTaken = 0;
		acknowledged = false;
	}
</script>

<svelte:head><title>Warbler</title></svelte:head>

<header class="top">
	<img src="/favicon.svg" alt="" width="44" height="44" />
	<h1>Warbler</h1>
</header>

{#if mic.active}
	<p class="safety">{PRACTICE_BANNER}</p>
{/if}

{#if mic.state === 'idle' || mic.state === 'starting'}
	{#if requiresStopScreen(acknowledged)}
		<div class="card">
			<h2>Before you start</h2>
			{#each STOP_SCREEN_LINES as line}
				<p>{line}</p>
			{/each}
			<p class="muted small">This appears before every practice. Warbler never asks you to push through discomfort.</p>
		</div>
		<button class="primary start" onclick={() => (acknowledged = true)}>I understand, continue</button>
	{:else}
		<p class="muted">Tap the button, allow the microphone, and say something. The line should move.</p>
		<button class="primary start" onclick={startPractice} disabled={mic.state === 'starting'}>
			<Mic size={26} aria-hidden="true" />
			{mic.state === 'starting' ? 'Starting...' : 'Tap to start'}
		</button>
	{/if}
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
		<PitchTrace
			frames={mic.frames}
			seconds={TRACE_SECONDS}
			{zone}
			startZone={startBand}
			viewLow={values.minHz}
			viewHigh={values.maxHz}
		/>
		<p class="readout">
			{#if hzText}
				{hzText}{#if noteText}<span class="note-name">note {noteText}</span>{/if}
			{:else}
				<span class="muted">{mic.state === 'paused' ? 'No reading while paused' : 'Waiting for your voice'}</span>
			{/if}
		</p>
		{#if sentence}<p class="note">{sentence}</p>{/if}
		{#if zone}
			<div class="tone">
				<ReferenceTone hz={(zone.low + zone.high) / 2} />
				<p class="muted small">A quiet tone at the middle of your practice zone.</p>
			</div>
		{/if}
		<p class="muted small">Approximate measurement, not a diagnosis.</p>
		<Meter level={mic.level} peak={mic.peak} db={mic.db} clipping={mic.clipping} />
		{#if mic.clipping}
			<p class="note">That was very loud and the sound got distorted. Try a little more distance.</p>
		{/if}
		{#if mic.state === 'paused'}
			<p class="note">{mic.message || 'The microphone was interrupted.'}</p>
		{/if}
		<p class="muted small">
			{formatClock(elapsed)} of {values.sessionMinutes}:00 in this session
		</p>
		{#if rate}<p class="muted small">Your phone is listening at {rate}.</p>{/if}
	</div>
	<div class="row">
		{#if mic.state === 'paused'}
			<button class="primary" onclick={() => mic.resume()}>Resume</button>
		{/if}
		<button onclick={finish}><Square size={18} aria-hidden="true" /> Stop</button>
	</div>
{/if}

{#if phase === 'break-due'}
	<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="break-title">
		<div class="sheet-card">
			<h2 id="break-title">Time for a short break</h2>
			<p>Sip some water, rest your voice for a minute.</p>
			<div class="row">
				<button onclick={() => (breaksTaken += 1)}>Keep going</button>
				<button class="primary" onclick={finish}>Finish</button>
			</div>
		</div>
	</div>
{:else if phase === 'over'}
	<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="end-title">
		<div class="sheet-card">
			<h2 id="end-title">You have reached your session limit</h2>
			<p>Good place to stop. The limit can be changed in Settings, when you choose.</p>
			<button class="primary" onclick={finish}>Finish</button>
		</div>
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
	.sheet {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		background: rgb(22 18 13 / 0.72);
		padding: 1rem;
		z-index: 20;
	}
	.sheet-card {
		width: min(30rem, 100%);
		background: var(--paper);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 1.25rem;
		margin-bottom: 4.5rem;
	}
	.sheet-card .row {
		margin-top: 1rem;
	}
	.tone {
		margin: 0.75rem 0 0;
	}
	.footer {
		margin-top: 2rem;
		display: flex;
		justify-content: space-between;
	}
</style>
