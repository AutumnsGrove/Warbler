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
 *   session and say so.
 */

import { eventLog } from '../eventlog.svelte';
import { dbToMeter, holdPeak, isClipping, rmsFromSums, smoothLevel, toDbfs } from '../dsp/level';

export type MicState = 'idle' | 'starting' | 'running' | 'paused' | 'denied' | 'error';

/** Newer browsers may report echo cancellation as a word ("all", "remote-only") rather than yes or no. */
export interface GrantedSettings {
	echoCancellation?: boolean | string;
	noiseSuppression?: boolean | string;
	autoGainControl?: boolean | string;
	channelCount?: number;
	sampleRate?: number;
}

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
	private wakeLock: WakeLockSentinel | null = null;

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
			const streamPromise = navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: false,
					noiseSuppression: false,
					autoGainControl: false,
					channelCount: 1
				}
			});

			this.stream = await streamPromise;
			eventLog.add('Microphone permission granted');
			await resumed;

			const track = this.stream.getAudioTracks()[0];
			const s = track.getSettings();
			this.granted = {
				echoCancellation: s.echoCancellation,
				noiseSuppression: s.noiseSuppression,
				autoGainControl: s.autoGainControl,
				channelCount: s.channelCount,
				sampleRate: s.sampleRate
			};
			eventLog.add(`Granted settings: ${JSON.stringify(this.granted)}`);
			track.onended = () => this.interrupted('The microphone stopped');

			this.sampleRate = this.ctx.sampleRate;
			this.baseLatency = this.ctx.baseLatency ?? null;
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
			const source = this.ctx.createMediaStreamSource(this.stream);
			const mute = this.ctx.createGain();
			mute.gain.value = 0;
			source.connect(this.node);
			this.node.connect(mute);
			mute.connect(this.ctx.destination);

			this.ctx.onstatechange = () => this.onContextState();
			document.addEventListener('visibilitychange', this.onVisibility);
			await this.requestWakeLock();
			this.state = 'running';
		} catch (err) {
			this.fail(err);
		}
	}

	async stop(): Promise<void> {
		document.removeEventListener('visibilitychange', this.onVisibility);
		this.node?.disconnect();
		this.node = null;
		this.stream?.getTracks().forEach((t) => t.stop());
		this.stream = null;
		await this.wakeLock?.release().catch(() => {});
		this.wakeLock = null;
		await this.ctx?.close().catch(() => {});
		this.ctx = null;
		this.level = 0;
		this.peak = 0;
		this.db = -60;
		this.clipping = false;
		this.state = 'idle';
		eventLog.add('Stopped');
	}

	/** Try to continue after an interruption. Must be called from a tap. */
	async resume(): Promise<void> {
		try {
			await this.ctx?.resume();
			await this.requestWakeLock();
			this.state = this.ctx?.state === 'running' ? 'running' : this.state;
			eventLog.add('Resumed');
		} catch (err) {
			this.fail(err);
		}
	}

	private onLevel(m: { sumSq: number; count: number; peak: number }): void {
		const db = toDbfs(rmsFromSums(m.sumSq, m.count));
		this.db = db;
		this.level = smoothLevel(this.level, dbToMeter(db));
		this.peak = holdPeak(this.peak, dbToMeter(toDbfs(m.peak)));
		this.clipping = isClipping(m.peak);
	}

	private onContextState(): void {
		const s = this.ctx?.state as string | undefined;
		eventLog.add(`Audio state: ${s}`);
		// iOS reports "interrupted" for phone calls and similar.
		if (s === 'suspended' || s === 'interrupted') this.interrupted('Audio was interrupted');
		else if (s === 'running' && this.state === 'paused') this.state = 'running';
	}

	private onVisibility = (): void => {
		eventLog.add(document.visibilityState === 'hidden' ? 'App hidden' : 'App visible again');
		if (document.visibilityState === 'visible' && this.state === 'running') void this.requestWakeLock();
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
		this.stream?.getTracks().forEach((t) => t.stop());
		this.stream = null;
		await this.ctx?.close().catch(() => {});
		this.ctx = null;
	}
}

export const mic = new MicSession();
