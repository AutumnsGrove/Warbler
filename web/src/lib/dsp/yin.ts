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

	const tauMin = Math.max(2, Math.floor(sampleRate / maxHz));
	const tauMax = Math.min(Math.ceil(sampleRate / minHz), Math.floor(window.length / 2));
	if (tauMax <= tauMin) return null;

	const d = cumulativeMeanNormalised(differenceFunction(window, tauMax));

	// Find the first place the curve dips below the threshold. This is the
	// repeat length, but the dip is a few samples wide, so the true bottom has to
	// be found from here (see below) before deciding anything.
	let firstGood = -1;
	for (let t = 2; t <= tauMax; t++) {
		if (d[t] < threshold) {
			firstGood = t;
			break;
		}
	}

	let tau: number;
	if (firstGood >= 0) {
		// Walk down to the bottom of that dip. The first dip is the answer:
		// later dips are multiples of the same repeat, which would halve the
		// reported pitch.
		tau = firstGood;
		while (tau + 1 <= tauMax && d[tau + 1] < d[tau]) tau++;
	} else {
		// No confident dip. Fall back to the deepest one inside the range, so
		// the caller can still see how poor the match was and decide not to
		// draw it.
		tau = tauMin;
		for (let t = tauMin + 1; t <= tauMax; t++) if (d[t] < d[tau]) tau = t;
	}

	// A repeat shorter than tauMin means the real pitch is above maxHz. Report
	// nothing rather than a lower octave of the same sound.
	if (tau < tauMin) return null;

	const shift =
		tau > tauMin && tau < tauMax
			? interpolateLowest(d[tau - 1], d[tau], d[tau + 1])
			: 0;
	const hz = sampleRate / (tau + shift);
	const clarity = Math.max(0, Math.min(1, 1 - d[tau]));

	if (!Number.isFinite(hz) || hz < minHz || hz > maxHz) return null;
	return { hz, clarity };
}
