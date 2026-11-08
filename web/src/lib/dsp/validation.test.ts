/**
 * The cross-check against sounds made by a separate program.
 *
 * `tools/validate/synth.py` builds synthetic voices with known pitches, written
 * in Python and sharing no code with this one. Those files (and a truth.json
 * saying what each really is) land in `tools/validate/out/`.
 *
 * This test reads them and asks Warbler's analyser the same question the app
 * asks of a microphone. If both agree, a bug in one implementation cannot hide
 * behind a matching bug in the other.
 *
 * It is skipped when the files have not been generated, so CI stays green
 * without them. Generate with:
 *
 *     cd tools/validate && uv run python pitch_check.py
 */

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PitchTracker } from './pitch';

interface Truth {
	name: string;
	pitch_hz: number;
	file: string;
	sample_rate: number;
}

const OUT = new URL('../../../../tools/validate/out/', import.meta.url);
const TRUTH = new URL('truth.json', OUT);
const available = existsSync(TRUTH);
const voices: Truth[] = available ? (JSON.parse(readFileSync(TRUTH, 'utf8')) as Truth[]) : [];

/** Read a 16-bit mono PCM WAV, which is what the Python writer produces. */
function readWav(path: URL): { samples: Float32Array; sampleRate: number } {
	const data = readFileSync(path);
	if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE') {
		throw new Error('not a WAV file');
	}
	let at = 12;
	let sampleRate = 0;
	let channels = 1;
	let bits = 16;
	while (at + 8 <= data.length) {
		const id = data.toString('ascii', at, at + 4);
		const size = data.readUInt32LE(at + 4);
		const body = at + 8;
		if (id === 'fmt ') {
			channels = data.readUInt16LE(body + 2);
			sampleRate = data.readUInt32LE(body + 4);
			bits = data.readUInt16LE(body + 14);
		} else if (id === 'data') {
			if (channels !== 1 || bits !== 16) throw new Error('expected 16-bit mono');
			const count = Math.floor(size / 2);
			const samples = new Float32Array(count);
			for (let i = 0; i < count; i++) samples[i] = data.readInt16LE(body + i * 2) / 32768;
			return { samples, sampleRate };
		}
		at = body + size + (size % 2); // chunks are padded to an even length
	}
	throw new Error('no data chunk');
}

function medianOf(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/** The pitch Warbler settles on for a whole file. */
function measuredPitch(voice: Truth): number | null {
	const { samples, sampleRate } = readWav(new URL(voice.file, OUT));
	const frames = new PitchTracker(sampleRate).push(samples);
	const voiced = frames
		.filter((frame) => frame.at > 0.2 && frame.voiced && frame.hz !== null)
		.map((frame) => frame.hz as number);
	return voiced.length > 0 ? medianOf(voiced) : null;
}

describe.skipIf(!available)('synthetic voices from the Python validator', () => {
	it('has files to check', () => {
		expect(voices.length).toBeGreaterThan(20);
	});

	it('finds every known pitch within 3 percent', () => {
		const failures: string[] = [];
		for (const voice of voices) {
			const measured = measuredPitch(voice);
			if (measured === null) {
				failures.push(`${voice.file}: nothing measured (true ${voice.pitch_hz} Hz)`);
				continue;
			}
			const error = ((measured - voice.pitch_hz) / voice.pitch_hz) * 100;
			if (Math.abs(error) > 3) {
				failures.push(
					`${voice.file}: ${measured.toFixed(1)} Hz for a true ${voice.pitch_hz} Hz (${error.toFixed(1)}%)`
				);
			}
		}
		expect(failures).toEqual([]);
	});

	it('never reports double or half the true pitch', () => {
		const bad: string[] = [];
		for (const voice of voices) {
			const measured = measuredPitch(voice);
			if (measured === null) continue;
			const ratio = measured / voice.pitch_hz;
			if (Math.abs(ratio - 2) < 0.15 || Math.abs(ratio - 0.5) < 0.1) bad.push(voice.file);
		}
		expect(bad).toEqual([]);
	});

	it('works at the file rate the Python writer used, not a hardcoded one', () => {
		for (const voice of voices) expect(voice.sample_rate).toBe(48_000);
	});
});
