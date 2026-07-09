import { BaseMode } from "./BaseMode.js";
import { ExponentialMovingAverage } from "./ExponentialMovingAverage.js";
import { ColorConverter } from "./ColorConverter.js";

function luminance(color) {
	const r = (color >> 16) & 0xff;
	const g = (color >> 8) & 0xff;
	const b = color & 0xff;
	const rLin = r / 255;
	const gLin = g / 255;
	const bLin = b / 255;
	return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

export class HFFax extends BaseMode {
	constructor(sampleRate) {
		super();
		this.name = "HF Fax";
		this.lowPassFilter = new ExponentialMovingAverage();
		this.sampleRate = sampleRate;
		this.cumulated = new Float32Array(this.getWidth());
		this.horizontalShift = 0;
	}

	freqToLevel(frequency, offset) {
		return 0.5 * (frequency - offset + 1.0);
	}

	getName() { return this.name; }
	getVISCode() { return -1; }
	getWidth() { return 640; }
	getHeight() { return 1200; }
	getFirstPixelSampleIndex() { return 0; }
	getFirstSyncPulseIndex() { return -1; }
	getScanLineSamples() { return this.sampleRate / 2; }

	resetState() {}

	postProcessScopeImage(bmp) {
		return bmp;
	}

	decodeScanLine(pixelBuffer, scratchBuffer, scanLineBuffer, scopeBufferWidth, syncPulseIndex, scanLineSamples, frequencyOffset) {
		if (syncPulseIndex < 0 || syncPulseIndex + scanLineSamples > scanLineBuffer.length)
			return false;
		const horizontalPixels = this.getWidth();
		this.lowPassFilter.cutoff(horizontalPixels, 2 * scanLineSamples, 2);
		this.lowPassFilter.reset();
		for (let i = 0; i < scanLineSamples; ++i)
			scratchBuffer[i] = this.lowPassFilter.avg(scanLineBuffer[i]);
		this.lowPassFilter.reset();
		for (let i = scanLineSamples - 1; i >= 0; --i)
			scratchBuffer[i] = this.freqToLevel(this.lowPassFilter.avg(scratchBuffer[i]), frequencyOffset);
		for (let i = 0; i < horizontalPixels; ++i) {
			const position = ((i * scanLineSamples) / horizontalPixels) | 0;
			const color = ColorConverter.GRAY(scratchBuffer[position]);
			pixelBuffer.pixels[i] = color;
			const decay = 0.99;
			this.cumulated[i] = this.cumulated[i] * decay + luminance(color) * (1 - decay);
		}
		let bestIndex = 0;
		let bestValue = 0;
		for (let x = 0; x < this.getWidth(); ++x) {
			const val = this.cumulated[x];
			if (val > bestValue) {
				bestIndex = x;
				bestValue = val;
			}
		}
		this.horizontalShift = bestIndex;
		pixelBuffer.width = horizontalPixels;
		pixelBuffer.height = 1;
		return true;
	}
}
