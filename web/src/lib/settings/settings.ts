/**
 * The settings a practice session needs, and the rules around them.
 *
 * Three rules shape this file, all from PLAN.md:
 *
 * 1. **No default zones.** A new person has not told Warbler anything about
 *    their voice, so both zones start empty. The app offers "just show me my
 *    voice" instead of guessing a target.
 * 2. **Only the user raises the ramp.** The suggested ramp is 25%, and nothing
 *    here ever nudges it up on its own.
 * 3. **The session limit cannot be raised from the practice screen.** It lives
 *    here in Settings, where changing it is a deliberate act.
 *
 * This file is pure: no browser storage, no Svelte. The store that saves these
 * values lives in store.svelte.ts, so the rules can be tested on their own.
 */

import { clampRampPercent, isValidZone, rampedZone, type Zone } from '../dsp/zones';

export interface Settings {
	/** Bottom and top of the voice's resting pitch, in Hz. Null means "not set". */
	startLow: number | null;
	startHigh: number | null;
	/** Bottom and top of the pitch being worked towards, in Hz. Null means "not set". */
	targetLow: number | null;
	targetHigh: number | null;
	/** How far along the path from start to target to practise, in percent. */
	rampPercent: number;
	/** "Just show me my voice": no zones, no comparisons. */
	voiceOnly: boolean;
	/** Lowest and highest pitch the analyser looks for, in Hz. */
	minHz: number;
	maxHz: number;
	/** Longest a single session may run before it ends, in minutes. */
	sessionMinutes: number;
	/** How often a break is suggested, in minutes. */
	breakMinutes: number;
	/** Show musical note names next to Hz. */
	showNoteNames: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
	startLow: null,
	startHigh: null,
	targetLow: null,
	targetHigh: null,
	rampPercent: 25,
	voiceOnly: false,
	minHz: 70,
	maxHz: 500,
	sessionMinutes: 30,
	breakMinutes: 10,
	showNoteNames: true
};

/** Limits beyond which a value is nonsense rather than a choice. */
export const LIMITS = {
	minHz: { low: 50, high: 300 },
	maxHz: { low: 200, high: 1200 },
	sessionMinutes: { low: 1, high: 120 },
	breakMinutes: { low: 1, high: 60 }
} as const;

function clamp(value: number, low: number, high: number, fallback: number): number {
	if (!Number.isFinite(value)) return fallback;
	return Math.min(high, Math.max(low, Math.round(value)));
}

/**
 * Take whatever was found in storage (or handed in) and make it safe.
 * Anything missing, corrupt or out of range falls back to the default rather
 * than breaking the screen.
 */
export function sanitise(raw: Partial<Settings> | null | undefined): Settings {
	const s = { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
	const numberOrNull = (value: unknown): number | null =>
		typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : null;

	return {
		startLow: numberOrNull(s.startLow),
		startHigh: numberOrNull(s.startHigh),
		targetLow: numberOrNull(s.targetLow),
		targetHigh: numberOrNull(s.targetHigh),
		rampPercent: clampRampPercent(Number(s.rampPercent)),
		voiceOnly: s.voiceOnly === true,
		minHz: clamp(Number(s.minHz), LIMITS.minHz.low, LIMITS.minHz.high, DEFAULT_SETTINGS.minHz),
		maxHz: clamp(Number(s.maxHz), LIMITS.maxHz.low, LIMITS.maxHz.high, DEFAULT_SETTINGS.maxHz),
		sessionMinutes: clamp(
			Number(s.sessionMinutes),
			LIMITS.sessionMinutes.low,
			LIMITS.sessionMinutes.high,
			DEFAULT_SETTINGS.sessionMinutes
		),
		breakMinutes: clamp(
			Number(s.breakMinutes),
			LIMITS.breakMinutes.low,
			LIMITS.breakMinutes.high,
			DEFAULT_SETTINGS.breakMinutes
		),
		showNoteNames: s.showNoteNames !== false
	};
}

export interface SettingsProblem {
	/** Which part of the screen to point at. */
	field: 'start' | 'target' | 'range' | 'minutes' | 'break';
	/** Plain language, no blame. */
	message: string;
}

/** The starting zone, or null when it has not been set properly. */
export function startZone(s: Settings): Zone | null {
	if (s.startLow === null || s.startHigh === null) return null;
	const zone = { low: s.startLow, high: s.startHigh };
	return isValidZone(zone) ? zone : null;
}

/** The goal zone, or null when it has not been set properly. */
export function targetZone(s: Settings): Zone | null {
	if (s.targetLow === null || s.targetHigh === null) return null;
	const zone = { low: s.targetLow, high: s.targetHigh };
	return isValidZone(zone) ? zone : null;
}

/**
 * The band to show while practising: the ramped zone, never the final target.
 * Null in "just show me my voice" mode, or until both zones are set.
 */
export function practiceZone(s: Settings): Zone | null {
	if (s.voiceOnly) return null;
	const start = startZone(s);
	const target = targetZone(s);
	if (!start || !target) return null;
	return rampedZone(start, target, s.rampPercent);
}

/** True when the practice screen should keep quiet about zones. */
export function isVoiceOnly(s: Settings): boolean {
	return s.voiceOnly || practiceZone(s) === null;
}

/** Everything that needs fixing before zones can be drawn, in plain words. */
export function validateSettings(s: Settings): SettingsProblem[] {
	const problems: SettingsProblem[] = [];
	const pairs: [SettingsProblem['field'], number | null, number | null, string][] = [
		['start', s.startLow, s.startHigh, 'starting zone'],
		['target', s.targetLow, s.targetHigh, 'target zone']
	];
	for (const [field, low, high, name] of pairs) {
		if (low === null && high === null) continue; // not set yet is allowed
		if (low === null || high === null) {
			problems.push({ field, message: `Fill in both numbers for your ${name}.` });
		} else if (!isValidZone({ low, high })) {
			problems.push({ field, message: `The ${name} needs the lower number first.` });
		}
	}
	if (s.maxHz <= s.minHz) {
		problems.push({ field: 'range', message: 'The top of the pitch range must be above the bottom.' });
	}
	if (s.breakMinutes > s.sessionMinutes) {
		problems.push({ field: 'break', message: 'The break reminder is longer than the session.' });
	}
	return problems;
}

/** True when the user has not said anything about their voice yet. */
export function needsSetup(s: Settings): boolean {
	return !s.voiceOnly && (startZone(s) === null || targetZone(s) === null);
}
