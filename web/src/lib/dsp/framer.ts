/**
 * Cutting a stream of sound into fixed-size windows.
 *
 * Sound arrives from the microphone in small pieces (128 samples at a time),
 * but pitch analysis needs a longer window, about 40 to 50 milliseconds, and a
 * new window every 10 to 20 milliseconds. This turns one into the other.
 *
 * The tricky part, and the reason this is a separate tested file: the answer
 * must not depend on how the stream was chopped up. Feeding a recording in one
 * piece, or in pieces of 127 and 129 samples, must give exactly the same
 * windows. That is the "chunk equivalence" rule from docs/testing.md.
 */

export interface FramerOptions {
	/** How many samples go into one window. */
	windowSize: number;
	/** How many samples advance between windows. */
	hopSize: number;
}

/**
 * Collects samples and hands out complete windows.
 *
 * Think of it as a fixed-length ruler that slides along the stream: the first
 * window starts at the first sample, the next starts one hop later, and so on.
 * Windows overlap when the hop is smaller than the window.
 */
export class Framer {
	private readonly windowSize: number;
	private readonly hopSize: number;
	/** Ring buffer holding the samples still needed, oldest first. */
	private readonly buffer: Float32Array;
	/** Where the next incoming sample is written. */
	private writeAt = 0;
	/** How many samples are in the buffer (never more than windowSize). */
	private filled = 0;
	/** Samples received since the last window was handed out. */
	private sinceHop = 0;

	constructor({ windowSize, hopSize }: FramerOptions) {
		if (!Number.isInteger(windowSize) || windowSize < 1) {
			throw new Error('windowSize must be a positive whole number');
		}
		if (!Number.isInteger(hopSize) || hopSize < 1) {
			throw new Error('hopSize must be a positive whole number');
		}
		this.windowSize = windowSize;
		this.hopSize = hopSize;
		this.buffer = new Float32Array(windowSize);
	}

	/** True once at least one full window has been handed out. */
	get ready(): boolean {
		return this.filled >= this.windowSize;
	}

	/**
	 * Add a piece of sound and return every window that is now complete.
	 * Most calls return nothing, because a window covers several pieces.
	 *
	 * Samples are taken one at a time on purpose: if a whole block were copied
	 * before checking, one large block could contain several hops and fewer
	 * windows would come out than the same sound delivered in small blocks.
	 */
	push(chunk: Float32Array): Float32Array[] {
		const windows: Float32Array[] = [];
		for (let i = 0; i < chunk.length; i++) {
			this.buffer[this.writeAt] = chunk[i];
			this.writeAt = (this.writeAt + 1) % this.windowSize;
			if (this.filled < this.windowSize) this.filled++;
			this.sinceHop++;
			if (this.filled >= this.windowSize && this.sinceHop >= this.hopSize) {
				windows.push(this.readOldestFirst());
				this.sinceHop = 0;
			}
		}
		return windows;
	}

	/** The last windowSize samples, oldest first. */
	private readOldestFirst(): Float32Array {
		const out = new Float32Array(this.windowSize);
		const split = this.writeAt;
		out.set(this.buffer.subarray(split), 0);
		out.set(this.buffer.subarray(0, split), this.windowSize - split);
		return out;
	}

	/** Forget everything. Used when a session stops. */
	reset(): void {
		this.writeAt = 0;
		this.filled = 0;
		this.sinceHop = 0;
		this.buffer.fill(0);
	}
}
