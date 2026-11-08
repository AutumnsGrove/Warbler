import { describe, expect, it } from 'vitest';
import {
	DEFAULT_RAMP_PERCENT,
	clampRampPercent,
	describeDistance,
	distanceToZone,
	isValidZone,
	rampedZone
} from './zones';

const start = { low: 110, high: 140 };
const target = { low: 190, high: 230 };

describe('rampedZone', () => {
	it('starts at the starting zone when the ramp is zero', () => {
		expect(rampedZone(start, target, 0)).toEqual(start);
	});

	it('reaches the target zone only at 100 percent', () => {
		const at100 = rampedZone(start, target, 100);
		expect((at100.low + at100.high) / 2).toBeCloseTo(210, 5);
		expect(at100.high - at100.low).toBeCloseTo(30, 5);
	});

	it('sits a quarter of the way up by default', () => {
		// Starting centre 125 Hz, goal centre 210 Hz, so a quarter of the 85 Hz
		// journey is 21.25 Hz: 146.25 Hz.
		const quarter = rampedZone(start, target, DEFAULT_RAMP_PERCENT);
		expect((quarter.low + quarter.high) / 2).toBeCloseTo(146.25, 5);
	});

	it('keeps the starting width, so the band never gets tighter than practice', () => {
		for (const percent of [0, 25, 50, 75, 100]) {
			const zone = rampedZone(start, target, percent);
			expect(zone.high - zone.low).toBeCloseTo(30, 5);
		}
	});

	it('works downwards too, without turning the zone upside down', () => {
		const lower = rampedZone({ low: 220, high: 250 }, { low: 150, high: 180 }, 50);
		expect(lower.low).toBeLessThan(lower.high);
		expect((lower.low + lower.high) / 2).toBeCloseTo(200, 5);
	});
});

describe('clampRampPercent', () => {
	it('allows zero and one hundred, because the user may choose them', () => {
		expect(clampRampPercent(0)).toBe(0);
		expect(clampRampPercent(100)).toBe(100);
	});

	it('keeps anything outside the range inside it', () => {
		expect(clampRampPercent(-20)).toBe(0);
		expect(clampRampPercent(850)).toBe(100);
		expect(clampRampPercent(Number.NaN)).toBe(DEFAULT_RAMP_PERCENT);
	});

	it('rounds to whole percent', () => {
		expect(clampRampPercent(24.6)).toBe(25);
	});
});

describe('isValidZone', () => {
	it('accepts a sensible zone', () => {
		expect(isValidZone(start)).toBe(true);
	});
	it('rejects nothing, silly numbers, and upside-down zones', () => {
		expect(isValidZone(null)).toBe(false);
		expect(isValidZone(undefined)).toBe(false);
		expect(isValidZone({ low: 0, high: 100 })).toBe(false);
		expect(isValidZone({ low: Number.NaN, high: 100 })).toBe(false);
		expect(isValidZone({ low: 200, high: 100 })).toBe(false);
	});
});

describe('distanceToZone', () => {
	it('says nothing is wrong when the pitch is inside', () => {
		expect(distanceToZone(120, start)).toEqual({ direction: 'inside', hz: 0 });
	});
	it('measures to the nearest edge', () => {
		expect(distanceToZone(100, start)).toEqual({ direction: 'below', hz: 10 });
		expect(distanceToZone(150, start)).toEqual({ direction: 'above', hz: 10 });
	});
});

describe('describeDistance', () => {
	it('describes where the pitch is, without judging it', () => {
		expect(describeDistance(96, start)).toBe('14 Hz below your goal zone.');
		expect(describeDistance(152, start)).toBe('12 Hz above your goal zone.');
		expect(describeDistance(120, start)).toBe('In your zone.');
	});

	it('uses the zone name it is given', () => {
		expect(describeDistance(96, start, 'your practice zone')).toBe('14 Hz below your practice zone.');
	});

	it('says nothing when there is no pitch or no zone', () => {
		expect(describeDistance(null, start)).toBeNull();
		expect(describeDistance(100, null)).toBeNull();
	});

	it('never uses shaming or medical language', () => {
		const forbidden = ['fail', 'behind', 'too low', 'too high', 'bad', 'wrong', 'poor', 'weak'];
		for (const hz of [60, 90, 110, 125, 140, 170, 300]) {
			const text = (describeDistance(hz, start) ?? '').toLowerCase();
			for (const word of forbidden) expect(text).not.toContain(word);
		}
	});
});
