import { describe, expect, it } from 'vitest';
import { ANALYSIS_RATE, Decimator, decimationFactor } from './decimate';
import { inChunks, tone } from './test-signals';

/** Energy of a signal, ignoring the start where the filter is still settling. */
function energy(samples: Float32Array, skip = 0): number {
	let sum = 0;
	for (let i = skip; i < samples.length; i++) sum += samples[i] * samples[i];
	return sum / Math.max(1, samples.length - skip);
}

describe('decimationFactor', () => {
	it('picks whole factors that land near 12 kHz', () => {
		expect(decimationFactor(48_000)).toBe(4);
		expect(decimationFactor(44_100)).toBe(4);
		expect(decimationFactor(96_000)).toBe(8);
		expect(decimationFactor(24_000)).toBe(2);
	});

	it('never decimates below the analysis rate', () => {
		expect(decimationFactor(12_000)).toBe(1);
		expect(decimationFactor(8_000)).toBe(1);
	});

	it('refuses an impossible rate', () => {
		expect(() => decimationFactor(0)).toThrow();
		expect(() => decimationFactor(Number.NaN)).toThrow();
	});
});

describe('Decimator', () => {
	it('reports the real rate it produces, near the analysis rate', () => {
		expect(new Decimator(48_000).rate).toBe(12_000);
		expect(new Decimator(44_100).rate).toBe(11_025);
		expect(Math.abs(new Decimator(44_100).rate - ANALYSIS_RATE) / ANALYSIS_RATE).toBeLessThan(0.1);
	});

	it('produces one sample per factor', () => {
		const decimator = new Decimator(48_000);
		const out = decimator.push(new Float32Array(4800));
		expect(out).toHaveLength(1200);
	});

	it('gives an identical result however the sound is chopped up', () => {
		const sound = tone(200, 0.5, 48_000);
		const whole = Array.from(new Decimator(48_000).push(sound));

		for (const sizes of [[1], [127], [129], [128], [1, 127, 129, 3], [61, 400, 7]]) {
			const decimator = new Decimator(48_000);
			const pieces = inChunks(sound, sizes).flatMap((chunk) => Array.from(decimator.push(chunk)));
			expect(pieces).toEqual(whole);
		}
	});

	it('keeps a pitch we care about and its level', () => {
		const sound = tone(200, 0.5, 48_000, 0.5);
		const out = new Decimator(48_000).push(sound);
		// A 200 Hz tone is far below the new top frequency, so it should pass
		// through at almost the same size (a sine of amplitude 0.5 has energy 0.125).
		expect(energy(out, 200)).toBeCloseTo(0.125, 1);
	});

	it('stops high sounds from folding down and pretending to be low', () => {
		// A 10 kHz tone cannot be represented at 12 kHz. Without the filter it
		// would appear as a 2 kHz tone, which pitch detection might trust. With
		// the filter it should be almost gone.
		const high = tone(10_000, 0.2, 48_000, 0.5);
		const out = new Decimator(48_000).push(high);
		expect(energy(out, 200)).toBeLessThan(energy(tone(10_000, 0.2, 48_000, 0.5), 0) * 0.01);
	});

	it('forgets the past after a reset', () => {
		const decimator = new Decimator(48_000);
		decimator.push(tone(200, 0.1, 48_000));
		decimator.reset();
		const fresh = decimator.push(new Float32Array(4));
		expect(Array.from(fresh)).toEqual([0]);
	});
});
