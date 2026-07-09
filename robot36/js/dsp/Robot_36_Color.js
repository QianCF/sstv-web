import { BaseMode } from "./BaseMode.js";
import { ExponentialMovingAverage } from "./ExponentialMovingAverage.js";
import { ColorConverter } from "./ColorConverter.js";

export class Robot_36_Color extends BaseMode {
	constructor(sampleRate) {
		super();
		this.horizontalPixels = 320;
		this.verticalPixels = 240;
		const syncPulseSeconds = 0.009;
		const syncPorchSeconds = 0.003;
		const luminanceSeconds = 0.088;
		const separatorSeconds = 0.0045;
		const porchSeconds = 0.0015;
		const chrominanceSeconds = 0.044;
		const scanLineSeconds = syncPulseSeconds + syncPorchSeconds + luminanceSeconds + separatorSeconds + porchSeconds + chrominanceSeconds;
		this.scanLineSamples = Math.round(scanLineSeconds * sampleRate);
		this.luminanceSamples = Math.round(luminanceSeconds * sampleRate);
		this.separatorSamples = Math.round(separatorSeconds * sampleRate);
		this.chrominanceSamples = Math.round(chrominanceSeconds * sampleRate);
		const luminanceBeginSeconds = syncPorchSeconds;
		this.luminanceBeginSamples = Math.round(luminanceBeginSeconds * sampleRate);
		this.beginSamples = this.luminanceBeginSamples;
		const separatorBeginSeconds = luminanceBeginSeconds + luminanceSeconds;
		this.separatorBeginSamples = Math.round(separatorBeginSeconds * sampleRate);
		const separatorEndSeconds = separatorBeginSeconds + separatorSeconds;
		const chrominanceBeginSeconds = separatorEndSeconds + porchSeconds;
		this.chrominanceBeginSamples = Math.round(chrominanceBeginSeconds * sampleRate);
		const chrominanceEndSeconds = chrominanceBeginSeconds + chrominanceSeconds;
		this.endSamples = Math.round(chrominanceEndSeconds * sampleRate);
		this.lowPassFilter = new ExponentialMovingAverage();
		this.lastEven = false;
	}

	freqToLevel(frequency, offset) {
		return 0.5 * (frequency - offset + 1.0);
	}

	getName() { return "Robot 36 Color"; }
	getVISCode() { return 8; }
	getWidth() { return this.horizontalPixels; }
	getHeight() { return this.verticalPixels; }
	getFirstPixelSampleIndex() { return this.beginSamples; }
	getFirstSyncPulseIndex() { return 0; }
	getScanLineSamples() { return this.scanLineSamples; }

	resetState() {
		this.lastEven = false;
	}

	decodeScanLine(pixelBuffer, scratchBuffer, scanLineBuffer, scopeBufferWidth, syncPulseIndex, scanLineSamples, frequencyOffset) {
		if (syncPulseIndex + this.beginSamples < 0 || syncPulseIndex + this.endSamples > scanLineBuffer.length)
			return false;
		let separator = 0;
		for (let i = 0; i < this.separatorSamples; ++i)
			separator += scanLineBuffer[syncPulseIndex + this.separatorBeginSamples + i];
		separator /= this.separatorSamples;
		separator -= frequencyOffset;
		let even = separator < 0;
		if (separator < -1.1 || separator > -0.9 && separator < 0.9 || separator > 1.1)
			even = !this.lastEven;
		this.lastEven = even;
		this.lowPassFilter.cutoff(this.horizontalPixels, 2 * this.luminanceSamples, 2);
		this.lowPassFilter.reset();
		for (let i = this.beginSamples; i < this.endSamples; ++i)
			scratchBuffer[i] = this.lowPassFilter.avg(scanLineBuffer[syncPulseIndex + i]);
		this.lowPassFilter.reset();
		for (let i = this.endSamples - 1; i >= this.beginSamples; --i)
			scratchBuffer[i] = this.freqToLevel(this.lowPassFilter.avg(scratchBuffer[i]), frequencyOffset);
		for (let i = 0; i < this.horizontalPixels; ++i) {
			const luminancePos = this.luminanceBeginSamples + ((i * this.luminanceSamples) / this.horizontalPixels) | 0;
			const chrominancePos = this.chrominanceBeginSamples + ((i * this.chrominanceSamples) / this.horizontalPixels) | 0;
			if (even) {
				pixelBuffer.pixels[i] = ColorConverter.RGB(scratchBuffer[luminancePos], 0, scratchBuffer[chrominancePos]);
			} else {
				const evenYUV = pixelBuffer.pixels[i];
				const oddYUV = ColorConverter.RGB(scratchBuffer[luminancePos], scratchBuffer[chrominancePos], 0);
				pixelBuffer.pixels[i] = ColorConverter.YUV2RGB((evenYUV & 0x00ff00ff) | (oddYUV & 0x0000ff00));
				pixelBuffer.pixels[i + this.horizontalPixels] = ColorConverter.YUV2RGB((oddYUV & 0x00ffff00) | (evenYUV & 0x000000ff));
			}
		}
		pixelBuffer.width = this.horizontalPixels;
		pixelBuffer.height = 2;
		return !even;
	}
}
