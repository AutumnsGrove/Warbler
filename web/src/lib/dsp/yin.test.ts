import { describe, expect, it } from 'vitest';
import { rmsOf, yin } from './yin';
import { noise, silence, tone, voice } from './test-signals';

const RATE = 12_000;
const WINDOW = Math.round(0.045 * RATE);

/** A window of sound cut from the middle, so the filter and edges do not matter. */
function middleWindow(sound: Float32Array, length = WINDOW): Float32Array {
	const start = Math.max(0, Math.floor((sound.length - length) / 2));
	return sound.slice(start, start + length);
}

function within(actual: number, expected: number, percent: number): boolean {
	return Math.abs(actual - expected) <= (expected * percent) / 100;
}

function isOctaveError(actual: number, expected: number): boolean {
	const ratio = actual / expected;
	return Math.abs(ratio - 2) < 0.15 || Math.abs(ratio - 0.5) < 0.1;
}

describe('rmsOf', () => {
	it('measures a sine as amplitude over root two', () => {
		expect(rmsOf(tone(200, 0.1, RATE, 0.5))).toBeCloseTo(0.5 / Math.SQRT2, 3);
	});
	it('is zero for silence and for an empty window', () => {
		expect(rmsOf(silence(0.1, RATE))).toBe(0);
		expect(rmsOf(new Float32Array(0))).toBe(0);
	});
});

describe('yin on pure tones', () => {
	it('finds every tone from 70 to 500 Hz within 3 percent', () => {
		const failures: string[] = [];
		for (let hz = 70; hz <= 500; hz += 5) {
			const found = yin(middleWindow(tone(hz, 0.3, RATE)), RATE);
			if (!found || !within(found.hz, hz, 3)) {
				failures.push(`${hz} Hz -> ${found ? found.hz.toFixed(1) : 'nothing'}`);
			}
		}
		expect(failures).toEqual([]);
	});

	it('reports high confidence for clean tones', () => {
		const found = yin(middleWindow(tone(220, 0.3, RATE)), RATE);
		expect(found).not.toBeNull();
		expect(found!.clarity).toBeGreaterThan(0.9);
	});

	it("works at the phone's rates, not just 12 kHz", () => {
		for (const rate of [44_100, 48_000]) {
			const sound = tone(196, 0.3, rate);
			const found = yin(middleWindow(sound, Math.round(0.045 * rate)), rate);
			expect(found).not.toBeNull();
			expect(within(found!.hz, 196, 3)).toBe(true);
		}
	});

	it('never looks outside the search range it was given', () => {
		const high = yin(middleWindow(tone(600, 0.3, RATE)), RATE);
		expect(high).toBeNull();

		const narrow = yin(middleWindow(tone(300, 0.3, RATE)), RATE, { minHz: 350, maxHz: 500 });
		expect(narrow).toBeNull();
	});

	it('says nothing useful about silence', () => {
		const found = yin(middleWindow(silence(0.3, RATE)), RATE);
		// Either nothing, or a result with no confidence. Never a confident number.
		expect(found === null || found.clarity < 0.2).toBe(true);
	});

	it('does not give a confident pitch for hiss', () => {
		const found = yin(middleWindow(noise(0.3, RATE, 0.1)), RATE);
		expect(found === null || found.clarity < 0.6).toBe(true);
	});

	it('gives the same answer twice for the same sound', () => {
		const window = middleWindow(voice(150, 0.3, RATE));
		expect(yin(window, RATE)).toEqual(yin(window, RATE));
	});

	it('counts octave errors across the whole range', () => {
		let checked = 0;
		let octaveErrors = 0;
		for (let hz = 70; hz <= 500; hz += 10) {
			const found = yin(middleWindow(tone(hz, 0.3, RATE)), RATE);
			checked++;
			if (!found) {
				octaveErrors++;
				continue;
			}
			if (isOctaveError(found.hz, hz)) octaveErrors++;
		}
		expect(octaveErrors / checked).toBeLessThan(0.005);
	});

	it('refuses nonsense settings instead of guessing', () => {
		expect(yin(new Float32Array(0), RATE)).toBeNull();
		expect(yin(middleWindow(tone(200, 0.3, RATE)), 0)).toBeNull();
		expect(yin(middleWindow(tone(200, 0.3, RATE)), RATE, { minHz: 500, maxHz: 200 })).toBeNull();
	});
});
