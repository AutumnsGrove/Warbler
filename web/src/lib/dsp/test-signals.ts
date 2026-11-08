/**
 * Test signals: sound with a known answer.
 *
 * These live in the app folder but are only ever imported by tests. They build
 * the sounds described in docs/testing.md, layer 1: pure tones, voice-like
 * buzzes with many harmonics, a voice whose lowest harmonic is weak ("missing
 * fundamental"), glides, vibrato, noise and silence.
 *
 * Everything is deterministic: the same call always gives the same samples, so
 * a failing test can be investigated rather than shrugged at.
 *
 * Note for later phases: the Python validator in tools/validate/ builds its own
 * voices separately, on purpose. If both sides shared this generator, one bug
 * could hide in both and every test would still pass.
 */

/** A small repeatable random number generator (mulberry32). */
export function makeRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function sampleCount(seconds: number, rate: number): number {
	return Math.round(seconds * rate);
}

/** A pure sine tone. */
export function tone(hz: number, seconds: number, rate: number, amplitude = 0.5): Float32Array {
	const n = sampleCount(seconds, rate);
	const out = new Float32Array(n);
	for (let i = 0; i < n; i++) out[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / rate);
	return out;
}

export interface VoiceOptions {
	/** Overall level, 0 to 1. */
	amplitude?: number;
	/** How many harmonics above the fundamental to add. */
	harmonics?: number;
	/** Leave out the fundamental, as a phone microphone sometimes effectively does. */
	missingFundamental?: boolean;
	/** Add random noise at this level, 0 to 1. */
	noise?: number;
	/** Fixed seed so noisy tests are repeatable. */
	seed?: number;
}

/**
 * A voice-like sound: a buzz with many harmonics, like vocal folds, rather than
 * the single frequency of a tuning fork. Harmonic n has amplitude 1/n, which is
 * roughly what a real voice does.
 */
export function voice(hz: number, seconds: number, rate: number, options: VoiceOptions = {}): Float32Array {
	const amplitude = options.amplitude ?? 0.5;
	const harmonics = options.harmonics ?? 12;
	const n = sampleCount(seconds, rate);
	const out = new Float32Array(n);
	const random = makeRandom(options.seed ?? 1);
	let peak = 0;
	for (let i = 0; i < n; i++) {
		const t = i / rate;
		let v = 0;
		for (let k = 1; k <= harmonics; k++) {
			if (k === 1 && options.missingFundamental) continue;
			const weight = k === 1 ? 0.35 : 1 / k;
			v += weight * Math.sin(2 * Math.PI * hz * k * t + k * 0.7);
		}
		out[i] = v;
		peak = Math.max(peak, Math.abs(v));
	}
	const scale = peak > 0 ? amplitude / peak : 0;
	for (let i = 0; i < n; i++) {
		out[i] = out[i] * scale;
		if (options.noise) out[i] += options.noise * (random() * 2 - 1);
	}
	return out;
}

/** Uniform noise with no pitch in it. */
export function noise(seconds: number, rate: number, amplitude = 0.05, seed = 7): Float32Array {
	const random = makeRandom(seed);
	const n = sampleCount(seconds, rate);
	const out = new Float32Array(n);
	for (let i = 0; i < n; i++) out[i] = amplitude * (random() * 2 - 1);
	return out;
}

/** Silence: nothing at all. */
export function silence(seconds: number, rate: number): Float32Array {
	return new Float32Array(sampleCount(seconds, rate));
}

/** A tone whose pitch slides smoothly from one value to another. */
export function glide(fromHz: number, toHz: number, seconds: number, rate: number, amplitude = 0.5): Float32Array {
	const n = sampleCount(seconds, rate);
	const out = new Float32Array(n);
	let phase = 0;
	for (let i = 0; i < n; i++) {
		const progress = i / n;
		const hz = fromHz + (toHz - fromHz) * progress;
		phase += (2 * Math.PI * hz) / rate;
		out[i] = amplitude * Math.sin(phase);
	}
	return out;
}

/** A steady tone with vibrato: the pitch wobbles up and down by about `cents`. */
export function vibrato(hz: number, seconds: number, rate: number, vibratoHz = 5, cents = 50): Float32Array {
	const n = sampleCount(seconds, rate);
	const out = new Float32Array(n);
	let phase = 0;
	for (let i = 0; i < n; i++) {
		const t = i / rate;
		const factor = Math.pow(2, (cents * Math.sin(2 * Math.PI * vibratoHz * t)) / 1200);
		phase += (2 * Math.PI * hz * factor) / rate;
		out[i] = 0.5 * Math.sin(phase);
	}
	return out;
}

/**
 * Place a sound, then a short silence, repeatedly, to imitate a voice that
 * starts and stops. `pattern` alternates milliseconds of sound and of gap.
 */
export function withGaps(samples: Float32Array, rate: number, pattern: number[]): Float32Array {
	const pieces: Float32Array[] = [];
	let sourceAt = 0;
	for (let i = 0; i + 1 < pattern.length; i += 2) {
		const soundLength = Math.round((pattern[i] / 1000) * rate);
		const gapLength = Math.round((pattern[i + 1] / 1000) * rate);
		pieces.push(samples.slice(sourceAt, sourceAt + soundLength));
		pieces.push(silence(gapLength / rate, rate));
		sourceAt += soundLength;
	}
	const total = pieces.reduce((sum, p) => sum + p.length, 0);
	const out = new Float32Array(total);
	let at = 0;
	for (const piece of pieces) {
		out.set(piece, at);
		at += piece.length;
	}
	return out;
}

/**
 * Split a recording into pieces of the given sizes, repeating the pattern.
 * Used to prove that the answer does not depend on how the sound was chopped up.
 */
export function inChunks(samples: Float32Array, sizes: number[]): Float32Array[] {
	const chunks: Float32Array[] = [];
	let at = 0;
	let i = 0;
	while (at < samples.length) {
		const size = Math.max(1, sizes[i % sizes.length]);
		chunks.push(samples.slice(at, at + size));
		at += size;
		i++;
	}
	return chunks;
}
