/**
 * Level maths for the volume meter. Pure functions, no browser APIs, so they
 * can be tested in Node.
 *
 * The audio worklet only adds up squared samples and finds the biggest sample
 * (it cannot import this file). The conversions to decibels and to a 0-1 meter
 * position happen here.
 */

/** Quietest level the meter shows, in dB relative to full scale (dBFS). */
export const METER_FLOOR_DB = -60;

/** A sample this close to full scale counts as clipping (distortion). */
export const CLIP_THRESHOLD = 0.999;

/** Root-mean-square level from a running sum of squares and sample count. */
export function rmsFromSums(sumSquares: number, count: number): number {
	if (count <= 0 || sumSquares <= 0) return 0;
	return Math.sqrt(sumSquares / count);
}

/** Convert a linear level (0 to 1) to dBFS. Silence returns the meter floor. */
export function toDbfs(linear: number): number {
	if (!(linear > 0)) return METER_FLOOR_DB;
	return Math.max(METER_FLOOR_DB, 20 * Math.log10(linear));
}

/** Map a dBFS value to a 0-1 position on the meter. */
export function dbToMeter(db: number, floorDb: number = METER_FLOOR_DB): number {
	if (!Number.isFinite(db)) return 0;
	const t = (db - floorDb) / (0 - floorDb);
	return Math.min(1, Math.max(0, t));
}

/**
 * Smooth the displayed level: rise quickly so speech feels responsive, fall
 * slowly so the bar does not flicker.
 */
export function smoothLevel(previous: number, next: number, rise = 0.6, fall = 0.15): number {
	const k = next > previous ? rise : fall;
	return previous + (next - previous) * k;
}

/** Peak-hold: keep the highest recent peak, letting it fall by `decay` per step. */
export function holdPeak(held: number, next: number, decay = 0.02): number {
	return Math.max(next, held - decay);
}

/** True if the biggest sample reached (nearly) full scale. */
export function isClipping(peak: number): boolean {
	return peak >= CLIP_THRESHOLD;
}
