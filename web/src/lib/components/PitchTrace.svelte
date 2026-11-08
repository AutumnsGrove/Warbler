<script lang="ts">
	/**
	 * The scrolling pitch trace.
	 *
	 * What it shows, and why:
	 * - The line is your pitch over the last few seconds, newest at the right.
	 * - A gap in the line means "not confident enough to draw". The app never
	 *   guesses, so a pause in speaking looks like a pause (docs/screens.md).
	 * - The shaded bands are the practice zone (the ramped one, never the final
	 *   target) and where your voice started.
	 * - Pitch is drawn on a spacing of equal musical steps, not equal Hz, so the
	 *   shape of a melody looks like it sounds.
	 *
	 * Nothing here decides anything: it draws what it is given.
	 */
	import type { PitchFrame } from '../dsp/pitch';
	import type { Zone } from '../dsp/zones';

	interface Props {
		frames: PitchFrame[];
		/** The zone being practised, already ramped. Null hides the band. */
		zone?: Zone | null;
		/** Where the voice started, drawn as a quieter band. */
		startZone?: Zone | null;
		/** How many seconds the window shows. */
		seconds?: number;
		/** Lowest and highest pitch to show, in Hz. */
		viewLow?: number;
		viewHigh?: number;
	}

	let { frames, zone = null, startZone = null, seconds = 10, viewLow = 70, viewHigh = 500 }: Props = $props();

	let canvas: HTMLCanvasElement | null = null;
	let width = $state(0);
	let height = 220;

	/** Equal musical steps: one octave takes the same vertical space anywhere. */
	function logPosition(hz: number): number {
		return Math.log2(hz);
	}

	const top = $derived(logPosition(viewHigh));
	const bottom = $derived(logPosition(viewLow));

	function yFor(hz: number): number {
		const span = top - bottom;
		if (!(span > 0)) return height / 2;
		const t = (logPosition(hz) - bottom) / span;
		return height - Math.min(1, Math.max(0, t)) * height;
	}

	function band(g: CanvasRenderingContext2D, from: Zone, colour: string) {
		const y1 = yFor(Math.min(from.high, viewHigh));
		const y2 = yFor(Math.max(from.low, viewLow));
		g.fillStyle = colour;
		g.fillRect(0, y1, width, Math.max(2, y2 - y1));
	}

	function draw() {
		if (!canvas || width === 0) return;
		const context = canvas.getContext('2d');
		if (!context) return;
		const ratio = window.devicePixelRatio || 1;
		if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
			canvas.width = Math.round(width * ratio);
			canvas.height = Math.round(height * ratio);
		}
		const g = context;
		g.setTransform(ratio, 0, 0, ratio, 0, 0);
		g.clearRect(0, 0, width, height);

		const styles = getComputedStyle(canvas);
		const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
		const lineColour = read('--line', '#3f3527');
		const mutedColour = read('--muted', '#b8a98f');
		const goldColour = read('--gold', '#f0c030');
		const goldSoft = read('--gold-soft', '#5a4a17');
		const oliveColour = read('--olive', '#c3d078');

		// The bands sit behind everything else.
		if (startZone) band(g, startZone, lineColour);
		if (zone) band(g, zone, goldSoft);

		// Faint lines at whole octaves, so the eye can judge rise and fall.
		g.strokeStyle = lineColour;
		g.lineWidth = 1;
		g.font = '11px ' + read('--font', 'sans-serif');
		g.fillStyle = mutedColour;
		for (let hz = 2 ** Math.ceil(bottom); hz <= viewHigh; hz *= 2) {
			if (yFor(hz) < 0 || yFor(hz) > height) continue;
			const y = Math.round(yFor(hz)) + 0.5;
			g.beginPath();
			g.moveTo(0, y);
			g.lineTo(width, y);
			g.stroke();
			g.fillText(`${Math.round(hz)}`, 4, y - 4);
		}

		// The trace itself, newest sample at the right edge.
		const newest = frames.length > 0 ? frames[frames.length - 1].at : 0;
		const oldest = newest - seconds;
		const xFor = (at: number) => ((at - oldest) / seconds) * width;
		let previous: { x: number; y: number } | null = null;
		let drawing = false;
		for (const frame of frames) {
			if (frame.hz === null || !frame.voiced) {
				drawing = false;
				continue;
			}
			const point = { x: xFor(frame.at), y: yFor(frame.hz) };
			if (point.x < 0 || point.x > width) {
				previous = null;
				drawing = false;
				continue;
			}
			if (drawing && previous) {
				g.strokeStyle = goldColour;
				g.lineWidth = 2.5;
				g.lineJoin = 'round';
				g.beginPath();
				g.moveTo(previous.x, previous.y);
				g.lineTo(point.x, point.y);
				g.stroke();
			}
			previous = point;
			drawing = true;
		}

		// A dot on the newest confident reading, so the eye has somewhere to land.
		for (let i = frames.length - 1; i >= 0; i--) {
			const frame = frames[i];
			if (frame.hz === null || !frame.voiced) break;
			g.fillStyle = oliveColour;
			g.beginPath();
			g.arc(xFor(frame.at), yFor(frame.hz), 3.5, 0, Math.PI * 2);
			g.fill();
			break;
		}
	}

	$effect(() => {
		// Reading frames and width here makes the effect re-run when either changes.
		void frames;
		void width;
		void zone;
		void startZone;
		draw();
	});

	$effect(() => {
		if (!canvas) return;
		const observer = new ResizeObserver((entries) => {
			width = Math.round(entries[0].contentRect.width);
		});
		observer.observe(canvas);
		return () => observer.disconnect();
	});
</script>

<div class="wrap">
	<canvas bind:this={canvas} aria-hidden="true"></canvas>
	<p class="sr-only">
		The pitch trace is a picture of your recent pitch. The number below the graph gives the same
		information in Hz.
	</p>
</div>

<style>
	.wrap {
		position: relative;
		width: 100%;
		height: 220px;
		border: 1px solid var(--line);
		border-radius: var(--radius-small);
		overflow: hidden;
		background: var(--paper);
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
