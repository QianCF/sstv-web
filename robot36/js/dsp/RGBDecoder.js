import { BaseMode } from "./BaseMode.js";
import { ExponentialMovingAverage } from "./ExponentialMovingAverage.js";
import { ColorConverter } from "./ColorConverter.js";

export class RGBDecoder extends BaseMode {
	constructor(name, code, horizontalPixels, verticalPixels, firstSyncPulseSeconds, scanLineSeconds, beginSeconds, redBeginSeconds, redEndSeconds, greenBeginSeconds, greenEndSeconds, blueBeginSeconds, blueEndSeconds, endSeconds, sampleRate) {
		super();
		this.name = name;
		this.code = code;
		this.horizontalPixels = horizontalPixels;
		this.verticalPixels = verticalPixels;
		this.firstSyncPulseIndex = Math.round(firstSyncPulseSeconds * sampleRate);
		this.scanLineSamples = Math.round(scanLineSeconds * sampleRate);
		this.beginSamples = Math.round(beginSeconds * sampleRate);
		this.redBeginSamples = Math.round(redBeginSeconds * sampleRate) - this.beginSamples;
		this.redSamples = Math.round((redEndSeconds - redBeginSeconds) * sampleRate);
		this.greenBeginSamples = Math.round(greenBeginSeconds * sampleRate) - this.beginSamples;
		this.greenSamples = Math.round((greenEndSeconds - greenBeginSeconds) * sampleRate);
		this.blueBeginSamples = Math.round(blueBeginSeconds * sampleRate) - this.beginSamples;
		this.blueSamples = Math.round((blueEndSeconds - blueBeginSeconds) * sampleRate);
		this.endSamples = Math.round(endSeconds * sampleRate);
		this.lowPassFilter = new ExponentialMovingAverage();
	}

	freqToLevel(frequency, offset) {
		return 0.5 * (frequency - offset + 1.0);
	}

	getName() { return this.name; }
	getVISCode() { return this.code; }
	getWidth() { return this.horizontalPixels; }
	getHeight() { return this.verticalPixels; }
	getFirstPixelSampleIndex() { return this.beginSamples; }
	getFirstSyncPulseIndex() { return this.firstSyncPulseIndex; }
	getScanLineSamples() { return this.scanLineSamples; }

	resetState() {}

	decodeScanLine(pixelBuffer, scratchBuffer, scanLineBuffer, scopeBufferWidth, syncPulseIndex, scanLineSamples, frequencyOffset) {
		if (syncPulseIndex + this.beginSamples < 0 || syncPulseIndex + this.endSamples > scanLineBuffer.length)
			return false;
		this.lowPassFilter.cutoff(this.horizontalPixels, 2 * this.greenSamples, 2);
		this.lowPassFilter.reset();
		for (let i = 0; i < this.endSamples - this.beginSamples; ++i)
			scratchBuffer[i] = this.lowPassFilter.avg(scanLineBuffer[syncPulseIndex + this.beginSamples + i]);
		this.lowPassFilter.reset();
		for (let i = this.endSamples - this.beginSamples - 1; i >= 0; --i)
			scratchBuffer[i] = this.freqToLevel(this.lowPassFilter.avg(scratchBuffer[i]), frequencyOffset);
		for (let i = 0; i < this.horizontalPixels; ++i) {
			const redPos = this.redBeginSamples + ((i * this.redSamples) / this.horizontalPixels) | 0;
			const greenPos = this.greenBeginSamples + ((i * this.greenSamples) / this.horizontalPixels) | 0;
			const bluePos = this.blueBeginSamples + ((i * this.blueSamples) / this.horizontalPixels) | 0;
			pixelBuffer.pixels[i] = ColorConverter.RGB(scratchBuffer[redPos], scratchBuffer[greenPos], scratchBuffer[bluePos]);
		}
		pixelBuffer.width = this.horizontalPixels;
		pixelBuffer.height = 1;
		return true;
	}
}
