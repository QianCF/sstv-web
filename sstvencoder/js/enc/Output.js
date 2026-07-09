export const SAMPLE_RATE = 44100;

export class SampleCollector {
	constructor(sampleRate = SAMPLE_RATE) {
		this.sampleRate = sampleRate;
		this.chunks = [];
		this.chunk = null;
		this.pos = 0;
		this.written = 0;
		this.totalSamples = 0;
	}

	init(samples) {
		this.chunks = [];
		this.chunk = new Float32Array(Math.min(65536, Math.max(8192, samples / 10 | 0)));
		this.pos = 0;
		this.written = 0;
		this.totalSamples = samples;
	}

	getSampleRate() { return this.sampleRate; }

	write(value) {
		if (this.pos >= this.chunk.length) {
			this.chunks.push(this.chunk);
			this.chunk = new Float32Array(this.chunk.length);
			this.pos = 0;
		}
		this.chunk[this.pos++] = value;
		++this.written;
	}

	finish(cancel) {
		if (!cancel && this.pos > 0) {
			this.chunks.push(this.chunk.subarray(0, this.pos));
			this.pos = 0;
		}
	}

	toFloat32Array() {
		const out = new Float32Array(this.written);
		let off = 0;
		for (const c of this.chunks) {
			out.set(c, off);
			off += c.length;
		}
		if (this.pos > 0)
			out.set(this.chunk.subarray(0, this.pos), off);
		return out;
	}

	toWav() {
		const offset = Math.round(0.01 * this.sampleRate / 2.0);
		const samples = this.written + 2 * offset;
		const dataBytes = samples * 2;
		const buf = new ArrayBuffer(44 + dataBytes);
		const view = new DataView(buf);
		const pcm = this.toFloat32Array();

		writeStr(view, 0, "RIFF");
		view.setUint32(4, 36 + dataBytes, true);
		writeStr(view, 8, "WAVE");
		writeStr(view, 12, "fmt ");
		view.setUint32(16, 16, true);
		view.setUint16(20, 1, true);
		view.setUint16(22, 1, true);
		view.setUint32(24, this.sampleRate, true);
		view.setUint32(28, this.sampleRate * 2, true);
		view.setUint16(32, 2, true);
		view.setUint16(34, 16, true);
		writeStr(view, 36, "data");
		view.setUint32(40, dataBytes, true);

		let p = 44;
		for (let i = 0; i < offset; ++i) {
			view.setInt16(p, 0, true);
			p += 2;
		}
		for (let i = 0; i < pcm.length; ++i) {
			const s = Math.max(-1, Math.min(1, pcm[i]));
			view.setInt16(p, (s * 32767) | 0, true);
			p += 2;
		}
		while (p < 44 + dataBytes) {
			view.setInt16(p, 0, true);
			p += 2;
		}
		return buf;
	}
}

function writeStr(view, offset, str) {
	for (let i = 0; i < str.length; ++i)
		view.setUint8(offset + i, str.charCodeAt(i));
}
