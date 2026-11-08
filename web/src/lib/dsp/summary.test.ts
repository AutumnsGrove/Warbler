import { describe, expect, it } from 'vitest';
import { MIN_HALF_WIDTH, describeSummary, suggestZone, summarisePitch, voicedFrequencies } from './summary';

describe('summarisePitch', () => {
	it('refuses to say anything from too little sound', () => {
		expect(summarisePitch([])).toBeNull();
		expect(summarisePitch([100, 101, 102])).toBeNull();
	});

	it('reports the middle reading', () => {
		const values = Array.from({ length: 101 }, (_, i) => 100 + i); // 100 to 200
		const summary = summarisePitch(values);
		expect(summary).not.toBeNull();
		expect(summary!.median).toBeCloseTo(150, 0);
	});

	it('ignores impossible readings rather than averaging them in', () => {
		const summary = summarisePitch([100, 0, -5, Number.NaN, 102, 98, 101, 99, 100, 103, 97, 100]);
		expect(summary?.count).toBe(9);
		expect(summary!.median).toBeGreaterThan(95);
		expect(summary!.median).toBeLessThan(105);
	});

	it('keeps one wild frame from stretching the range', () => {
		const values = [150, 151, 149, 152, 148, 150, 900, 151, 149, 150, 152, 148];
		const summary = summarisePitch(values)!;
		expect(summary.p90).toBeLessThan(200);
	});
});

describe('suggestZone', () => {
	it('suggests a zone around the middle, never thinner than the minimum', () => {
		const summary = summarisePitch([150, 150, 150, 150, 151, 150, 149, 150, 150, 150])!;
		const zone = suggestZone(summary)!;
		expect(zone.low).toBe(150 - MIN_HALF_WIDTH);
		expect(zone.high).toBe(150 + MIN_HALF_WIDTH);
	});

	it('uses the spread when the voice moves around a lot', () => {
		const values = Array.from({ length: 100 }, (_, i) => 120 + i); // 120 to 219
		const zone = suggestZone(summarisePitch(values)!)!;
		expect(zone.high - zone.low).toBeGreaterThan(2 * MIN_HALF_WIDTH);
	});

	it('suggests nothing from nothing', () => {
		expect(suggestZone(null)).toBeNull();
	});

	it('never suggests a zone that reaches zero or below', () => {
		const zone = suggestZone({ count: 20, median: 3, p10: 2, p90: 4, seconds: 1 })!;
		expect(zone.low).toBeGreaterThan(0);
	});
});

describe('describeSummary', () => {
	it('gives a plain sentence when there is a result', () => {
		const summary = { count: 40, median: 176, p10: 165, p90: 187, seconds: 6 };
		expect(describeSummary(summary, 'F3')).toBe('Your voice sits around 176 Hz (F3).');
	});

	it('asks for another try without blame when there is not', () => {
		const text = describeSummary(null, '');
		expect(text).toContain('Try again');
		expect(text.toLowerCase()).not.toContain('fail');
	});
});

describe('voicedFrequencies', () => {
	it('takes only confident readings', () => {
		const frames = [
			{ at: 0, hz: 150, clarity: 0.9, rms: 0.1, voiced: true },
			{ at: 0.015, hz: null, clarity: 0, rms: 0.001, voiced: false },
			{ at: 0.03, hz: 152, clarity: 0.8, rms: 0.1, voiced: true }
		];
		expect(voicedFrequencies(frames)).toEqual([150, 152]);
	});
});
