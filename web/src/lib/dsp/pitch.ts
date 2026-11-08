/**
 * Turning the microphone stream into pitch readings.
 *
 * This glues the three pure pieces together:
 *   1. decimate.ts drops the sample rate to about 12 kHz,
 *   2. framer.ts cuts the stream into overlapping windows,
 *   3. yin.ts finds the pitch of each window.
 *
 * It also decides when to say nothing. A reading is marked `voiced: false` when
 * the sound is too quiet or the match is too poor; the screen leaves a gap there
 * rather than drawing a doubtful number (PLAN.md: never plot low-confidence
 * values).
 *
 * The class holds state for one session. It is plain TypeScript with no browser
 * objects, so vitest can feed it the same recording in different chunk sizes and
 * check the output is identical.
 */

import { ANALYSIS_RATE, Decimator } from './decimate';
import { Framer } from './framer';
import { rmsOf, yin, type YinOptions } from './yin';

/** Length of sound examined per reading: long enough to hold a 70 Hz repeat. */
export const WINDOW_MS = 45;
/** How far the window moves between readings. */
export const HOP_MS = 15;
/** Quieter than this counts as silence (about -48 dB, well below speech). */
export const SILENCE_RMS = 0.004;
/** Below this match quality the reading is not trusted. */
export const MIN_CLARITY = 0.6;

/**
 * Median of a list of numbers. Used by the display smoother below.
 */
export function median(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * Smooth a series of pitch readings for display, the way PLAN.md asks for:
 * a 3 to 5 frame median, while the stored numbers stay unsmoothed. A median is
 * used rather than an average so a single wild reading is ignored instead of
 * dragging the line up or down.
 *
 * Nulls (unconfident frames) are returned as null, and smoothing stops at a gap
 * rather than reaching across it. A gap in the sound stays a gap on the screen,
 * and a reading just before a gap is not averaged with a reading just after it.
 */
export function medianSmooth(hz: (number | null)[], width = 5): (number | null)[] {
	if (width < 1) return [...hz];
	const half = Math.floor(width / 2);
	return hz.map((value, i) => {
		if (value === null) return null;
		const run: number[] = [value];
		for (let j = i - 1; j >= Math.max(0, i - half); j--) {
			const v = hz[j];
			if (v === null) break;
			run.push(v);
		}
		for (let j = i + 1; j <= Math.min(hz.length - 1, i + half); j++) {
			const v = hz[j];
			if (v === null) break;
			run.push(v);
		}
		return median(run);
	});
}

export interface PitchFrame {
	/** When the window started, in seconds since the tracker was created. */
	at: number;
	/** Pitch in Hz, or null when nothing confident was found. */
	hz: number | null;
	/** 0 to 1 match quality. Low numbers explain a missing reading. */
	clarity: number;
	/** Level of the window, 0 to 1. */
	rms: number;
	/** True when a pitch is shown. False means "leave a gap". */
	voiced: boolean;
}

export interface PitchTrackerOptions extends YinOptions {
	/** Override the sample rate of analysis (mainly for tests). */
	analysisRate?: number;
}

export class PitchTracker {
	readonly analysisRate: number;
	private readonly hopSize: number;
	private readonly decimator: Decimator;
	private readonly framer: Framer;
	private readonly options: YinOptions;
	private framesSeen = 0;

	constructor(sampleRate: number, options: PitchTrackerOptions = {}) {
		this.decimator = new Decimator(sampleRate, options.analysisRate ?? ANALYSIS_RATE);
		this.analysisRate = this.decimator.rate;
		this.hopSize = Math.max(1, Math.round((HOP_MS / 1000) * this.analysisRate));
		this.framer = new Framer({
			windowSize: Math.round((WINDOW_MS / 1000) * this.analysisRate),
			hopSize: this.hopSize
		});
		this.options = {
			minHz: options.minHz,
			maxHz: options.maxHz,
			threshold: options.threshold
		};
	}

	/** Feed raw microphone samples. Returns one reading per completed window. */
	push(chunk: Float32Array): PitchFrame[] {
		const quiet = this.decimator.push(chunk);
		if (quiet.length === 0) return [];
		return this.framer.push(quiet).map((window) => this.analyse(window));
	}

	/** Forget the sound so far, for a fresh session. */
	reset(): void {
		this.decimator.reset();
		this.framer.reset();
		this.framesSeen = 0;
	}

	private analyse(window: Float32Array): PitchFrame {
		const rms = rmsOf(window);
		const at = (this.framesSeen * this.hopSize) / this.analysisRate;
		this.framesSeen++;
		if (rms < SILENCE_RMS) {
			return { at, hz: null, clarity: 0, rms, voiced: false };
		}
		const found = yin(window, this.analysisRate, this.options);
		if (!found || found.clarity < MIN_CLARITY) {
			return { at, hz: null, clarity: found?.clarity ?? 0, rms, voiced: false };
		}
		return { at, hz: found.hz, clarity: found.clarity, rms, voiced: true };
	}
}
