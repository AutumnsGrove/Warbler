import { describe, expect, it } from 'vitest';
import { HOP_MS, PitchTracker, WINDOW_MS, medianSmooth } from './pitch';
import { glide, inChunks, noise, silence, tone, voice, vibrato, withGaps } from './test-signals';

const RATE = 48_000;

function within(actual: number, expected: number, percent: number): boolean {
	return Math.abs(actual - expected) <= (expected * percent) / 100;
}

/** Run a whole recording through a tracker and collect the readings. */
function readings(sound: Float32Array, rate = RATE) {
	return new PitchTracker(rate).push(sound);
}

/** Skip the first moments, where the filter is still warming up. */
function settled(frames: ReturnType<typeof readings>) {
	return frames.filter((f) => f.at > 0.15);
}

function voicedHz(frames: ReturnType<typeof readings>): number[] {
	return settled(frames)
		.filter((f) => f.voiced && f.hz !== null)
		.map((f) => f.hz as number);
}

describe('PitchTracker', () => {
	it('produces a reading roughly every hop', () => {
		const frames = readings(tone(200, 1, RATE));
		const expected = 1000 / HOP_MS;
		expect(frames.length).toBeGreaterThan(expected * 0.8);
		expect(frames.length).toBeLessThan(expected * 1.2);
	});

	it('times the readings from the start of the stream', () => {
		const frames = readings(tone(200, 0.5, RATE));
		expect(frames[0].at).toBeCloseTo(0, 5);
		expect(frames[1].at - frames[0].at).toBeCloseTo(HOP_MS / 1000, 3);
	});

	it('gives identical frames however the sound is chopped up', () => {
		const sound = voice(150, 0.6, RATE);
		const reference = readings(sound);

		for (const sizes of [[1], [127], [129], [126, 1, 129], [128], [7, 400, 1, 61, 1024]]) {
			const tracker = new PitchTracker(RATE);
			const frames = inChunks(sound, sizes).flatMap((chunk) => tracker.push(chunk));
			expect(frames).toEqual(reference);
		}
	});

	it('finds a voice-like sound at several pitches', () => {
		for (const hz of [90, 120, 150, 200, 250, 300]) {
			const found = voicedHz(readings(voice(hz, 1, RATE)));
			expect(found.length).toBeGreaterThan(30);
			const accurate = found.filter((v) => within(v, hz, 3)).length;
			expect(accurate / found.length).toBeGreaterThan(0.99);
		}
	});

	it('gets the pitch right when the lowest harmonic is weak', () => {
		const found = voicedHz(readings(voice(150, 1, RATE, { missingFundamental: true })));
		expect(found.length).toBeGreaterThan(30);
		for (const hz of found) expect(within(hz, 150, 3)).toBe(true);
	});

	it('copes with moderate noise', () => {
		const found = voicedHz(readings(voice(150, 1, RATE, { noise: 0.05 })));
		expect(found.length).toBeGreaterThan(30);
		const accurate = found.filter((v) => within(v, 150, 3)).length;
		expect(accurate / found.length).toBeGreaterThan(0.98);
	});

	it('does not let loudness change the pitch', () => {
		const quiet = voicedHz(readings(tone(200, 0.8, RATE, 0.02)));
		const loud = voicedHz(readings(tone(200, 0.8, RATE, 0.8)));
		expect(quiet.length).toBeGreaterThan(10);
		expect(loud.length).toBeGreaterThan(10);
		expect(within(quiet[quiet.length - 1], loud[loud.length - 1], 1)).toBe(true);
	});

	it('reports nothing for silence', () => {
		const frames = readings(silence(1, RATE));
		expect(frames.length).toBeGreaterThan(30);
		expect(frames.some((f) => f.voiced)).toBe(false);
	});

	it('reports nothing for hiss', () => {
		const frames = voicedHz(readings(noise(1, RATE, 0.05)));
		// A little may sneak through, but the screen must be mostly blank.
		expect(frames.length).toBeLessThan(20);
	});

	it('follows a pitch that slides', () => {
		const seconds = 2;
		const frames = settled(readings(glide(120, 180, seconds, RATE))).filter((f) => f.voiced && f.hz !== null);
		expect(frames.length).toBeGreaterThan(30);
		const accurate = frames.filter((f) => {
			// Compare with the pitch at the middle of the window, not its start.
			const centre = f.at + WINDOW_MS / 2000;
			const expected = 120 + (180 - 120) * Math.min(1, centre / seconds);
			return within(f.hz as number, expected, 5);
		}).length;
		expect(accurate / frames.length).toBeGreaterThan(0.9);
	});

	it('follows vibrato without breaking up', () => {
		const found = voicedHz(readings(vibrato(200, 2, RATE)));
		expect(found.length).toBeGreaterThan(100);
		for (const hz of found) expect(Math.abs(hz - 200) / 200).toBeLessThan(0.06);
	});

	it('stays quiet through the gaps in speech', () => {
		// 300 ms of sound, 200 ms of silence, repeated.
		const sound = withGaps(voice(200, 1, RATE), RATE, [300, 200, 300, 200]);
		const frames = readings(sound);
		// The first gap runs from 0.30 s to 0.50 s. Stay clear of both edges,
		// because a 45 ms window straddling the edge hears some of each.
		const inGap = frames.filter((f) => f.at > 0.36 && f.at < 0.44);
		expect(inGap.length).toBeGreaterThan(3);
		expect(inGap.some((f) => f.voiced)).toBe(false);
	});

	it('reads the same pitch at the phone rates', () => {
		const at48 = voicedHz(readings(voice(196, 1, 48_000), 48_000));
		const at44 = voicedHz(readings(voice(196, 1, 44_100), 44_100));
		expect(at48.length).toBeGreaterThan(30);
		expect(at44.length).toBeGreaterThan(30);
		expect(within(at48[at48.length - 1], at44[at44.length - 1], 1)).toBe(true);
	});

	it('forgets the past after a reset', () => {
		const tracker = new PitchTracker(RATE);
		tracker.push(tone(200, 0.5, RATE));
		tracker.reset();
		const frames = tracker.push(tone(200, 0.1, RATE));
		expect(frames[0].at).toBe(0);
	});
});

describe('medianSmooth', () => {
	it('ignores a single wild reading', () => {
		expect(medianSmooth([100, 102, 900, 98, 101])).toEqual([102, 101, 101, 101.5, 101]);
	});

	it('leaves gaps as gaps', () => {
		expect(medianSmooth([100, null, 104])).toEqual([100, null, 104]);
	});

	it('keeps short series and empty series safe', () => {
		expect(medianSmooth([])).toEqual([]);
		expect(medianSmooth([120])).toEqual([120]);
		expect(medianSmooth([120, 130], 3)).toEqual([125, 125]);
	});
});
