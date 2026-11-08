// Runs on the browser's audio thread, where the sound itself lives.
//
// Two jobs here, and both do as little as possible:
//   level-processor: adds up squared samples for the volume meter.
//   pitch-processor: copies the raw sound and hands it over in roughly 50 ms
//                    pieces, for a Web Worker to analyse.
//
// All the maths lives in src/lib/dsp/, where vitest can test it. Nothing in
// this file is clever, on purpose: code in here cannot be unit-tested, so it
// should only move numbers about.

class LevelProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.sumSq = 0;
		this.count = 0;
		this.peak = 0;
		this.blocks = 0;
		// 128 samples per block; report about every 50 ms whatever the sample rate.
		this.blocksPerReport = Math.max(1, Math.round((sampleRate * 0.05) / 128));
	}

	process(inputs) {
		const channel = inputs[0] && inputs[0][0];
		if (channel) {
			for (let i = 0; i < channel.length; i++) {
				const v = channel[i];
				this.sumSq += v * v;
				const a = v < 0 ? -v : v;
				if (a > this.peak) this.peak = a;
			}
			this.count += channel.length;
		}
		this.blocks++;
		if (this.blocks >= this.blocksPerReport) {
			this.port.postMessage({ sumSq: this.sumSq, count: this.count, peak: this.peak });
			this.sumSq = 0;
			this.count = 0;
			this.peak = 0;
			this.blocks = 0;
		}
		return true;
	}
}

class PitchProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.blocksPerSend = Math.max(1, Math.round((sampleRate * 0.05) / 128));
		this.buffer = new Float32Array(this.blocksPerSend * 128);
		this.at = 0;
		this.blocks = 0;
	}

	/** Send what has been collected, as a copy the main thread may keep. */
	flush() {
		if (this.at === 0) return;
		const piece = this.buffer.slice(0, this.at);
		// The buffer is handed over rather than copied: cheaper for the phone.
		this.port.postMessage({ samples: piece }, [piece.buffer]);
		this.buffer = new Float32Array(this.blocksPerSend * 128);
		this.at = 0;
		this.blocks = 0;
	}

	process(inputs) {
		const channel = inputs[0] && inputs[0][0];
		if (channel) {
			for (let i = 0; i < channel.length && this.at < this.buffer.length; i++) {
				this.buffer[this.at++] = channel[i];
			}
		}
		this.blocks++;
		if (this.blocks >= this.blocksPerSend || this.at >= this.buffer.length) this.flush();
		return true;
	}
}

registerProcessor('level-processor', LevelProcessor);
registerProcessor('pitch-processor', PitchProcessor);
