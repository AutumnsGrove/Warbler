/**
 * The practice clock: breaks, the session limit, and the stop screen.
 *
 * These are safety rules, so they are plain functions with a clock passed in.
 * That means a test can pretend ten minutes have passed instead of waiting ten
 * minutes, which is what docs/testing.md layer 10 asks for.
 *
 * Rules being protected (PLAN.md):
 *   2. Session cap, and a break prompt about every ten minutes. The cap cannot
 *      be raised from the practice screen.
 *   3. Every practice start passes through the stop screen first.
 */

export interface PracticePlan {
	/** Longest a session may run, in minutes. */
	sessionMinutes: number;
	/** How often to suggest a break, in minutes. */
	breakMinutes: number;
}

/** Where the session is in time: none, practising, break suggested, or finished. */
export type SessionPhase = 'idle' | 'running' | 'break-due' | 'over';

/** Seconds as mm:ss, or h:mm:ss past an hour. */
export function formatClock(seconds: number): string {
	const safe = Math.max(0, Math.floor(seconds));
	const h = Math.floor(safe / 3600);
	const m = Math.floor((safe % 3600) / 60);
	const s = safe % 60;
	const pad = (n: number) => String(n).padStart(2, '0');
	return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Whole seconds since the session started. Never negative, even if the clock jumps back. */
export function elapsedSeconds(startedAt: number, now: number): number {
	return Math.max(0, Math.floor((now - startedAt) / 1000));
}

/** True once the session has run its allowed length. */
export function isSessionOver(startedAt: number, now: number, plan: PracticePlan): boolean {
	return elapsedSeconds(startedAt, now) >= plan.sessionMinutes * 60;
}

/**
 * True when a break should be offered. `breaksTaken` is how many times a break
 * has already been offered, so the next one comes a full interval later rather
 * than nagging every second.
 */
export function isBreakDue(
	startedAt: number,
	now: number,
	plan: PracticePlan,
	breaksTaken: number
): boolean {
	const dueAt = (breaksTaken + 1) * plan.breakMinutes * 60;
	return elapsedSeconds(startedAt, now) >= dueAt && !isSessionOver(startedAt, now, plan);
}

/**
 * What the screen should be showing. The session limit wins over a break: there
 * is no point offering a break at the very end.
 */
export function sessionPhase(
	startedAt: number | null,
	now: number,
	plan: PracticePlan,
	breaksTaken: number,
	micRunning: boolean
): SessionPhase {
	if (startedAt === null || !micRunning) return 'idle';
	if (isSessionOver(startedAt, now, plan)) return 'over';
	if (isBreakDue(startedAt, now, plan, breaksTaken)) return 'break-due';
	return 'running';
}

/**
 * The stop screen is shown before practice begins, every time. Nothing here can
 * skip it: the only way to a start button is to acknowledge it.
 */
export function requiresStopScreen(acknowledged: boolean): boolean {
	return !acknowledged;
}

/** The short form repeated on screen during practice (safety rule 3). */
export const PRACTICE_BANNER = 'Stop if anything hurts or strains.';

/** The full stop-screen wording (safety rule 3), kept in one place so tests can scan it. */
export const STOP_SCREEN_LINES = [
	'Stop if you feel pain, strain, tightness, or hoarseness.',
	'Rest your voice and have some water.',
	'A speech-language pathologist, ideally one who works with gender-affirming voice care, can help with anything that persists.'
] as const;
