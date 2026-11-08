/**
 * YIN: finding the pitch of one short window of sound.
 *
 * The idea in plain language: if a sound repeats 150 times a second, then
 * shifting the window by one repeat length (1/150 of a second) makes it line up
 * with itself. YIN slides a copy of the window past the original and measures,
 * for every shift, how badly the two disagree. The shift with the best match is
 * the repeat length, and pitch is one divided by that.
 *
 * YIN is used instead of the simpler "count the zero crossings" tricks because
 * it copes with real voices, where the lowest harmonic can be weak and the
 * sound is never a pure tone.
 *
 * Everything here is a pure function: no browser objects, no state between
 * calls, so the same input always gives the same answer and vitest can check it.
 */

export interface YinOptions {
	/** Lowest pitch to look for, in Hz. */
	minHz?: number;
	/** Highest pitch to look for, in Hz. */
	maxHz?: number;
	/**
	 * How good a match must be before YIN accepts it (the "absolute threshold").
	 * Lower is stricter. 0.15 is the usual choice and the value in PLAN.md.
	 */
	threshold?: number;
}

export interface YinResult {
	/** The pitch found, in Hz. */
	hz: number;
	/** 0 to 1: how well the window matched itself at that shift. Higher is surer. */
	clarity: number;
}

export const DEFAULT_MIN_HZ = 70;
export const DEFAULT_MAX_HZ = 500;
export const DEFAULT_THRESHOLD = 0.15;

/** Root-mean-square level of a window, 0 to 1 for sound down to full scale. */
export function rmsOf(window: Float32Array): number {
	let sum = 0;
	for (let i = 0; i < window.length; i++) sum += window[i] * window[i];
	return window.length > 0 ? Math.sqrt(sum / window.length) : 0;
}

/**
 * The difference function: how badly the window disagrees with itself when
 * shifted by `tau` samples. Small values mean a good match.
 */
export function differenceFunction(window: Float32Array, maxTau: number): Float32Array {
	const d = new Float32Array(maxTau + 1);
	for (let tau = 1; tau <= maxTau; tau++) {
		let sum = 0;
		const end = window.length - tau;
		for (let j = 0; j < end; j++) {
			const delta = window[j] - window[j + tau];
			sum += delta * delta;
		}
		d[tau] = sum;
	}
	return d;
}

/**
 * The cumulative mean normalised difference: the same idea as above, but each
 * value is divided by the average so far. This is what makes YIN ignore
 * loudness and stop itself from always picking the very first shift.
 */
export function cumulativeMeanNormalised(d: Float32Array): Float32Array {
	const out = new Float32Array(d.length);
	out[0] = 1;
	let running = 0;
	for (let tau = 1; tau < d.length; tau++) {
		running += d[tau];
		out[tau] = running > 0 ? (d[tau] * tau) / running : 1;
	}
	return out;
}

/** Fit a curve through three points and return where its lowest point sits. */
function interpolateLowest(left: number, middle: number, right: number): number {
	const denominator = 2 * (2 * middle - right - left);
	if (denominator === 0) return 0;
	const shift = (right - left) / denominator;
	// A shift of more than one sample means the three points do not describe a
	// dip; trust the middle point instead of extrapolating wildly.
	return Math.abs(shift) <= 1 ? shift : 0;
}

/**
 * Find the pitch of one window.
 *
 * Returns null when the window is too short to hold a repeat of the lowest
 * pitch, when the answer would fall outside the search range, or when the match
 * is not good enough. Never returns a made-up number.
 */
export function yin(
	window: Float32Array,
	sampleRate: number,
	options: YinOptions = {}
): YinResult | null {
	const minHz = options.minHz ?? DEFAULT_MIN_HZ;
	const maxHz = options.maxHz ?? DEFAULT_MAX_HZ;
	const threshold = options.threshold ?? DEFAULT_THRESHOLD;
	if (!(sampleRate > 0) || window.length === 0 || minHz <= 0 || maxHz <= minHz) return null;

	// Search the whole range the window can hold, not just the user's range, then
	// decide at the end whether the answer lies inside it. A shorter search would
	// quietly report a ripple or a harmonic when the real pitch sits just outside
	// the requested range.
	const tauMin = Math.max(2, Math.floor(sampleRate / maxHz));
	const tauMax = Math.floor(window.length / 2);
	if (tauMax <= tauMin) return null;

	const d = cumulativeMeanNormalised(differenceFunction(window, tauMax));

	// The deepest match anywhere is the best guess at the repeat length.
	let best = 2;
	for (let t = 3; t <= tauMax; t++) if (d[t] < d[best]) best = t;

	// Take the earliest dip that is nearly as good as the deepest one. "Nearly as
	// good" matters: a voice with a strong resonance can ripple, and a shallow
	// ripple must not be mistaken for the repeat length just because it comes
	// first. An early repeat is still preferred over a later one, which is what
	// stops the answer being halved.
	const limit = Math.min(threshold, d[best] + 0.05);
	let tau = -1;
	for (let t = 2; t < tauMax; t++) {
		if (d[t] <= limit && d[t] <= d[t - 1] && d[t] <= d[t + 1]) {
			tau = t;
			break;
		}
	}
	if (tau < 0) tau = best;

	const shift = tau > 1 && tau < tauMax ? interpolateLowest(d[tau - 1], d[tau], d[tau + 1]) : 0;
	const found = sampleRate / (tau + shift);
	const clarity = Math.max(0, Math.min(1, 1 - d[tau]));
	if (!Number.isFinite(found)) return null;

	// A tiny overshoot at the edge of the range (70 Hz at a 70 Hz floor, say) is
	// interpolation, not a different pitch: bring it back inside. Anything
	// further out is genuinely outside what was asked for, so say nothing.
	const edge = 0.01;
	if (found < minHz) return found >= minHz * (1 - edge) ? { hz: minHz, clarity } : null;
	if (found > maxHz) return found <= maxHz * (1 + edge) ? { hz: maxHz, clarity } : null;
	return { hz: found, clarity };
}
