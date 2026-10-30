import { describe, expect, it } from 'vitest';
import { deriveView, rollbackAlsoFailed, type UpdateInputs, type VersionInfo } from './view';

const ready: VersionInfo = { version: 'r1.aaa', deployment: 'docker', updater: { state: 'ready' } };
const T0 = Date.parse('2026-10-30T12:00:00Z');

function inputs(over: Partial<UpdateInputs> = {}): UpdateInputs {
	return {
		info: ready,
		available: null,
		checkPending: false,
		updatePending: false,
		result: null,
		startedAt: null,
		startedFromVersion: null,
		runningVersion: 'r1.aaa',
		serverUnreachable: false,
		now: T0 + 5_000,
		...over
	};
}

describe('deriveView', () => {
	it('is loading until the version is known', () => {
		expect(deriveView(inputs({ info: null })).kind).toBe('loading');
	});

	it('says there is no updater when the watcher is missing or silent', () => {
		const missing = deriveView(inputs({ info: { ...ready, updater: { state: 'not_installed' } } }));
		expect(missing).toEqual({ kind: 'no_updater', stale: false });
		const stale = deriveView(inputs({ info: { ...ready, updater: { state: 'stale' } } }));
		expect(stale).toEqual({ kind: 'no_updater', stale: true });
	});

	it('is up to date, remembering when it last checked', () => {
		const v = deriveView(
			inputs({
				available: {
					current: 'r1.aaa',
					latest: 'r1.aaa',
					latest_digest: 'sha256:x',
					checked_at: '2026-10-30T11:00:00Z',
					update_available: false
				}
			})
		);
		expect(v).toEqual({ kind: 'up_to_date', checkedAt: '2026-10-30T11:00:00Z' });
	});

	it('offers an update when one is available', () => {
		const v = deriveView(
			inputs({
				available: {
					current: 'r1.aaa',
					latest: 'r2.bbb',
					latest_digest: 'sha256:y',
					checked_at: 'x',
					update_available: true
				}
			})
		);
		expect(v).toEqual({ kind: 'available', latest: 'r2.bbb' });
	});

	it('shows checking while the watcher has not answered', () => {
		expect(deriveView(inputs({ checkPending: true })).kind).toBe('checking');
	});

	it('shows updating while the request is pending', () => {
		expect(deriveView(inputs({ updatePending: true })).kind).toBe('updating');
	});

	it('keeps showing updating while the server restarts', () => {
		const v = deriveView(inputs({ startedAt: T0, startedFromVersion: 'r1.aaa', serverUnreachable: true }));
		expect(v.kind).toBe('updating');
	});

	it('is done once the running version changes', () => {
		const v = deriveView(inputs({ startedAt: T0, startedFromVersion: 'r1.aaa', runningVersion: 'r2.bbb' }));
		expect(v).toEqual({ kind: 'done', version: 'r2.bbb' });
	});

	it('reports a failed update with the reason', () => {
		const v = deriveView(
			inputs({
				startedAt: T0,
				startedFromVersion: 'r1.aaa',
				result: { status: 'failed', detail: 'docker compose pull failed', target: 't', finished_at: '2026-10-30T12:00:30Z' }
			})
		);
		expect(v).toEqual({ kind: 'failed', detail: 'docker compose pull failed', rollbackFailed: false });
	});

	it('tells a double failure apart', () => {
		const v = deriveView(
			inputs({
				startedAt: T0,
				startedFromVersion: 'r1.aaa',
				result: {
					status: 'failed',
					detail: 'update failed AND rollback to the previous image also failed',
					target: 't',
					finished_at: '2026-10-30T12:00:30Z'
				}
			})
		);
		expect(v).toMatchObject({ kind: 'failed', rollbackFailed: true });
	});

	it('ignores a failure left over from an earlier run', () => {
		const v = deriveView(
			inputs({
				startedAt: T0,
				startedFromVersion: 'r1.aaa',
				result: { status: 'failed', detail: 'old', target: 't', finished_at: '2026-10-29T08:00:00Z' }
			})
		);
		expect(v.kind).toBe('updating');
	});

	it('ignores old results when no update was started here', () => {
		const v = deriveView(
			inputs({ result: { status: 'failed', detail: 'old', target: 't', finished_at: '2026-10-29T08:00:00Z' } })
		);
		expect(v.kind).toBe('up_to_date');
	});
});

describe('no answer', () => {
	const started = { startedAt: T0, startedFromVersion: 'r1.aaa' };

	it('keeps saying updating for a while after the request disappears', () => {
		expect(deriveView(inputs({ ...started, now: T0 + 30_000 })).kind).toBe('updating');
	});

	it('says there was no answer rather than spinning forever', () => {
		const v = deriveView(inputs({ ...started, now: T0 + 120_000 }));
		expect(v).toMatchObject({ kind: 'failed', rollbackFailed: false });
		expect((v as { detail: string }).detail).toContain('without saying why');
	});

	it('does not give up while the server is still restarting', () => {
		expect(deriveView(inputs({ ...started, serverUnreachable: true, now: T0 + 600_000 })).kind).toBe('updating');
	});

	it('does not give up while the watcher is still working', () => {
		expect(deriveView(inputs({ ...started, updatePending: true, now: T0 + 600_000 })).kind).toBe('updating');
	});
});

describe('rollbackAlsoFailed', () => {
	it('matches the watcher wording only', () => {
		expect(rollbackAlsoFailed('update failed AND rollback to the previous image also failed')).toBe(true);
		expect(rollbackAlsoFailed('docker compose pull failed')).toBe(false);
	});
});
