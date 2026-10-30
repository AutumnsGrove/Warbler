// Runs on the browser's audio thread. It does as little as possible: add up
// the squared samples and find the biggest one, then report every ~50 ms.
// All the maths that turns this into a meter lives in src/lib/dsp/level.ts,
// where it can be tested.
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

registerProcessor('level-processor', LevelProcessor);
