import { describe, expect, it } from 'vitest';
import {
	DEFAULT_SETTINGS,
	isVoiceOnly,
	needsSetup,
	practiceZone,
	sanitise,
	startZone,
	targetZone,
	validateSettings,
	type Settings
} from './settings';

function withZones(patch: Partial<Settings> = {}): Settings {
	return {
		...DEFAULT_SETTINGS,
		startLow: 110,
		startHigh: 140,
		targetLow: 190,
		targetHigh: 230,
		...patch
	};
}

describe('default settings', () => {
	it('has no zones at all, because nobody has said anything about their voice yet', () => {
		expect(DEFAULT_SETTINGS.startLow).toBeNull();
		expect(DEFAULT_SETTINGS.startHigh).toBeNull();
		expect(DEFAULT_SETTINGS.targetLow).toBeNull();
		expect(DEFAULT_SETTINGS.targetHigh).toBeNull();
		expect(startZone(DEFAULT_SETTINGS)).toBeNull();
		expect(targetZone(DEFAULT_SETTINGS)).toBeNull();
	});

	it('suggests a gentle 25 percent ramp', () => {
		expect(DEFAULT_SETTINGS.rampPercent).toBe(25);
	});

	it('starts with the safety defaults from the plan', () => {
		expect(DEFAULT_SETTINGS.sessionMinutes).toBe(30);
		expect(DEFAULT_SETTINGS.breakMinutes).toBe(10);
	});

	it('asks for setup before drawing any zone', () => {
		expect(needsSetup(DEFAULT_SETTINGS)).toBe(true);
		expect(needsSetup(withZones())).toBe(false);
	});
});

describe('practiceZone', () => {
	it('draws the ramped band, never the target itself', () => {
		const zone = practiceZone(withZones({ rampPercent: 25 }));
		expect(zone).not.toBeNull();
		// Target centre is 210 Hz; a 25 percent ramp from 125 Hz must sit well below it.
		expect((zone!.low + zone!.high) / 2).toBeLessThan(160);
	});

	it('needs both zones before drawing anything', () => {
		expect(practiceZone(withZones({ targetLow: null, targetHigh: null }))).toBeNull();
		expect(practiceZone(withZones({ startLow: null }))).toBeNull();
	});

	it('draws nothing in voice-only mode, even when zones exist', () => {
		expect(practiceZone(withZones({ voiceOnly: true }))).toBeNull();
		expect(isVoiceOnly(withZones({ voiceOnly: true }))).toBe(true);
	});

	it('stays quiet when a zone is upside down', () => {
		expect(practiceZone(withZones({ startLow: 200, startHigh: 100 }))).toBeNull();
	});
});

describe('sanitise', () => {
	it('falls back to the defaults when given nothing usable', () => {
		expect(sanitise(null)).toEqual(DEFAULT_SETTINGS);
		expect(sanitise({})).toEqual(DEFAULT_SETTINGS);
		expect(sanitise({ startLow: 'nonsense' as unknown as number })).toEqual(DEFAULT_SETTINGS);
	});

	it('keeps good values', () => {
		const saved = sanitise({ startLow: 110, startHigh: 140, rampPercent: 40, showNoteNames: false });
		expect(saved.startLow).toBe(110);
		expect(saved.startHigh).toBe(140);
		expect(saved.rampPercent).toBe(40);
		expect(saved.showNoteNames).toBe(false);
	});

	it('clamps numbers that are out of range instead of trusting them', () => {
		const saved = sanitise({ minHz: 10, maxHz: 9999, sessionMinutes: 10_000, rampPercent: 840 });
		expect(saved.minHz).toBeGreaterThanOrEqual(50);
		expect(saved.maxHz).toBeLessThanOrEqual(1200);
		expect(saved.sessionMinutes).toBeLessThanOrEqual(120);
		expect(saved.rampPercent).toBe(100);
	});

	it('drops negative and zero frequencies', () => {
		const saved = sanitise({ startLow: -20, startHigh: 0 });
		expect(saved.startLow).toBeNull();
		expect(saved.startHigh).toBeNull();
	});

	it('never turns voice-only on by accident', () => {
		expect(sanitise({ voiceOnly: 'yes' as unknown as boolean }).voiceOnly).toBe(false);
	});
});

describe('validateSettings', () => {
	it('accepts settings with nothing set yet', () => {
		expect(validateSettings(DEFAULT_SETTINGS)).toEqual([]);
	});

	it('asks for both numbers when only one is given', () => {
		const problems = validateSettings(withZones({ startHigh: null }));
		expect(problems).toHaveLength(1);
		expect(problems[0].field).toBe('start');
	});

	it('explains an upside-down zone in plain words', () => {
		const problems = validateSettings(withZones({ targetLow: 240, targetHigh: 190 }));
		expect(problems[0].field).toBe('target');
		expect(problems[0].message).toContain('lower number first');
	});

	it('catches a pitch range that is the wrong way round', () => {
		const problems = validateSettings({ ...DEFAULT_SETTINGS, minHz: 400, maxHz: 300 });
		expect(problems.some((p) => p.field === 'range')).toBe(true);
	});

	it('catches a break reminder longer than the session', () => {
		const problems = validateSettings({ ...DEFAULT_SETTINGS, sessionMinutes: 5, breakMinutes: 10 });
		expect(problems.some((p) => p.field === 'break')).toBe(true);
	});

	it('never blames the person', () => {
		const words = ['wrong', 'fail', 'invalid', 'bad', 'error'];
		for (const problem of validateSettings(withZones({ targetLow: 10, targetHigh: 5, minHz: 900 }))) {
			for (const word of words) expect(problem.message.toLowerCase()).not.toContain(word);
		}
	});
});
