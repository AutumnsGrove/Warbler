import { describe, expect, it } from 'vitest';
import { SELF_TEST_PITCHES, describeMeasurement, measureTone, toneSamples } from './tone';

describe('toneSamples', () => {
	it('makes the right number of samples', () => {
		expect(toneSamples(200, 0.5, 8000)).toHaveLength(4000);
	});
	it('stays inside the chosen amplitude', () => {
		const samples = toneSamples(200, 0.1, 8000, 0.3);
		for (const sample of samples) expect(Math.abs(sample)).toBeLessThanOrEqual(0.3001);
	});
	it('makes a tone that repeats at the right rate', () => {
		// A 500 Hz tone at 8 kHz repeats every 16 samples.
		const samples = toneSamples(500, 0.02, 8000, 1);
		expect(samples[0]).toBeCloseTo(samples[16], 6);
	});
});

describe('measureTone', () => {
	it('finds the pitch it was told to make, at the phone rates', () => {
		for (const rate of [44_100, 48_000]) {
			const result = measureTone(220, rate);
			expect(result.measured).not.toBeNull();
			expect(Math.abs(result.errorPercent ?? 99)).toBeLessThan(1);
			expect(result.ok).toBe(true);
		}
	});

	it('passes every pitch on the self-test list', () => {
		for (const hz of SELF_TEST_PITCHES) {
			const result = measureTone(hz, 48_000);
			expect(result.measured).not.toBeNull();
			expect(result.ok).toBe(true);
		}
	});

	it('reports high confidence for a clean tone', () => {
		expect(measureTone(196, 48_000).clarity).toBeGreaterThan(0.9);
	});

	it('says nothing measured rather than a silly number when there is no pitch', () => {
		const result = measureTone(20, 48_000, 0.5);
		expect(result.measured === null || result.ok === false).toBe(true);
	});
});

describe('describeMeasurement', () => {
	it('says when a result is spot on', () => {
		expect(
			describeMeasurement({ expected: 220, measured: 220.1, errorPercent: 0.05, clarity: 1, ok: true })
		).toBe('Spot on');
	});
	it('describes the direction without blame', () => {
		const text = describeMeasurement({
			expected: 220,
			measured: 222.2,
			errorPercent: 1,
			clarity: 1,
			ok: true
		});
		expect(text).toContain('above');
		expect(text.toLowerCase()).not.toContain('fail');
	});
	it('handles no reading', () => {
		expect(
			describeMeasurement({ expected: 220, measured: null, errorPercent: null, clarity: 0, ok: false })
		).toBe('Nothing measured');
	});
});
