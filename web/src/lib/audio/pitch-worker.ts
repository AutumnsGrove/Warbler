/**
 * Pitch analysis, off the main thread.
 *
 * Why a worker: YIN does a lot of arithmetic (about a hundred thousand
 * multiply-adds per reading, sixty or more times a second). On the main thread
 * that would sit between taps and drawing, and the screen would stutter on a
 * phone. In a worker it cannot interfere with the interface.
 *
 * Why this file is so thin: it only passes sound in and readings out. The
 * arithmetic is in ../dsp/, which is plain TypeScript with no browser objects,
 * so vitest tests exactly the code that runs here. That was a deliberate choice
 * over doing the work inside the audio worklet, which cannot be imported by
 * tests.
 */

import { PitchTracker, type PitchFrame } from '../dsp/pitch';

export type PitchRequest =
	| { type: 'start'; sampleRate: number; minHz?: number; maxHz?: number }
	| { type: 'samples'; samples: Float32Array }
	| { type: 'reset' };

export type PitchResponse = { type: 'frames'; frames: PitchFrame[] } | { type: 'error'; message: string };

let tracker: PitchTracker | null = null;

const scope = self as unknown as {
	onmessage: ((event: MessageEvent<PitchRequest>) => void) | null;
	postMessage: (message: PitchResponse) => void;
};

scope.onmessage = (event: MessageEvent<PitchRequest>) => {
	try {
		const request = event.data;
		if (request.type === 'start') {
			tracker = new PitchTracker(request.sampleRate, {
				minHz: request.minHz,
				maxHz: request.maxHz
			});
			return;
		}
		if (request.type === 'reset') {
			tracker?.reset();
			return;
		}
		if (!tracker) return;
		const frames = tracker.push(request.samples);
		if (frames.length > 0) scope.postMessage({ type: 'frames', frames });
	} catch (err) {
		// A crash here must never freeze the screen: say what happened instead.
		scope.postMessage({
			type: 'error',
			message: err instanceof Error ? err.message : 'Pitch analysis failed.'
		});
	}
};
