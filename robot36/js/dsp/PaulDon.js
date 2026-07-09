import { BaseMode } from "./BaseMode.js";
import { ExponentialMovingAverage } from "./ExponentialMovingAverage.js";
import { ColorConverter } from "./ColorConverter.js";

export class PaulDon extends BaseMode {
	constructor(name, code, horizontalPixels, verticalPixels, channelSeconds, sampleRate) {
		super();
		this.name = "PD " + name;
		this.code = code;
		this.horizontalPixels = horizontalPixels;
		this.verticalPixels = verticalPixels;
		const syncPulseSeconds = 0.02;
		const syncPorchSeconds = 0.00208;
		const scanLineSeconds = syncPulseSeconds + syncPorchSeconds + 4 * channelSeconds;
		this.scanLineSamples = Math.round(scanLineSeconds * sampleRate);
		this.channelSamples = Math.round(channelSeconds * sampleRate);
		const yEvenBeginSeconds = syncPorchSeconds;
		this.yEvenBeginSamples = Math.round(yEvenBeginSeconds * sampleRate);
		this.beginSamples = this.yEvenBeginSamples;
		const vAvgBeginSeconds = yEvenBeginSeconds + channelSeconds;
		this.vAvgBeginSamples = Math.round(vAvgBeginSeconds * sampleRate);
		const uAvgBeginSeconds = vAvgBeginSeconds + channelSeconds;
		this.uAvgBeginSamples = Math.round(uAvgBeginSeconds * sampleRate);
		const yOddBeginSeconds = uAvgBeginSeconds + channelSeconds;
		this.yOddBeginSamples = Math.round(yOddBeginSeconds * sampleRate);
		const yOddEndSeconds = yOddBeginSeconds + channelSeconds;
		this.endSamples = Math.round(yOddEndSeconds * sampleRate);
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
	getFirstSyncPulseIndex() { return 0; }
	getScanLineSamples() { return this.scanLineSamples; }

	resetState() {}

	decodeScanLine(pixelBuffer, scratchBuffer, scanLineBuffer, scopeBufferWidth, syncPulseIndex, scanLineSamples, frequencyOffset) {
		if (syncPulseIndex + this.beginSamples < 0 || syncPulseIndex + this.endSamples > scanLineBuffer.length)
			return false;
		this.lowPassFilter.cutoff(this.horizontalPixels, 2 * this.channelSamples, 2);
		this.lowPassFilter.reset();
		for (let i = this.beginSamples; i < this.endSamples; ++i)
			scratchBuffer[i] = this.lowPassFilter.avg(scanLineBuffer[syncPulseIndex + i]);
		this.lowPassFilter.reset();
		for (let i = this.endSamples - 1; i >= this.beginSamples; --i)
			scratchBuffer[i] = this.freqToLevel(this.lowPassFilter.avg(scratchBuffer[i]), frequencyOffset);
		for (let i = 0; i < this.horizontalPixels; ++i) {
			const position = ((i * this.channelSamples) / this.horizontalPixels) | 0;
			const yEvenPos = position + this.yEvenBeginSamples;
			const vAvgPos = position + this.vAvgBeginSamples;
			const uAvgPos = position + this.uAvgBeginSamples;
			const yOddPos = position + this.yOddBeginSamples;
			pixelBuffer.pixels[i] = ColorConverter.YUV2RGB(scratchBuffer[yEvenPos], scratchBuffer[uAvgPos], scratchBuffer[vAvgPos]);
			pixelBuffer.pixels[i + this.horizontalPixels] = ColorConverter.YUV2RGB(scratchBuffer[yOddPos], scratchBuffer[uAvgPos], scratchBuffer[vAvgPos]);
		}
		pixelBuffer.width = this.horizontalPixels;
		pixelBuffer.height = 2;
		return true;
	}
}
