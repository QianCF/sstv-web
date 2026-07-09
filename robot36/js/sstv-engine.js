import { Decoder } from "./dsp/Decoder.js";
import { PixelBuffer } from "./dsp/PixelBuffer.js";
import { ShortTimeFourierTransform } from "./dsp/ShortTimeFourierTransform.js";
import { Complex } from "./dsp/Complex.js";

const FREQ_MARKERS = [1100, 1300, 1500, 2300];

export class SSTVEngine {
	constructor(sampleRate, options = {}) {
		this.channelSelect = options.channelSelect ?? 0;
		this.showSpectrogram = options.showSpectrogram ?? false;
		this.binWidthHz = options.binWidthHz ?? 10;
		this.fgColor = options.fgColor ?? 0xffffffff;
		this.thinColor = options.thinColor ?? 0xff808080;
		this.tintColor = options.tintColor ?? 0xff404040;

		this.scopeBuffer = new PixelBuffer(640, 2560);
		this.imageBuffer = new PixelBuffer(800, 616);
		this.waterfallBuffer = new PixelBuffer(256, 512);
		this.peakMeterBuffer = new PixelBuffer(1, 16);

		this.decoder = new Decoder(this.scopeBuffer, this.imageBuffer, "Raw", sampleRate);
		this.stft = new ShortTimeFourierTransform(Math.round(sampleRate / this.binWidthHz), 3);
		this.input = new Complex();
	}

	setMode(mode) {
		this.decoder.setMode(mode);
	}

	setChannel(channel) {
		this.channelSelect = channel;
	}

	setSpectrogram(value) {
		this.showSpectrogram = value;
	}

	stftInput(recordBuffer, j) {
		if (this.channelSelect === 0) {
			this.input.set(recordBuffer[j]);
			return;
		}
		switch (this.channelSelect) {
			case 1:
				this.input.set(recordBuffer[2 * j]);
				break;
			case 2:
				this.input.set(recordBuffer[2 * j + 1]);
				break;
			case 3:
				this.input.set(recordBuffer[2 * j] + recordBuffer[2 * j + 1]);
				break;
			case 4:
				this.input.set(recordBuffer[2 * j], recordBuffer[2 * j + 1]);
				break;
			default:
				this.input.set(recordBuffer[j]);
		}
	}

	processPeakMeter(recordBuffer) {
		const channels = this.channelSelect > 0 ? 2 : 1;
		const count = recordBuffer.length / channels;
		let max = 0;
		for (let i = 0; i < count; i++) {
			if (channels === 2) {
				max = Math.max(max, Math.abs(recordBuffer[2 * i]));
				max = Math.max(max, Math.abs(recordBuffer[2 * i + 1]));
			} else {
				max = Math.max(max, Math.abs(recordBuffer[i]));
			}
		}
		const pixels = this.peakMeterBuffer.height;
		let peak = pixels;
		if (max > 0)
			peak = Math.round(Math.min(Math.max(-Math.PI * Math.log(max), 0), pixels));
		this.peakMeterBuffer.pixels.fill(this.tintColor);
		this.peakMeterBuffer.pixels.fill(this.thinColor, 0, peak);
	}

	clamp(x) {
		return Math.min(Math.max(x, 0), 1);
	}

	argb(a, r, g, b) {
		a = this.clamp(a);
		r = this.clamp(r);
		g = this.clamp(g);
		b = this.clamp(b);
		r *= a;
		g *= a;
		b *= a;
		r = Math.sqrt(r);
		g = Math.sqrt(g);
		b = Math.sqrt(b);
		const A = Math.round(255 * a);
		const R = Math.round(255 * r);
		const G = Math.round(255 * g);
		const B = Math.round(255 * b);
		return (A << 24) | (R << 16) | (G << 8) | B;
	}

	rainbow(v) {
		v = this.clamp(v);
		const t = 4 * v - 2;
		return this.argb(4 * v, t, 1 - Math.abs(t), -t);
	}

	processSpectrogram(recordBuffer) {
		const channels = this.channelSelect > 0 ? 2 : 1;
		const count = recordBuffer.length / channels;
		let updated = false;
		for (let j = 0; j < count; j++) {
			this.stftInput(recordBuffer, j);
			if (!this.stft.push(this.input)) continue;
			updated = true;
			const stride = this.waterfallBuffer.width;
			this.waterfallBuffer.line =
				(this.waterfallBuffer.line + this.waterfallBuffer.height / 2 - 1) %
				(this.waterfallBuffer.height / 2);
			const line = stride * this.waterfallBuffer.line;
			const lowest = Math.log(1e-9);
			const highest = Math.log(1);
			const range = highest - lowest;
			const minFreq = 140;
			const minBin = minFreq / this.binWidthHz;
			for (let i = 0; i < stride; i++)
				this.waterfallBuffer.pixels[line + i] = this.rainbow(
					(Math.log(this.stft.power[i + minBin]) - lowest) / range,
				);
			for (const freq of FREQ_MARKERS)
				this.waterfallBuffer.pixels[line + (freq - minFreq) / this.binWidthHz] = this.fgColor;
			this.waterfallBuffer.pixels.copyWithin(
				line + stride * (this.waterfallBuffer.height / 2),
				line,
				line + stride,
			);
		}
		return updated;
	}

	processFreqPlot(recordBuffer) {
		const channels = this.channelSelect > 0 ? 2 : 1;
		const count = recordBuffer.length / channels;
		const stride = this.waterfallBuffer.width;
		this.waterfallBuffer.line =
			(this.waterfallBuffer.line + this.waterfallBuffer.height / 2 - 1) %
			(this.waterfallBuffer.height / 2);
		const line = stride * this.waterfallBuffer.line;
		const spread = 2;
		this.waterfallBuffer.pixels.fill(0, line, line + stride);
		for (let i = 0; i < count; i++) {
			const sample = recordBuffer[i];
			const x = Math.round((sample + 2.5) * 0.25 * stride);
			if (x >= spread && x < stride - spread)
				for (let j = -spread; j <= spread; j++)
					this.waterfallBuffer.pixels[line + x + j] += 1 + spread * spread - j * j;
		}
		const factor = 960 / count;
		for (let i = 0; i < stride; i++)
			this.waterfallBuffer.pixels[line + i] =
				0x00ffffff & this.fgColor | Math.min(factor * this.waterfallBuffer.pixels[line + i], 255) << 24;
		this.waterfallBuffer.pixels.copyWithin(
			line + stride * (this.waterfallBuffer.height / 2),
			line,
			line + stride,
		);
		return true;
	}

	/** 仅处理音频/解码，不复制像素缓冲（与 Android 回调线程行为一致） */
	processFrame(recordBuffer) {
		this.processPeakMeter(recordBuffer);
		let waterfallDirty = false;
		if (this.showSpectrogram)
			waterfallDirty = this.processSpectrogram(recordBuffer);

		const newLines = this.decoder.process(recordBuffer, this.channelSelect);

		if (!this.showSpectrogram)
			waterfallDirty = this.processFreqPlot(recordBuffer);

		let image = null;
		if (newLines && this.imageBuffer.line >= this.imageBuffer.height) {
			image = {
				pixels: this.imageBuffer.pixels.slice(),
				width: this.imageBuffer.width,
				height: this.imageBuffer.height,
			};
			this.imageBuffer.line = -1;
		}

		return {
			newLines,
			waterfallDirty,
			mode: this.decoder.currentMode.getName(),
			image,
		};
	}
}

export function frameSampleCount(sampleRate) {
	return Math.max(128, Math.round(sampleRate / 50));
}
