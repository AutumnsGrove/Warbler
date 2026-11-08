<script lang="ts">
	/**
	 * Settings: the numbers that shape practice.
	 *
	 * Deliberately plain. Every field explains itself in one sentence, there is
	 * no "advanced" area, and nothing here can be raised by accident: the ramp
	 * and the session limit only move when someone types or drags them.
	 */
	import UpdatePanel from '../../lib/components/UpdatePanel.svelte';
	import { settings } from '../../lib/settings/store.svelte';
	import { LIMITS, needsSetup, practiceZone, validateSettings, type Settings } from '../../lib/settings/settings';
	import { onMount } from 'svelte';

	onMount(() => settings.load());

	const values = $derived(settings.values);
	const problems = $derived(validateSettings(values));
	const zone = $derived(practiceZone(values));
	const zoneText = $derived(
		zone ? `${Math.round(zone.low)}–${Math.round(zone.high)} Hz` : 'not set yet'
	);
	const setupNeeded = $derived(needsSetup(values));

	function numberFrom(text: string): number | null {
		const trimmed = text.trim();
		if (trimmed === '') return null;
		const parsed = Number(trimmed);
		return Number.isFinite(parsed) ? parsed : null;
	}

	type ZoneField = 'startLow' | 'startHigh' | 'targetLow' | 'targetHigh';
	function setZone(field: ZoneField, text: string): void {
		settings.update({ [field]: numberFrom(text) } as Partial<Settings>);
	}

	/** Fields that must always have a number, with a fallback if cleared. */
	function setRequired(field: 'minHz' | 'maxHz' | 'sessionMinutes' | 'breakMinutes', text: string): void {
		const parsed = numberFrom(text);
		if (parsed !== null) settings.update({ [field]: parsed } as Partial<Settings>);
	}

	function fieldFor(name: string) {
		return problems.find((p) => p.field === name);
	}
</script>

<svelte:head><title>Settings - Warbler</title></svelte:head>

<h1>Settings</h1>

{#if setupNeeded}
	<p class="note">
		Warbler does not know your voice yet. Set a starting zone and a target zone below, or turn on
		"just show me my voice" to practise without comparisons.
	</p>
{/if}

<section class="card">
	<h2>Goals</h2>

	<div class="pair">
		<label for="startLow">Starting zone, from</label>
		<div class="inline">
			<input
				id="startLow"
				type="number"
				inputmode="numeric"
				min="50"
				max="800"
				placeholder="Hz"
				value={values.startLow ?? ''}
				oninput={(e) => setZone('startLow', e.currentTarget.value)}
			/>
			<label for="startHigh" class="to">to</label>
			<input
				id="startHigh"
				type="number"
				inputmode="numeric"
				min="50"
				max="800"
				placeholder="Hz"
				value={values.startHigh ?? ''}
				oninput={(e) => setZone('startHigh', e.currentTarget.value)}
			/>
		</div>
	</div>
	<p class="hint">Where your voice sits at the moment, when you speak normally.</p>
	{#if fieldFor('start')}<p class="note">{fieldFor('start')?.message}</p>{/if}

	<div class="pair">
		<label for="targetLow">Target zone, from</label>
		<div class="inline">
			<input
				id="targetLow"
				type="number"
				inputmode="numeric"
				min="50"
				max="800"
				placeholder="Hz"
				value={values.targetLow ?? ''}
				oninput={(e) => setZone('targetLow', e.currentTarget.value)}
			/>
			<label for="targetHigh" class="to">to</label>
			<input
				id="targetHigh"
				type="number"
				inputmode="numeric"
				min="50"
				max="800"
				placeholder="Hz"
				value={values.targetHigh ?? ''}
				oninput={(e) => setZone('targetHigh', e.currentTarget.value)}
			/>
		</div>
	</div>
	<p class="hint">Where you are heading. Warbler never asks you to reach it directly.</p>
	{#if fieldFor('target')}<p class="note">{fieldFor('target')?.message}</p>{/if}

	<div class="pair">
		<label for="ramp">Step towards the target</label>
		<div class="slider">
			<input
				id="ramp"
				type="range"
				min="0"
				max="100"
				step="5"
				value={values.rampPercent}
				oninput={(e) => settings.update({ rampPercent: Number(e.currentTarget.value) })}
			/>
			<output for="ramp">{values.rampPercent}%</output>
		</div>
	</div>
	<p class="hint">
		Practice happens here, not at the target: currently {zoneText}. Only you can raise this.
	</p>

	<label class="check">
		<input
			type="checkbox"
			checked={values.voiceOnly}
			onchange={(e) => settings.update({ voiceOnly: e.currentTarget.checked })}
		/>
		Just show me my voice, without zones or comparisons
	</label>
</section>

<section class="card">
	<h2>Safety</h2>
	<div class="pair">
		<label for="session">Session limit, minutes</label>
		<input
			id="session"
			type="number"
			inputmode="numeric"
			min={LIMITS.sessionMinutes.low}
			max={LIMITS.sessionMinutes.high}
			value={values.sessionMinutes}
			oninput={(e) => setRequired('sessionMinutes', e.currentTarget.value)}
		/>
	</div>
	<p class="hint">The practice screen cannot change this. It ends the session when time is up.</p>

	<div class="pair">
		<label for="breakEvery">Break reminder, minutes</label>
		<input
			id="breakEvery"
			type="number"
			inputmode="numeric"
			min={LIMITS.breakMinutes.low}
			max={LIMITS.breakMinutes.high}
			value={values.breakMinutes}
			oninput={(e) => setRequired('breakMinutes', e.currentTarget.value)}
		/>
	</div>
	<p class="hint">A gentle prompt to rest your voice and have some water.</p>
	{#if fieldFor('break')}<p class="note">{fieldFor('break')?.message}</p>{/if}
</section>

<section class="card">
	<h2>Measuring</h2>
	<div class="pair">
		<label for="minHz">Pitch range, from</label>
		<input
			id="minHz"
			type="number"
			inputmode="numeric"
			min={LIMITS.minHz.low}
			max={LIMITS.minHz.high}
			value={values.minHz}
			oninput={(e) => setRequired('minHz', e.currentTarget.value)}
		/>
	</div>
	<div class="pair">
		<label for="maxHz">Pitch range, to</label>
		<input
			id="maxHz"
			type="number"
			inputmode="numeric"
			min={LIMITS.maxHz.low}
			max={LIMITS.maxHz.high}
			value={values.maxHz}
			oninput={(e) => setRequired('maxHz', e.currentTarget.value)}
		/>
	</div>
	<p class="hint">
		The range Warbler listens inside. Narrowing it can help if unrelated sounds keep appearing.
	</p>
	{#if fieldFor('range')}<p class="note">{fieldFor('range')?.message}</p>{/if}
</section>

<section class="card">
	<h2>Display</h2>
	<label class="check">
		<input
			type="checkbox"
			checked={values.showNoteNames}
			onchange={(e) => settings.update({ showNoteNames: e.currentTarget.checked })}
		/>
		Show note names next to Hz
	</label>
</section>

<UpdatePanel />

<section class="card">
	<h2>Tools</h2>
	<p class="muted">Used while Warbler is being set up.</p>
	<a class="button" href="/diagnostics">Diagnostics</a>
</section>

<p class="muted small">Your settings are saved on this device only.</p>

<style>
	.pair {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-top: 0.75rem;
		flex-wrap: wrap;
	}
	.pair label {
		flex: 1 1 12rem;
	}
	.inline {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.to {
		flex: 0 0 auto;
		color: var(--muted);
		font-size: 0.9rem;
	}
	input[type='number'] {
		width: 6.5rem;
		min-height: var(--tap);
		padding: 0.4rem 0.6rem;
		border-radius: var(--radius-small);
		border: 1.5px solid var(--line);
		background: var(--sand);
		color: var(--ink);
		font-family: var(--font);
		font-size: 1rem;
	}
	.slider {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex: 1 1 12rem;
	}
	.slider input {
		flex: 1;
		min-height: var(--tap);
	}
	.slider output {
		font-weight: 600;
		min-width: 3.5rem;
		text-align: right;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 1rem;
		min-height: var(--tap);
	}
	.check input {
		width: 1.35rem;
		height: 1.35rem;
		accent-color: var(--gold);
	}
	.hint {
		color: var(--muted);
		font-size: 0.9rem;
		margin: 0.35rem 0 0;
	}
</style>
