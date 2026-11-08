<script lang="ts">
	/**
	 * "Find my starting zone", so nobody has to know their own pitch in hertz.
	 *
	 * It listens for six seconds of ordinary speech, reports the middle of what
	 * it heard in plain words with the note name, and offers that as an editable
	 * zone. Nothing is applied until the button is pressed, and the numbers stay
	 * on screen afterwards so the small print is never a surprise.
	 */
	import { onDestroy } from 'svelte';
	import { mic } from '../audio/mic.svelte';
	import { hzToNoteName } from '../dsp/notes';
	import { describeRange, describeSummary, suggestZone, summarisePitch, voicedFrequencies, type PitchSummary } from '../dsp/summary';
	import type { Zone } from '../dsp/zones';
	import { settings } from '../settings/store.svelte';

	const CAPTURE_MS = 6000;

	let stage = $state<'idle' | 'listening' | 'done'>('idle');
	let message = $state('');
	let summary = $state<PitchSummary | null>(null);
	let zone = $state<Zone | null>(null);
	let timer: ReturnType<typeof setInterval> | null = null;

	async function find(): Promise<void> {
		if (stage === 'listening') return;
		summary = null;
		zone = null;
		message = '';
		stage = 'listening';
		await mic.start();
		if (mic.state !== 'running') {
			stage = 'idle';
			message = mic.message || 'The microphone did not start.';
			return;
		}
		const startedAt = performance.now();
		timer = setInterval(() => {
			if (performance.now() - startedAt >= CAPTURE_MS) finish();
		}, 150);
	}

	function finish(): void {
		if (timer) clearInterval(timer);
		timer = null;
		// Read the readings before stopping: stopping clears them.
		const values = voicedFrequencies(mic.frames);
		summary = summarisePitch(values, CAPTURE_MS / 1000);
		zone = suggestZone(summary);
		void mic.stop();
		stage = 'done';
	}

	function apply(): void {
		if (!zone) return;
		settings.update({ startLow: zone.low, startHigh: zone.high, voiceOnly: false });
		message = 'Saved as your starting zone.';
	}

	function stopEarly(): void {
		if (timer) clearInterval(timer);
		timer = null;
		finish();
	}

	onDestroy(() => {
		if (timer) clearInterval(timer);
		timer = null;
	});
</script>

<div class="finder">
	{#if stage === 'listening'}
		<p class="muted small">Listening... speak a sentence or two in your normal voice.</p>
		<button onclick={stopEarly}>That is enough</button>
	{:else}
		<button onclick={find}>Find my starting zone</button>
		<p class="hint">
			Listens for six seconds and suggests a zone. You can type your own numbers instead.
		</p>
	{/if}

	{#if summary && zone}
		<p class="result">{describeSummary(summary, hzToNoteName(summary.median))}</p>
		{#if describeRange(summary)}<p class="hint">{describeRange(summary)}</p>{/if}
		<p class="hint">
			Suggested practice zone: {zone.low}–{zone.high} Hz, a band around the middle of your voice.
		</p>
		<button class="primary" onclick={apply}>
			Use {zone.low}–{zone.high} Hz
		</button>
	{:else if stage === 'done'}
		<p class="result">{describeSummary(null, '')}</p>
		<p class="hint">
			A quiet room and a little more volume usually help. Nothing was changed.
		</p>
	{/if}

	{#if message}<p class="note">{message}</p>{/if}
</div>

<style>
	.finder {
		margin-top: 0.75rem;
		padding: 0.9rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-small);
		background: var(--sand);
	}
	.finder button {
		margin-top: 0.5rem;
	}
	.result {
		margin: 0.75rem 0 0.25rem;
		font-weight: 500;
	}
	.hint {
		color: var(--muted);
		font-size: 0.9rem;
		margin: 0.35rem 0 0;
	}
</style>
