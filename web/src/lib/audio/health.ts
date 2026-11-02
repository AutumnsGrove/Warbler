/**
 * Is the microphone still delivering sound?
 *
 * On an iPhone, locking the screen or switching apps can stop the microphone
 * without any single clear signal, so the session looks at several things at
 * once. This is a pure function (no browser objects) so it can be tested.
 */

export interface AudioHealth {
	/** The app is in the background or the screen is locked. */
	hidden: boolean;
	/** The audio context's state: "running", "suspended", "interrupted" or "closed". */
	contextState: string;
	/** The microphone track's state: "live" or "ended". */
	trackState: string;
	/** The phone has muted the microphone track (it sends silence). */
	trackMuted: boolean;
	/** Milliseconds since the last level reading arrived from the audio thread. */
	msSinceLevel: number;
}

/** The audio thread reports about every 50 ms, so this much quiet means it has stopped. */
export const LEVEL_TIMEOUT_MS = 1500;

/**
 * The plain-language reason audio is not flowing, or null when it is healthy.
 * The order matters: the most useful explanation comes first.
 */
export function pauseReason(h: AudioHealth): string | null {
	if (h.hidden) return 'The app was in the background.';
	if (h.trackState !== 'live') return 'The microphone stopped.';
	if (h.trackMuted) return 'The phone muted the microphone.';
	if (h.contextState !== 'running') return 'Audio was interrupted.';
	if (h.msSinceLevel > LEVEL_TIMEOUT_MS) return 'No sound is coming in.';
	return null;
}
