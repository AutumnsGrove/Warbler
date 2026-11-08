<script lang="ts">
	/**
	 * Hidden Self-test screen. Not in the navigation; reached from Settings.
	 *
	 * It generates tones whose pitch is known, runs them through the same
	 * analysis code the microphone feeds, and shows expected against measured.
	 * On a real phone this answers "does the measurement work on this device, at
	 * this sample rate" without needing a quiet room or a second app.
	 */
	import { SELF_TEST_PITCHES, describeMeasurement, measureTone, type ToneMeasurement } from '../../lib/audio/tone';
	import { hzToNoteName } from '../../lib/dsp/notes';
	import { runningVersion } from '../../lib/api';
	import { onMount } from 'svelte';

	let results = $state<ToneMeasurement[]>([]);
	let sampleRate = $state<number | null>(null);
	let version = $state<string | null>(null);
	let running = $state(false);

	onMount(() => {
		version = null;
		void runningVersion().then((v) => (version = v));
		void measure();
	});

	async function measure(): Promise<void> {
		running = true;
		results = [];
		try {
			sampleRate ??= await deviceSampleRate();
			const rate = sampleRate ?? 48_000;
			// Let the screen draw its "measuring" state before the arithmetic.
			await new Promise((resolve) => setTimeout(resolve, 30));
			results = SELF_TEST_PITCHES.map((hz) => measureTone(hz, rate));
		} finally {
			running = false;
		}
	}

	/** The rate this device actually uses, from a temporary audio context. */
	async function deviceSampleRate(): Promise<number> {
		const Ctor =
			window.AudioContext ??
			(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		const context = new Ctor();
		const rate = context.sampleRate;
		await context.close().catch(() => {});
		return rate;
	}

	const passed = $derived(results.filter((r) => r.ok).length);
	const allPassed = $derived(results.length > 0 && passed === results.length);
</script>

<svelte:head><title>Self-test - Warbler</title></svelte:head>

<h1>Self-test</h1>
<p class="muted">
	Known tones, measured by the same code that reads your microphone. If the measured pitch matches
	the tone, the analysis is working on this device.
</p>

<div class="card">
	{#if running}
		<p>Measuring...</p>
	{:else if results.length === 0}
		<p>Nothing measured yet.</p>
	{:else}
		<table>
			<thead>
				<tr>
					<th scope="col">Tone</th>
					<th scope="col">Measured</th>
					<th scope="col">Note</th>
					<th scope="col">Difference</th>
				</tr>
			</thead>
			<tbody>
				{#each results as result (result.expected)}
					<tr>
						<td>{result.expected} Hz</td>
						<td>{result.measured === null ? 'nothing' : `${result.measured.toFixed(1)} Hz`}</td>
						<td>{hzToNoteName(result.measured ?? result.expected)}</td>
						<td>{describeMeasurement(result)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="note">
			{allPassed
				? `All ${results.length} tones came back within the 3% tolerance.`
				: `${passed} of ${results.length} tones came back within the 3% tolerance.`}
		</p>
	{/if}
</div>

<button class="primary" onclick={measure} disabled={running}>Measure again</button>

<p class="muted small">
	Sample rate used: {sampleRate ? `${sampleRate.toLocaleString()} Hz` : 'not read yet'}.
	{version ? `Version ${version}.` : ''}
	Tolerance is 3%, from the test plan.
</p>

<p class="muted small"><a href="/settings">Back to Settings</a></p>

<style>
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.95rem;
	}
	th,
	td {
		text-align: left;
		padding: 0.4rem 0.3rem;
		border-bottom: 1px solid var(--line);
	}
	th {
		color: var(--muted);
		font-weight: 500;
	}
	.note {
		margin-top: 0.75rem;
	}
</style>
