import { BaseMode } from "./BaseMode.js";
import { ExponentialMovingAverage } from "./ExponentialMovingAverage.js";
import { ColorConverter } from "./ColorConverter.js";

export class Robot_72_Color extends BaseMode {
	constructor(sampleRate) {
		super();
		this.horizontalPixels = 320;
		this.verticalPixels = 240;
		const syncPulseSeconds = 0.009;
		const syncPorchSeconds = 0.003;
		const luminanceSeconds = 0.138;
		const separatorSeconds = 0.0045;
		const porchSeconds = 0.0015;
		const chrominanceSeconds = 0.069;
		const scanLineSeconds = syncPulseSeconds + syncPorchSeconds + luminanceSeconds + 2 * (separatorSeconds + porchSeconds + chrominanceSeconds);
		this.scanLineSamples = Math.round(scanLineSeconds * sampleRate);
		this.luminanceSamples = Math.round(luminanceSeconds * sampleRate);
		this.chrominanceSamples = Math.round(chrominanceSeconds * sampleRate);
		const yBeginSeconds = syncPorchSeconds;
		this.yBeginSamples = Math.round(yBeginSeconds * sampleRate);
		this.beginSamples = this.yBeginSamples;
		const yEndSeconds = yBeginSeconds + luminanceSeconds;
		const vBeginSeconds = yEndSeconds + separatorSeconds + porchSeconds;
		this.vBeginSamples = Math.round(vBeginSeconds * sampleRate);
		const vEndSeconds = vBeginSeconds + chrominanceSeconds;
		const uBeginSeconds = vEndSeconds + separatorSeconds + porchSeconds;
		this.uBeginSamples = Math.round(uBeginSeconds * sampleRate);
		const uEndSeconds = uBeginSeconds + chrominanceSeconds;
		this.endSamples = Math.round(uEndSeconds * sampleRate);
		this.lowPassFilter = new ExponentialMovingAverage();
	}

	freqToLevel(frequency, offset) {
		return 0.5 * (frequency - offset + 1.0);
	}

	getName() { return "Robot 72 Color"; }
	getVISCode() { return 12; }
	getWidth() { return this.horizontalPixels; }
	getHeight() { return this.verticalPixels; }
	getFirstPixelSampleIndex() { return this.beginSamples; }
	getFirstSyncPulseIndex() { return 0; }
	getScanLineSamples() { return this.scanLineSamples; }

	resetState() {}

	decodeScanLine(pixelBuffer, scratchBuffer, scanLineBuffer, scopeBufferWidth, syncPulseIndex, scanLineSamples, frequencyOffset) {
		if (syncPulseIndex + this.beginSamples < 0 || syncPulseIndex + this.endSamples > scanLineBuffer.length)
			return false;
		this.lowPassFilter.cutoff(this.horizontalPixels, 2 * this.luminanceSamples, 2);
		this.lowPassFilter.reset();
		for (let i = this.beginSamples; i < this.endSamples; ++i)
			scratchBuffer[i] = this.lowPassFilter.avg(scanLineBuffer[syncPulseIndex + i]);
		this.lowPassFilter.reset();
		for (let i = this.endSamples - 1; i >= this.beginSamples; --i)
			scratchBuffer[i] = this.freqToLevel(this.lowPassFilter.avg(scratchBuffer[i]), frequencyOffset);
		for (let i = 0; i < this.horizontalPixels; ++i) {
			const yPos = this.yBeginSamples + ((i * this.luminanceSamples) / this.horizontalPixels) | 0;
			const uPos = this.uBeginSamples + ((i * this.chrominanceSamples) / this.horizontalPixels) | 0;
			const vPos = this.vBeginSamples + ((i * this.chrominanceSamples) / this.horizontalPixels) | 0;
			pixelBuffer.pixels[i] = ColorConverter.YUV2RGB(scratchBuffer[yPos], scratchBuffer[uPos], scratchBuffer[vPos]);
		}
		pixelBuffer.width = this.horizontalPixels;
		pixelBuffer.height = 1;
		return true;
	}
}
