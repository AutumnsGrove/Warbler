/**
 * Making the sample rate smaller before pitch analysis.
 *
 * The microphone gives us 44,100 or 48,000 samples a second. Pitch analysis
 * only cares about sound up to about 500 Hz, so most of that detail is wasted
 * work, especially on a phone. Two steps fix that:
 *
 * 1. Filter out everything above the new top frequency, so higher sounds
 *    cannot fold down and pretend to be low ones. This is a low-pass filter.
 * 2. Keep only every Nth sample, where N is a whole number, so the new rate
 *    stays an exact division of the old one. 48,000 becomes 12,000.
 *
 * The rule from PLAN.md: never assume the rate. The factor is worked out from
 * whatever rate the phone actually reports.
 */

/** The rate pitch analysis runs at, in samples per second. */
export const ANALYSIS_RATE = 12_000;

/** How many input samples to drop for each output sample (at least one). */
export function decimationFactor(sampleRate: number, targetRate = ANALYSIS_RATE): number {
	if (!(sampleRate > 0) || !Number.isFinite(sampleRate)) {
		throw new Error('sample rate must be a positive number');
	}
	return Math.max(1, Math.round(sampleRate / targetRate));
}

export interface BiquadCoefficients {
	b0: number;
	b1: number;
	b2: number;
	a1: number;
	a2: number;
}

/**
 * Coefficients for a second-order low-pass filter (the standard "RBJ cookbook"
 * recipe, quality factor 0.7071 gives the flattest passband).
 */
export function lowPassCoefficients(
	sampleRate: number,
	cutoffHz: number,
	q = Math.SQRT1_2
): BiquadCoefficients {
	const w0 = (2 * Math.PI * cutoffHz) / sampleRate;
	const cos = Math.cos(w0);
	const alpha = Math.sin(w0) / (2 * q);
	const a0 = 1 + alpha;
	return {
		b0: ((1 - cos) / 2) / a0,
		b1: (1 - cos) / a0,
		b2: ((1 - cos) / 2) / a0,
		a1: (-2 * cos) / a0,
		a2: (1 - alpha) / a0
	};
}

/**
 * Turns a stream at the phone's rate into a stream at about ANALYSIS_RATE.
 *
 * State is kept between calls, so it does not matter how the input is chopped
 * into pieces: the output is the same. That is tested in decimate.test.ts.
 *
 * Two identical low-pass stages are used in a row (a fourth-order filter).
 * One stage on its own lets too much of a high whistle through, and at the new
 * lower rate a high whistle folds down into the pitch range and can fool the
 * detector. The two quality factors below are the standard Butterworth pair.
 */
export class Decimator {
	readonly factor: number;
	readonly rate: number;
	private readonly stages: BiquadCoefficients[];
	/** Filter memory for each stage: two previous inputs and outputs. */
	private readonly state = [
		{ x1: 0, x2: 0, y1: 0, y2: 0 },
		{ x1: 0, x2: 0, y1: 0, y2: 0 }
	];
	/** How many input samples have been seen, to pick every factor-th one. */
	private seen = 0;

	constructor(sampleRate: number, targetRate = ANALYSIS_RATE) {
		this.factor = decimationFactor(sampleRate, targetRate);
		this.rate = sampleRate / this.factor;
		// Just under half the new rate: the highest frequency that can be
		// represented without aliasing, with a little room for the filter's slope.
		const cutoff = Math.min(0.45 * this.rate, 0.45 * sampleRate);
		this.stages = [
			lowPassCoefficients(sampleRate, cutoff, 1 / (2 * Math.cos(Math.PI / 8))),
			lowPassCoefficients(sampleRate, cutoff, 1 / (2 * Math.cos((3 * Math.PI) / 8)))
		];
	}

	/** Filter and drop samples. Returns the new, shorter array. */
	push(chunk: Float32Array): Float32Array {
		const out = new Float32Array(Math.ceil(chunk.length / this.factor));
		let count = 0;
		for (let i = 0; i < chunk.length; i++) {
			let v = chunk[i];
			for (let s = 0; s < this.stages.length; s++) {
				const { b0, b1, b2, a1, a2 } = this.stages[s];
				const memory = this.state[s];
				const y = b0 * v + b1 * memory.x1 + b2 * memory.x2 - a1 * memory.y1 - a2 * memory.y2;
				memory.x2 = memory.x1;
				memory.x1 = v;
				memory.y2 = memory.y1;
				memory.y1 = y;
				v = y;
			}
			if (this.seen % this.factor === 0) out[count++] = v;
			this.seen++;
		}
		return out.subarray(0, count);
	}

	reset(): void {
		for (const memory of this.state) {
			memory.x1 = 0;
			memory.x2 = 0;
			memory.y1 = 0;
			memory.y2 = 0;
		}
		this.seen = 0;
	}
}
