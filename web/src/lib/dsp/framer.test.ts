import { describe, expect, it } from 'vitest';
import { Framer } from './framer';
import { inChunks, tone } from './test-signals';

const RATE = 12_000;

function ramp(n: number): Float32Array {
	return Float32Array.from({ length: n }, (_, i) => i / n);
}

describe('Framer', () => {
	it('gives nothing until a whole window has arrived', () => {
		const framer = new Framer({ windowSize: 10, hopSize: 5 });
		expect(framer.push(ramp(9))).toHaveLength(0);
		expect(framer.ready).toBe(false);
		const first = framer.push(ramp(1));
		expect(first).toHaveLength(1);
		expect(framer.ready).toBe(true);
	});

	it('starts the first window at the first sample', () => {
		const framer = new Framer({ windowSize: 4, hopSize: 2 });
		const frames = framer.push(Float32Array.from([1, 2, 3, 4, 5, 6]));
		expect(Array.from(frames[0])).toEqual([1, 2, 3, 4]);
		expect(Array.from(frames[1])).toEqual([3, 4, 5, 6]);
	});

	it('hands out one window per hop once running', () => {
		const framer = new Framer({ windowSize: 4, hopSize: 2 });
		framer.push(new Float32Array(4));
		const later = framer.push(new Float32Array(20));
		expect(later).toHaveLength(10);
	});

	it('gives identical windows however the sound is chopped up', () => {
		const sound = tone(220, 0.5, RATE);
		const reference = new Framer({ windowSize: 480, hopSize: 160 });
		const whole = reference.push(sound).map((f) => Array.from(f));

		for (const sizes of [[1], [127], [129], [128], [1, 127, 129, 3], [7, 400, 1, 61]]) {
			const framer = new Framer({ windowSize: 480, hopSize: 160 });
			const pieces = inChunks(sound, sizes).flatMap((chunk) => framer.push(chunk));
			expect(pieces.map((f) => Array.from(f))).toEqual(whole);
		}
	});

	it('refuses nonsensical sizes instead of guessing', () => {
		expect(() => new Framer({ windowSize: 0, hopSize: 1 })).toThrow();
		expect(() => new Framer({ windowSize: 10, hopSize: 0 })).toThrow();
		expect(() => new Framer({ windowSize: 10.5, hopSize: 2 })).toThrow();
	});

	it('forgets the past after a reset', () => {
		const framer = new Framer({ windowSize: 4, hopSize: 2 });
		framer.push(new Float32Array(8));
		framer.reset();
		expect(framer.ready).toBe(false);
		const frames = framer.push(Float32Array.from([1, 2, 3, 4]));
		expect(Array.from(frames[0])).toEqual([1, 2, 3, 4]);
	});
});
