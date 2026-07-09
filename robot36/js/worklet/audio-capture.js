class AudioCaptureProcessor extends AudioWorkletProcessor {
	constructor(options) {
		super();
		const opts = options.processorOptions || {};
		this.frameSamples = opts.frameSamples;
		this.stereo = !!opts.stereo;
		this.framePos = 0;
		this.pool = [];
		this.fillBuffer = null;
		this._resizeBuffers();

		this.port.onmessage = (e) => {
			const msg = e.data;
			if (msg.type === "setStereo") {
				this.stereo = !!msg.value;
				this.framePos = 0;
				this._resizeBuffers();
			} else if (msg.type === "release" && msg.buffer instanceof Float32Array) {
				this.pool.push(msg.buffer);
			}
		};
	}

	_resizeBuffers() {
		this.capacity = this.stereo ? this.frameSamples * 2 : this.frameSamples;
		this.pool = [new Float32Array(this.capacity), new Float32Array(this.capacity)];
		this.fillBuffer = this.pool.pop();
		this.framePos = 0;
	}

	process(inputs) {
		const input = inputs[0];
		if (!input || !input[0] || input[0].length === 0) return true;

		const len = input[0].length;
		for (let i = 0; i < len; i++) {
			if (this.stereo && input.length > 1) {
				this.fillBuffer[this.framePos++] = input[0][i];
				this.fillBuffer[this.framePos++] = input[1][i];
			} else {
				this.fillBuffer[this.framePos++] = input[0][i];
			}
			if (this.framePos >= this.capacity) {
				const sent = this.fillBuffer;
				this.port.postMessage({ type: "audio", buffer: sent }, [sent.buffer]);
				this.fillBuffer = this.pool.length > 0
					? this.pool.pop()
					: new Float32Array(this.capacity);
				this.framePos = 0;
			}
		}
		return true;
	}
}

registerProcessor("audio-capture", AudioCaptureProcessor);
