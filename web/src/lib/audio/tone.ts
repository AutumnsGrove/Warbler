/**
 * Known-answer tones, and the reference tone you can listen to.
 *
 * The Self-test screen uses the first half of this file: it makes a tone whose
 * pitch we chose, feeds it through the same analysis code the microphone uses,
 * and shows how close the answer came. That is the only way to prove the
 * measurement works on a real phone without needing a quiet room and a tuner.
 *
 * The reference tone is the second half: a soft sine at the pitch being
 * practised, so you can hear the target instead of guessing at it.
 */

import { PitchTracker } from '../dsp/pitch';

/** A plain sine tone of a chosen pitch and length. */
export function toneSamples(hz: number, seconds: number, sampleRate: number, amplitude = 0.4): Float32Array {
	const count = Math.max(1, Math.round(seconds * sampleRate));
	const out = new Float32Array(count);
	for (let i = 0; i < count; i++) out[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / sampleRate);
	return out;
}

export interface ToneMeasurement {
	/** The pitch that was generated. */
	expected: number;
	/** What the analysis reported, or null when it reported nothing. */
	measured: number | null;
	/** Difference as a percentage of the expected pitch. */
	errorPercent: number | null;
	/** Average confidence across the readings, 0 to 1. */
	clarity: number;
	/** True when a reading came back within the 3% tolerance from docs/testing.md. */
	ok: boolean;
}

/**
 * Generate a tone and measure it with the real analyser.
 *
 * Only confident readings are averaged, and the first 150 ms is skipped: the
 * decimation filter is still settling at the start, which would drag the answer.
 */
export function measureTone(expectedHz: number, sampleRate: number, seconds = 1.5): ToneMeasurement {
	const tracker = new PitchTracker(sampleRate);
	const frames = tracker.push(toneSamples(expectedHz, seconds, sampleRate));
	const settled = frames.filter((frame) => frame.at > 0.15);
	const voiced = settled.filter((frame) => frame.voiced && frame.hz !== null);
	if (voiced.length === 0) {
		return { expected: expectedHz, measured: null, errorPercent: null, clarity: 0, ok: false };
	}
	const meanHz = voiced.reduce((sum, frame) => sum + (frame.hz as number), 0) / voiced.length;
	const meanClarity = voiced.reduce((sum, frame) => sum + frame.clarity, 0) / voiced.length;
	const errorPercent = ((meanHz - expectedHz) / expectedHz) * 100;
	return {
		expected: expectedHz,
		measured: meanHz,
		errorPercent,
		clarity: meanClarity,
		ok: Math.abs(errorPercent) <= 3
	};
}

/** The pitches the Self-test screen checks: typical speaking and singing ranges. */
export const SELF_TEST_PITCHES = [110, 147, 196, 262, 330, 440] as const;

/** A few words about a result, without blame or alarm. */
export function describeMeasurement(m: ToneMeasurement): string {
	if (m.measured === null) return 'Nothing measured';
	if (Math.abs(m.errorPercent ?? 0) < 0.5) return 'Spot on';
	const direction = (m.errorPercent ?? 0) > 0 ? 'above' : 'below';
	return `${Math.abs(m.errorPercent ?? 0).toFixed(1)}% ${direction} the true pitch`;
}
