/**
 * Zones and the ramp, which are safety rules, not decoration.
 *
 * Safety rule 1 in PLAN.md: never score against 100% of a target. The user says
 * how far along the path from their starting voice to their goal they want to
 * aim, and the app shows that intermediate band. The suggested value is 25%,
 * and only the user can raise it: nothing in the app may quietly set 100%.
 *
 * A zone is a range of pitch in Hz. Your starting zone is where your voice sits
 * now; your goal zone is where you are heading. The ramped zone sits a
 * percentage of the way between them, keeping the same width.
 *
 * All pure functions, so the safety rule can be tested.
 */

export interface Zone {
	/** Bottom of the range, in Hz. */
	low: number;
	/** Top of the range, in Hz. */
	high: number;
}

/** The suggested ramp. Lower is gentler, and it is the user's choice. */
export const DEFAULT_RAMP_PERCENT = 25;

/** The widest a zone may be relative to its centre, used to sanity-check input. */
const MIN_ZONE_HZ = 1;

function centre(zone: Zone): number {
	return (zone.low + zone.high) / 2;
}

function width(zone: Zone): number {
	return Math.abs(zone.high - zone.low);
}

/** True if a zone is usable: whole numbers, right way up, above zero. */
export function isValidZone(zone: Zone | null | undefined): zone is Zone {
	if (!zone) return false;
	if (!Number.isFinite(zone.low) || !Number.isFinite(zone.high)) return false;
	return zone.low > 0 && zone.high >= zone.low && zone.high - zone.low >= 0;
}

/**
 * Keep a ramp percentage in range. Zero means "stay at my starting voice",
 * which is allowed. 100 is allowed only if the user really asked for it.
 */
export function clampRampPercent(percent: number): number {
	if (!Number.isFinite(percent)) return DEFAULT_RAMP_PERCENT;
	return Math.min(100, Math.max(0, Math.round(percent)));
}

/**
 * The zone to show: a share of the way from the starting zone to the goal zone,
 * keeping the starting zone's width. The band moves up (or down) as the ramp
 * goes up, which is what makes practice gradual.
 */
export function rampedZone(start: Zone, target: Zone, percent: number): Zone {
	const share = clampRampPercent(percent) / 100;
	const move = centre(target) - centre(start);
	const middle = centre(start) + move * share;
	const halfWidth = Math.max(width(start), MIN_ZONE_HZ) / 2;
	return { low: middle - halfWidth, high: middle + halfWidth };
}

export type Direction = 'below' | 'above' | 'inside';

export interface PitchDistance {
	direction: Direction;
	/** Whole Hz between the pitch and the nearest edge of the zone. Zero inside. */
	hz: number;
}

/** How far a pitch is from a zone, in whole Hz, and on which side. */
export function distanceToZone(hz: number, zone: Zone): PitchDistance {
	if (!(hz > 0) || !isValidZone(zone)) return { direction: 'inside', hz: 0 };
	if (hz < zone.low) return { direction: 'below', hz: Math.round(zone.low - hz) };
	if (hz > zone.high) return { direction: 'above', hz: Math.round(hz - zone.high) };
	return { direction: 'inside', hz: 0 };
}

/**
 * The sentence under the number. Deliberately neutral: it states where you are,
 * never that you are wrong (safety rule 4). Returns null when the pitch is in
 * the zone, or when there is nothing confident to report.
 */
export function describeDistance(hz: number | null, zone: Zone | null, zoneName = 'your goal zone'): string | null {
	if (hz === null || !isValidZone(zone)) return null;
	const { direction, hz: gap } = distanceToZone(hz, zone);
	if (direction === 'inside') return 'In your zone.';
	if (gap === 0) return null;
	return `${gap} Hz ${direction} ${zoneName}.`;
}
