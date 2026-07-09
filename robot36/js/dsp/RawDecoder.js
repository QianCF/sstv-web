import { BaseMode } from "./BaseMode.js";
import { ExponentialMovingAverage } from "./ExponentialMovingAverage.js";
import { ColorConverter } from "./ColorConverter.js";

export class RawDecoder extends BaseMode {
	constructor(name, sampleRate) {
		super();
		this.name = name;
		this.smallPictureMaxSamples = Math.round(0.125 * sampleRate);
		this.mediumPictureMaxSamples = Math.round(0.175 * sampleRate);
		this.lowPassFilter = new ExponentialMovingAverage();
	}

	freqToLevel(frequency, offset) {
		return 0.5 * (frequency - offset + 1.0);
	}

	getName() { return this.name; }
	getVISCode() { return -1; }
	getWidth() { return -1; }
	getHeight() { return -1; }
	getFirstPixelSampleIndex() { return 0; }
	getFirstSyncPulseIndex() { return -1; }
	getScanLineSamples() { return -1; }

	resetState() {}

	decodeScanLine(pixelBuffer, scratchBuffer, scanLineBuffer, scopeBufferWidth, syncPulseIndex, scanLineSamples, frequencyOffset) {
		if (syncPulseIndex < 0 || syncPulseIndex + scanLineSamples > scanLineBuffer.length)
			return false;
		let horizontalPixels = scopeBufferWidth;
		if (scanLineSamples < this.smallPictureMaxSamples)
			horizontalPixels /= 2;
		if (scanLineSamples < this.mediumPictureMaxSamples)
			horizontalPixels /= 2;
		this.lowPassFilter.cutoff(horizontalPixels, 2 * scanLineSamples, 2);
		this.lowPassFilter.reset();
		for (let i = 0; i < scanLineSamples; ++i)
			scratchBuffer[i] = this.lowPassFilter.avg(scanLineBuffer[syncPulseIndex + i]);
		this.lowPassFilter.reset();
		for (let i = scanLineSamples - 1; i >= 0; --i)
			scratchBuffer[i] = this.freqToLevel(this.lowPassFilter.avg(scratchBuffer[i]), frequencyOffset);
		for (let i = 0; i < horizontalPixels; ++i) {
			const position = ((i * scanLineSamples) / horizontalPixels) | 0;
			pixelBuffer.pixels[i] = ColorConverter.GRAY(scratchBuffer[position]);
		}
		pixelBuffer.width = horizontalPixels;
		pixelBuffer.height = 1;
		return true;
	}
}
