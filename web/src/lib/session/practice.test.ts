import { describe, expect, it } from 'vitest';
import {
	PRACTICE_BANNER,
	STOP_SCREEN_LINES,
	elapsedSeconds,
	formatClock,
	isBreakDue,
	isSessionOver,
	requiresStopScreen,
	sessionPhase,
	type PracticePlan
} from './practice';

const plan: PracticePlan = { sessionMinutes: 30, breakMinutes: 10 };
const start = 1_700_000_000_000;
const at = (minutes: number, seconds = 0) => start + minutes * 60_000 + seconds * 1000;

describe('formatClock', () => {
	it('shows minutes and seconds', () => {
		expect(formatClock(0)).toBe('0:00');
		expect(formatClock(65)).toBe('1:05');
		expect(formatClock(632)).toBe('10:32');
	});
	it('adds hours when needed', () => {
		expect(formatClock(3725)).toBe('1:02:05');
	});
	it('never shows a negative clock', () => {
		expect(formatClock(-5)).toBe('0:00');
	});
});

describe('elapsedSeconds', () => {
	it('counts whole seconds from the start', () => {
		expect(elapsedSeconds(start, at(1))).toBe(60);
		expect(elapsedSeconds(start, at(0, 30))).toBe(30);
	});
	it('does not go negative if the clock jumps backwards', () => {
		expect(elapsedSeconds(start, start - 5000)).toBe(0);
	});
});

describe('the session limit', () => {
	it('is not reached before the allowed time', () => {
		expect(isSessionOver(start, at(29, 59), plan)).toBe(false);
	});
	it('is reached exactly on time', () => {
		expect(isSessionOver(start, at(30), plan)).toBe(true);
	});
	it('cannot be raised from the practice screen, because nothing here can change the plan', () => {
		// The plan is passed in from settings. A practice screen calling this
		// function with a larger number would have to have changed the settings.
		const longer: PracticePlan = { ...plan, sessionMinutes: 60 };
		expect(isSessionOver(start, at(30), longer)).toBe(false);
	});
});

describe('breaks', () => {
	it('come due at the interval', () => {
		expect(isBreakDue(start, at(9, 59), plan, 0)).toBe(false);
		expect(isBreakDue(start, at(10), plan, 0)).toBe(true);
	});
	it('wait a full interval after one was offered', () => {
		expect(isBreakDue(start, at(10), plan, 1)).toBe(false);
		expect(isBreakDue(start, at(19, 59), plan, 1)).toBe(false);
		expect(isBreakDue(start, at(20), plan, 1)).toBe(true);
	});
	it('are not offered once the session is over', () => {
		expect(isBreakDue(start, at(30), plan, 0)).toBe(false);
	});
});

describe('sessionPhase', () => {
	it('is idle before the microphone runs', () => {
		expect(sessionPhase(null, at(1), plan, 0, true)).toBe('idle');
		expect(sessionPhase(start, at(1), plan, 0, false)).toBe('idle');
	});
	it('runs, then offers a break, then ends', () => {
		expect(sessionPhase(start, at(5), plan, 0, true)).toBe('running');
		expect(sessionPhase(start, at(10), plan, 0, true)).toBe('break-due');
		expect(sessionPhase(start, at(30), plan, 2, true)).toBe('over');
	});
	it('ends rather than offering a break at the very end', () => {
		expect(sessionPhase(start, at(30), plan, 0, true)).toBe('over');
	});
});

describe('the stop screen', () => {
	it('is required before anything starts', () => {
		expect(requiresStopScreen(false)).toBe(true);
		expect(requiresStopScreen(true)).toBe(false);
	});

	it('mentions the four warning signs and resting', () => {
		const text = STOP_SCREEN_LINES.join(' ').toLowerCase();
		for (const word of ['pain', 'strain', 'tightness', 'hoarseness', 'rest']) {
			expect(text).toContain(word);
		}
	});

	it('keeps the short banner genuinely short', () => {
		expect(PRACTICE_BANNER.split(' ').length).toBeLessThan(10);
	});

	it('uses no shaming or medical language', () => {
		const text = [...STOP_SCREEN_LINES, PRACTICE_BANNER].join(' ').toLowerCase();
		for (const word of ['fail', 'bad', 'damage', 'diagnose', 'cure']) {
			expect(text).not.toContain(word);
		}
	});
});
