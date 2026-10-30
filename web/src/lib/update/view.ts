/**
 * Decides what the Settings "About" section shows about updates.
 *
 * Pure: it takes what the app currently knows and returns one of a fixed set
 * of views, so every state in docs/update.md can be tested without a browser.
 */

export type UpdaterState = 'ready' | 'not_installed' | 'stale';

export interface VersionInfo {
	version: string;
	deployment: string;
	updater: { state: UpdaterState; heartbeat_at?: string };
}

export interface Available {
	current: string;
	latest: string;
	latest_digest: string;
	checked_at: string;
	update_available: boolean;
}

export interface UpdateResult {
	status: 'ok' | 'failed' | 'skipped';
	detail: string;
	target: string;
	finished_at: string;
}

export interface UpdateInputs {
	info: VersionInfo | null;
	available: Available | null;
	/** A check was requested and the watcher has not answered yet. */
	checkPending: boolean;
	/** An update was requested and the watcher has not finished yet. */
	updatePending: boolean;
	result: UpdateResult | null;
	/** When the user pressed Update in this page session (ms since epoch). */
	startedAt: number | null;
	/** The version running when the user pressed Update. */
	startedFromVersion: string | null;
	/** The version the running server reports right now. */
	runningVersion: string | null;
	/** The server could not be reached during an update (it is restarting). */
	serverUnreachable: boolean;
}

export type UpdateView =
	| { kind: 'loading' }
	| { kind: 'no_updater'; stale: boolean }
	| { kind: 'checking' }
	| { kind: 'up_to_date'; checkedAt: string | null }
	| { kind: 'available'; latest: string }
	| { kind: 'updating' }
	| { kind: 'done'; version: string }
	| { kind: 'failed'; detail: string; rollbackFailed: boolean };

/** Slack for clock differences between the phone and the potato. */
const CLOCK_SLACK_MS = 60_000;

export function deriveView(i: UpdateInputs): UpdateView {
	if (!i.info) return { kind: 'loading' };

	const started = i.startedAt !== null;

	// Outcome of an update started from this screen.
	if (started && !i.updatePending) {
		const finished = i.result ? Date.parse(i.result.finished_at) : Number.NaN;
		const isThisRun = Number.isFinite(finished) && finished >= (i.startedAt ?? 0) - CLOCK_SLACK_MS;
		if (i.result && isThisRun && i.result.status === 'failed') {
			return {
				kind: 'failed',
				detail: i.result.detail,
				rollbackFailed: rollbackAlsoFailed(i.result.detail)
			};
		}
		const changed =
			i.runningVersion !== null &&
			i.startedFromVersion !== null &&
			i.runningVersion !== i.startedFromVersion;
		if (changed) return { kind: 'done', version: i.runningVersion as string };
		if (i.result && isThisRun && i.result.status === 'ok' && i.runningVersion) {
			return { kind: 'done', version: i.runningVersion };
		}
	}

	if (started && (i.updatePending || i.serverUnreachable || !finishedSomething(i))) {
		return { kind: 'updating' };
	}

	if (i.info.updater.state !== 'ready' && !i.updatePending) {
		return { kind: 'no_updater', stale: i.info.updater.state === 'stale' };
	}
	if (i.updatePending) return { kind: 'updating' };
	if (i.checkPending) return { kind: 'checking' };
	if (i.available?.update_available) return { kind: 'available', latest: i.available.latest };
	return { kind: 'up_to_date', checkedAt: i.available?.checked_at ?? null };
}

function finishedSomething(i: UpdateInputs): boolean {
	return i.result !== null && Date.parse(i.result.finished_at) >= (i.startedAt ?? 0) - CLOCK_SLACK_MS;
}

/** The watcher words a double failure so it can be told apart. */
export function rollbackAlsoFailed(detail: string): boolean {
	const d = detail.toLowerCase();
	return d.includes('rollback') && d.includes('also failed');
}
