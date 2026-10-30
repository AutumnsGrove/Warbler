import { describe, expect, it } from 'vitest';
import {
	METER_FLOOR_DB,
	dbToMeter,
	holdPeak,
	isClipping,
	rmsFromSums,
	smoothLevel,
	toDbfs
} from './level';

function sine(amplitude: number, n = 4800, cycles = 100): { sumSq: number; peak: number } {
	let sumSq = 0;
	let peak = 0;
	for (let i = 0; i < n; i++) {
		const v = amplitude * Math.sin((2 * Math.PI * cycles * i) / n);
		sumSq += v * v;
		peak = Math.max(peak, Math.abs(v));
	}
	return { sumSq, peak };
}

describe('rmsFromSums', () => {
	it('gives amplitude / sqrt(2) for a sine wave', () => {
		const { sumSq } = sine(0.5);
		expect(rmsFromSums(sumSq, 4800)).toBeCloseTo(0.5 / Math.SQRT2, 4);
	});
	it('is zero for silence and for no samples', () => {
		expect(rmsFromSums(0, 128)).toBe(0);
		expect(rmsFromSums(5, 0)).toBe(0);
	});
});

describe('toDbfs', () => {
	it('puts full scale at 0 dB', () => expect(toDbfs(1)).toBeCloseTo(0));
	it('puts half scale near -6 dB', () => expect(toDbfs(0.5)).toBeCloseTo(-6.02, 1));
	it('clamps silence and nonsense to the floor', () => {
		expect(toDbfs(0)).toBe(METER_FLOOR_DB);
		expect(toDbfs(-1)).toBe(METER_FLOOR_DB);
		expect(toDbfs(Number.NaN)).toBe(METER_FLOOR_DB);
		expect(toDbfs(1e-9)).toBe(METER_FLOOR_DB);
	});
});

describe('dbToMeter', () => {
	it('maps the floor to 0 and full scale to 1', () => {
		expect(dbToMeter(METER_FLOOR_DB)).toBe(0);
		expect(dbToMeter(0)).toBe(1);
	});
	it('is linear in dB in between', () => expect(dbToMeter(-30)).toBeCloseTo(0.5));
	it('clamps out-of-range and non-finite values', () => {
		expect(dbToMeter(-200)).toBe(0);
		expect(dbToMeter(6)).toBe(1);
		expect(dbToMeter(Number.NaN)).toBe(0);
	});
});

describe('smoothLevel', () => {
	it('rises faster than it falls', () => {
		const up = smoothLevel(0, 1) - 0;
		const down = 1 - smoothLevel(1, 0);
		expect(up).toBeGreaterThan(down);
	});
	it('settles on a steady input', () => {
		let v = 0;
		for (let i = 0; i < 100; i++) v = smoothLevel(v, 0.7);
		expect(v).toBeCloseTo(0.7, 3);
	});
});

describe('holdPeak', () => {
	it('jumps up immediately and falls slowly', () => {
		expect(holdPeak(0.2, 0.9)).toBe(0.9);
		expect(holdPeak(0.9, 0.1)).toBeCloseTo(0.88);
	});
});

describe('isClipping', () => {
	it('flags samples at full scale only', () => {
		expect(isClipping(1)).toBe(true);
		expect(isClipping(0.9995)).toBe(true);
		expect(isClipping(0.8)).toBe(false);
	});
});
