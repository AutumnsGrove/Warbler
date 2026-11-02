/**
 * Microphone session for the Phase 0 volume meter.
 *
 * What matters here, and why:
 * - The AudioContext is created and resumed inside the tap handler. iOS only
 *   allows audio to start from a user tap.
 * - The sample rate is read from the context, never assumed.
 * - Echo cancellation, noise suppression and automatic gain are asked to be
 *   off, because they distort pitch measurements later. The settings the
 *   browser actually granted are recorded, since iOS may ignore the request.
 * - Interruptions (a phone call, the app going to the background) pause the
 *   session and say so. iOS can stop the microphone on lock or app switch
 *   without a clear signal, so three things guard against a silent stop:
 *   the track's mute and ended events, the app being hidden (which always
 *   needs a tap on Resume afterwards), and a once-a-half-second check that
 *   level readings are still arriving (see health.ts).
 */

import { eventLog } from '../eventlog.svelte';
import { dbToMeter, holdPeak, isClipping, rmsFromSums, smoothLevel, toDbfs } from '../dsp/level';
import { pauseReason } from './health';

export type MicState = 'idle' | 'starting' | 'running' | 'paused' | 'denied' | 'error';

/** Newer browsers may report echo cancellation as a word ("all", "remote-only") rather than yes or no. */
export interface GrantedSettings {
	echoCancellation?: boolean | string;
	noiseSuppression?: boolean | string;
	autoGainControl?: boolean | string;
	channelCount?: number;
	sampleRate?: number;
}

/** Raw sound, with the phone's own clean-up switched off, because it would distort pitch. */
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
	echoCancellation: false,
	noiseSuppression: false,
	autoGainControl: false,
	channelCount: 1
};

class MicSession {
	state = $state<MicState>('idle');
	/** Smoothed level, 0 to 1, for drawing the meter. */
	level = $state(0);
	/** Held peak, 0 to 1. */
	peak = $state(0);
	db = $state(-60);
	clipping = $state(false);
	sampleRate = $state<number | null>(null);
	baseLatency = $state<number | null>(null);
	granted = $state<GrantedSettings | null>(null);
	message = $state('');

	private ctx: AudioContext | null = null;
	private stream: MediaStream | null = null;
	private node: AudioWorkletNode | null = null;
	private source: MediaStreamAudioSourceNode | null = null;
	private wakeLock: WakeLockSentinel | null = null;
	private watchdog: ReturnType<typeof setInterval> | null = null;
	/** When the last level reading arrived (performance.now clock). */
	private lastLevelAt = 0;
	/** Set when the app was hidden: audio may be dead, so only a tap on Resume may continue. */
	private needsTap = false;
	private lastResumeAt = 0;

	get active(): boolean {
		return this.state === 'running' || this.state === 'paused' || this.state === 'starting';
	}

	/** Must be called directly from a tap handler. */
	async start(): Promise<void> {
		if (this.active) return;
		this.state = 'starting';
		this.message = '';
		try {
			// Both of these must begin before the first `await`, while the tap is still "fresh".
			const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
			this.ctx = new Ctx();
			const resumed = this.ctx.resume();
			const streamPromise = navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });

			this.stream = await streamPromise;
			eventLog.add('Microphone permission granted');
			await resumed;

			this.bindTrack(this.stream);

			this.sampleRate = this.ctx.sampleRate;
			// Some browsers report 0 here, which means "not measured", not "instant".
			this.baseLatency = this.ctx.baseLatency ? this.ctx.baseLatency : null;
			eventLog.add(`Audio running at ${this.ctx.sampleRate} Hz`);

			await this.ctx.audioWorklet.addModule('/level-worklet.js');
			this.node = new AudioWorkletNode(this.ctx, 'level-processor', {
				numberOfInputs: 1,
				numberOfOutputs: 1,
				channelCount: 1
			});
			this.node.port.onmessage = (e: MessageEvent<{ sumSq: number; count: number; peak: number }>) =>
				this.onLevel(e.data);

			// The worklet is routed to the speakers through a gain of zero. Some
			// browsers only run audio nodes that lead to the output, and zero
			// gain means nothing is heard (so no feedback).
			const mute = this.ctx.createGain();
			mute.gain.value = 0;
			this.node.connect(mute);
			mute.connect(this.ctx.destination);
			this.connectSource();

			this.ctx.onstatechange = () => this.onContextState();
			document.addEventListener('visibilitychange', this.onVisibility);
			this.lastLevelAt = performance.now();
			this.needsTap = false;
			this.watchdog = setInterval(() => this.check(), 500);
			await this.requestWakeLock();
			this.state = 'running';
		} catch (err) {
			this.fail(err);
		}
	}

	async stop(): Promise<void> {
		this.stopWatching();
		this.needsTap = false;
		this.source?.disconnect();
		this.source = null;
		this.node?.disconnect();
		this.node = null;
		this.stream?.getTracks().forEach((t) => t.stop());
		this.stream = null;
		await this.wakeLock?.release().catch(() => {});
		this.wakeLock = null;
		if (this.ctx) this.ctx.onstatechange = null;
		await this.ctx?.close().catch(() => {});
		this.ctx = null;
		this.level = 0;
		this.peak = 0;
		this.db = -60;
		this.clipping = false;
		this.state = 'idle';
		eventLog.add('Stopped');
	}

	/**
	 * Try to continue after an interruption. Must be called from a tap.
	 *
	 * If the microphone track is dead, or the last Resume (under 5 seconds ago)
	 * did not bring sound back, ask the phone for a fresh microphone stream.
	 */
	async resume(): Promise<void> {
		if (this.state !== 'paused') return;
		const repeat = performance.now() - this.lastResumeAt < 5000;
		this.lastResumeAt = performance.now();
		this.needsTap = false;
		try {
			await this.ctx?.resume();
			const track = this.stream?.getAudioTracks()[0];
			if (repeat || !track || track.readyState !== 'live' || track.muted) await this.reacquire();
			this.lastLevelAt = performance.now();
			await this.requestWakeLock();
			this.message = '';
			this.state = 'running';
			eventLog.add('Resumed');
		} catch (err) {
			this.fail(err);
		}
	}

	/** Swap in a fresh microphone stream, keeping the same audio context and worklet. */
	private async reacquire(): Promise<void> {
		const next = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
		this.stream?.getTracks().forEach((t) => t.stop());
		this.stream = next;
		this.bindTrack(next);
		this.connectSource();
		eventLog.add('Microphone reconnected');
	}

	/** Record what the phone granted and listen for the track stopping or being muted. */
	private bindTrack(stream: MediaStream): void {
		const track = stream.getAudioTracks()[0];
		const s = track.getSettings();
		this.granted = {
			echoCancellation: s.echoCancellation,
			noiseSuppression: s.noiseSuppression,
			autoGainControl: s.autoGainControl,
			channelCount: s.channelCount,
			sampleRate: s.sampleRate
		};
		eventLog.add(`Granted settings: ${JSON.stringify(this.granted)}`);
		track.onended = () => this.interrupted('The microphone stopped.');
		// iOS mutes the track (it sends silence) when the screen locks or another app takes over.
		track.onmute = () => this.interrupted('The phone muted the microphone.');
		track.onunmute = () => eventLog.add('Microphone unmuted by the phone');
	}

	/** Route the current stream into the worklet, replacing any earlier source. */
	private connectSource(): void {
		if (!this.ctx || !this.stream || !this.node) return;
		this.source?.disconnect();
		this.source = this.ctx.createMediaStreamSource(this.stream);
		this.source.connect(this.node);
	}

	/**
	 * Compare what the phone says with what is actually arriving, and pause or
	 * un-pause to match. Runs twice a second and on every relevant event.
	 */
	private check(): void {
		if (!this.ctx) return;
		const track = this.stream?.getAudioTracks()[0];
		const reason = pauseReason({
			hidden: document.visibilityState === 'hidden',
			contextState: this.ctx.state as string,
			trackState: track?.readyState ?? 'ended',
			trackMuted: track?.muted ?? true,
			msSinceLevel: performance.now() - this.lastLevelAt
		});
		if (reason) this.interrupted(reason);
		else if (this.state === 'paused' && !this.needsTap) {
			this.state = 'running';
			this.message = '';
			eventLog.add('Audio is flowing again');
		}
	}

	private stopWatching(): void {
		if (this.watchdog) clearInterval(this.watchdog);
		this.watchdog = null;
		document.removeEventListener('visibilitychange', this.onVisibility);
	}

	private onLevel(m: { sumSq: number; count: number; peak: number }): void {
		this.lastLevelAt = performance.now();
		const db = toDbfs(rmsFromSums(m.sumSq, m.count));
		this.db = db;
		this.level = smoothLevel(this.level, dbToMeter(db));
		this.peak = holdPeak(this.peak, dbToMeter(toDbfs(m.peak)));
		this.clipping = isClipping(m.peak);
	}

	private onContextState(): void {
		// Closing the context fires one last state event after we have let go of it.
		if (!this.ctx) return;
		const s = this.ctx.state as string;
		eventLog.add(`Audio state: ${s}`);
		// iOS reports "interrupted" for phone calls and similar.
		this.check();
	}

	private onVisibility = (): void => {
		const hidden = document.visibilityState === 'hidden';
		eventLog.add(hidden ? 'App hidden' : 'App visible again');
		// Audio often dies silently while hidden, so coming back always needs a tap on Resume.
		if (hidden) {
			this.needsTap = true;
			this.check();
		}
	};

	private interrupted(why: string): void {
		if (this.state === 'running') {
			this.state = 'paused';
			this.message = why;
			eventLog.add(why);
		}
	}

	private async requestWakeLock(): Promise<void> {
		try {
			if ('wakeLock' in navigator) {
				this.wakeLock = await navigator.wakeLock.request('screen');
				eventLog.add('Screen wake lock held');
			} else {
				eventLog.add('Screen wake lock not available');
			}
		} catch {
			eventLog.add('Screen wake lock refused');
		}
	}

	private fail(err: unknown): void {
		const name = err instanceof DOMException ? err.name : '';
		if (name === 'NotAllowedError' || name === 'SecurityError') {
			this.state = 'denied';
			this.message = 'Microphone access was not allowed.';
		} else if (name === 'NotFoundError') {
			this.state = 'error';
			this.message = 'No microphone was found.';
		} else {
			this.state = 'error';
			this.message = err instanceof Error ? err.message : 'Something went wrong starting the microphone.';
		}
		eventLog.add(`Could not start: ${name || this.message}`);
		void this.cleanupAfterFailure();
	}

	private async cleanupAfterFailure(): Promise<void> {
		this.stopWatching();
		this.stream?.getTracks().forEach((t) => t.stop());
		this.stream = null;
		await this.ctx?.close().catch(() => {});
		this.ctx = null;
	}
}

export const mic = new MicSession();
