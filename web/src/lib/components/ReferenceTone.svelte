<script lang="ts">
	/**
	 * The reference tone: a soft sine at the pitch being practised, so you can
	 * hear the goal instead of guessing at it.
	 *
	 * Started inside the tap handler and faded in and out over a few
	 * hundredths of a second, because a tone that begins mid-wave clicks, and
	 * because iOS only allows sound to start from a tap.
	 */
	import { onDestroy } from 'svelte';

	interface Props {
		/** Pitch to play, in Hz. */
		hz: number;
	}

	let { hz }: Props = $props();

	let playing = $state(false);
	let context: AudioContext | null = null;
	let oscillator: OscillatorNode | null = null;
	let volume: GainNode | null = null;

	// Quiet on purpose: this is a reference, not a performance.
	const LEVEL = 0.12;

	async function toggle(): Promise<void> {
		if (playing) {
			stop();
			return;
		}
		const Ctor =
			window.AudioContext ??
			(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		context ??= new Ctor();
		await context.resume();
		const now = context.currentTime;
		const gain = context.createGain();
		gain.gain.setValueAtTime(0.0001, now);
		gain.gain.exponentialRampToValueAtTime(LEVEL, now + 0.03);
		const tone = context.createOscillator();
		tone.type = 'sine';
		tone.frequency.value = hz;
		tone.connect(gain);
		gain.connect(context.destination);
		tone.start();
		oscillator = tone;
		volume = gain;
		playing = true;
	}

	function stop(): void {
		if (!context || !volume || !oscillator) return;
		const now = context.currentTime;
		const gain = volume;
		const tone = oscillator;
		gain.gain.cancelScheduledValues(now);
		gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
		tone.stop(now + 0.1);
		tone.onended = () => tone.disconnect();
		oscillator = null;
		volume = null;
		playing = false;
	}

	onDestroy(() => {
		stop();
		void context?.close().catch(() => {});
		context = null;
	});
</script>

<button onclick={toggle} aria-pressed={playing}>
	{playing ? 'Stop the tone' : `Hear ${Math.round(hz)} Hz`}
</button>

<style>
	button {
		width: 100%;
	}
</style>
