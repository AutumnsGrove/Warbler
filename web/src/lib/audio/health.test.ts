import { describe, expect, it } from 'vitest';
import { LEVEL_TIMEOUT_MS, pauseReason, type AudioHealth } from './health';

const healthy: AudioHealth = {
	hidden: false,
	contextState: 'running',
	trackState: 'live',
	trackMuted: false,
	msSinceLevel: 40
};

describe('pauseReason', () => {
	it('is null when everything is flowing', () => {
		expect(pauseReason(healthy)).toBeNull();
	});

	it('reports the app being in the background first', () => {
		expect(pauseReason({ ...healthy, hidden: true, trackMuted: true })).toMatch(/background/);
	});

	it('notices an ended track', () => {
		expect(pauseReason({ ...healthy, trackState: 'ended' })).toMatch(/stopped/);
	});

	it('notices a muted track even though the context still says running', () => {
		expect(pauseReason({ ...healthy, trackMuted: true })).toMatch(/muted/);
	});

	it.each(['suspended', 'interrupted', 'closed'])('notices a %s context', (contextState) => {
		expect(pauseReason({ ...healthy, contextState })).toMatch(/interrupted/);
	});

	it('notices when level readings stop arriving, whatever else says', () => {
		expect(pauseReason({ ...healthy, msSinceLevel: LEVEL_TIMEOUT_MS + 1 })).toMatch(/No sound/);
	});

	it('allows a little quiet before judging', () => {
		expect(pauseReason({ ...healthy, msSinceLevel: LEVEL_TIMEOUT_MS })).toBeNull();
	});
});
