/**
 * A plain-language summary of someone's voice, and a suggested zone from it.
 *
 * Typing a zone in hertz is unreasonable: almost nobody knows their own pitch
 * in numbers. The screen asks for a few seconds of ordinary speech instead and
 * works the numbers out, which is what the "find your starting point" step in
 * docs/screens.md describes.
 *
 * The suggestion is deliberately modest: the middle 80% of what was heard, with
 * a minimum width, so a couple of odd frames cannot produce a one-hertz zone.
 * It is always shown as an editable suggestion, never applied silently.
 */

import type { PitchFrame } from './pitch';
import type { Zone } from './zones';

export interface PitchSummary {
	/** How many confident readings went into this. */
	count: number;
	/** The middle reading: the best single answer for "your pitch". */
	median: number;
	/** The 10th and 90th percentile, so one wild frame cannot stretch the range. */
	p10: number;
	p90: number;
	/** Roughly how much sound was measured, in seconds. */
	seconds: number;
}

/** The narrowest zone worth showing, in Hz either side of the middle. */
export const MIN_HALF_WIDTH = 8;

/**
 * How wide the suggested zone is, as a fraction of the middle pitch.
 *
 * Speaking pitch naturally moves a long way in a few seconds: intonation, a
 * question at the end of a sentence, a laugh. Measured over six seconds, those
 * movements can span more than half an octave, which would make a "zone" as
 * wide as the whole voice and useless for practice. A tenth of the middle pitch
 * either side is a comfortable band to aim at: about three semitones in total.
 */
export const ZONE_HALF_FRACTION = 0.1;

function percentile(sorted: number[], fraction: number): number {
	if (sorted.length === 0) return 0;
	const position = (sorted.length - 1) * fraction;
	const lower = Math.floor(position);
	const upper = Math.ceil(position);
	if (lower === upper) return sorted[lower];
	return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

/**
 * Summarise confident pitch readings. Returns null when there is not enough to
 * say anything honest (fewer than 8 readings, about a third of a second).
 */
export function summarisePitch(hz: number[], seconds = 0): PitchSummary | null {
	const values = hz.filter((value) => Number.isFinite(value) && value > 0);
	if (values.length < 8) return null;
	const sorted = [...values].sort((a, b) => a - b);
	return {
		count: values.length,
		median: percentile(sorted, 0.5),
		p10: percentile(sorted, 0.1),
		p90: percentile(sorted, 0.9),
		seconds
	};
}

/** Confident readings from a set of frames, for summarising a short capture. */
export function voicedFrequencies(frames: PitchFrame[]): number[] {
	return frames.filter((frame) => frame.voiced && frame.hz !== null).map((frame) => frame.hz as number);
}

/**
 * The zone to suggest: a band around the middle of what was heard.
 *
 * Deliberately not the whole measured spread. The 10th and 90th percentile are
 * still reported, because telling someone their voice moved between two numbers
 * is genuinely useful; but the zone itself is the middle, so practice has a
 * direction rather than covering everything the voice already does.
 */
export function suggestZone(summary: PitchSummary | null): Zone | null {
	if (!summary || summary.median <= 0) return null;
	const centre = Math.round(summary.median);
	const halfWidth = Math.max(MIN_HALF_WIDTH, Math.round(summary.median * ZONE_HALF_FRACTION));
	return { low: Math.max(1, centre - halfWidth), high: centre + halfWidth };
}

/**
 * A sentence about how far the voice moved, which is information rather than a
 * target. Returns null when the movement was small enough to be uninteresting.
 */
export function describeRange(summary: PitchSummary | null): string | null {
	if (!summary) return null;
	const low = Math.round(summary.p10);
	const high = Math.round(summary.p90);
	if (high - low < 20) return null;
	return `While you spoke, your pitch moved between about ${low} and ${high} Hz. That is normal for speech.`;
}

/** A few words for the screen, with the note name so it means something. */
export function describeSummary(summary: PitchSummary | null, noteName: string): string {
	if (!summary) return 'Not enough voice to measure yet. Try again and speak a few words.';
	return `Your voice sits around ${Math.round(summary.median)} Hz (${noteName}).`;
}
