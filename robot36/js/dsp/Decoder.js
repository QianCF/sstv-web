import { Demodulator } from "./Demodulator.js";
import { PixelBuffer } from "./PixelBuffer.js";
import { SimpleMovingAverage } from "./SimpleMovingAverage.js";
import { RawDecoder } from "./RawDecoder.js";
import { HFFax } from "./HFFax.js";
import { Robot_36_Color } from "./Robot_36_Color.js";
import { Robot_72_Color } from "./Robot_72_Color.js";
import { RGBModes } from "./RGBModes.js";
import { PaulDon } from "./PaulDon.js";
import { SyncPulseWidth } from "./SyncPulseWidth.js";

export class Decoder {
	constructor(scopeBuffer, imageBuffer, rawName, sampleRate) {
		this.scopeBuffer = scopeBuffer;
		this.imageBuffer = imageBuffer;
		imageBuffer.line = -1;
		this.pixelBuffer = new PixelBuffer(800, 2);
		this.demodulator = new Demodulator(sampleRate);
		const pulseFilterSeconds = 0.0025;
		const pulseFilterSamples = Math.round(pulseFilterSeconds * sampleRate) | 1;
		this.pulseFilterDelay = (pulseFilterSamples - 1) / 2;
		this.pulseFilter = new SimpleMovingAverage(pulseFilterSamples);
		const scanLineMaxSeconds = 7;
		const scanLineMaxSamples = Math.round(scanLineMaxSeconds * sampleRate);
		this.scanLineBuffer = new Float32Array(scanLineMaxSamples);
		const scratchBufferSeconds = 1.1;
		const scratchBufferSamples = Math.round(scratchBufferSeconds * sampleRate);
		this.scratchBuffer = new Float32Array(scratchBufferSamples);
		const leaderToneSeconds = 0.3;
		this.leaderToneSamples = Math.round(leaderToneSeconds * sampleRate);
		const leaderToneToleranceSeconds = leaderToneSeconds * 0.2;
		this.leaderToneToleranceSamples = Math.round(leaderToneToleranceSeconds * sampleRate);
		const transitionSeconds = 0.0005;
		this.transitionSamples = Math.round(transitionSeconds * sampleRate);
		const visCodeBitSeconds = 0.03;
		this.visCodeBitSamples = Math.round(visCodeBitSeconds * sampleRate);
		const visCodeSeconds = 0.3;
		this.visCodeSamples = Math.round(visCodeSeconds * sampleRate);
		this.visCodeBitFrequencies = new Float32Array(10);
		const scanLineCount = 4;
		this.last5msScanLines = new Int32Array(scanLineCount);
		this.last9msScanLines = new Int32Array(scanLineCount);
		this.last20msScanLines = new Int32Array(scanLineCount);
		const syncPulseCount = scanLineCount + 1;
		this.last5msSyncPulses = new Int32Array(syncPulseCount);
		this.last9msSyncPulses = new Int32Array(syncPulseCount);
		this.last20msSyncPulses = new Int32Array(syncPulseCount);
		this.last5msFrequencyOffsets = new Float32Array(syncPulseCount);
		this.last9msFrequencyOffsets = new Float32Array(syncPulseCount);
		this.last20msFrequencyOffsets = new Float32Array(syncPulseCount);
		const scanLineMinSeconds = 0.05;
		this.scanLineMinSamples = Math.round(scanLineMinSeconds * sampleRate);
		const syncPulseToleranceSeconds = 0.03;
		this.syncPulseToleranceSamples = Math.round(syncPulseToleranceSeconds * sampleRate);
		const scanLineToleranceSeconds = 0.001;
		this.scanLineToleranceSamples = Math.round(scanLineToleranceSeconds * sampleRate);
		this.rawMode = new RawDecoder(rawName, sampleRate);
		this.hfFaxMode = new HFFax(sampleRate);
		const robot36 = new Robot_36_Color(sampleRate);
		this.currentMode = robot36;
		this.currentScanLineSamples = robot36.getScanLineSamples();
		this.syncPulse5msModes = [];
		this.syncPulse5msModes.push(RGBModes.Wraase_SC2_180(sampleRate));
		this.syncPulse5msModes.push(RGBModes.Martin("1", 44, 0.146432, sampleRate));
		this.syncPulse5msModes.push(RGBModes.Martin("2", 40, 0.073216, sampleRate));
		this.syncPulse9msModes = [];
		this.syncPulse9msModes.push(robot36);
		this.syncPulse9msModes.push(new Robot_72_Color(sampleRate));
		this.syncPulse9msModes.push(RGBModes.Scottie("1", 60, 0.138240, sampleRate));
		this.syncPulse9msModes.push(RGBModes.Scottie("2", 56, 0.088064, sampleRate));
		this.syncPulse9msModes.push(RGBModes.Scottie("DX", 76, 0.3456, sampleRate));
		this.syncPulse20msModes = [];
		this.syncPulse20msModes.push(new PaulDon("50", 93, 320, 256, 0.09152, sampleRate));
		this.syncPulse20msModes.push(new PaulDon("90", 99, 320, 256, 0.17024, sampleRate));
		this.syncPulse20msModes.push(new PaulDon("120", 95, 640, 496, 0.1216, sampleRate));
		this.syncPulse20msModes.push(new PaulDon("160", 98, 512, 400, 0.195584, sampleRate));
		this.syncPulse20msModes.push(new PaulDon("180", 96, 640, 496, 0.18304, sampleRate));
		this.syncPulse20msModes.push(new PaulDon("240", 97, 640, 496, 0.24448, sampleRate));
		this.syncPulse20msModes.push(new PaulDon("290", 94, 800, 616, 0.2288, sampleRate));
		this.lockMode = false;
		this.currentSample = 0;
		this.leaderBreakIndex = 0;
		this.lastSyncPulseIndex = 0;
		this.lastFrequencyOffset = 0;
	}

	scanLineMean(lines) {
		let mean = 0;
		for (const diff of lines)
			mean += diff;
		mean /= lines.length;
		return mean;
	}

	scanLineStdDev(lines, mean) {
		let stdDev = 0;
		for (const diff of lines)
			stdDev += (diff - mean) * (diff - mean);
		stdDev = Math.sqrt(stdDev / lines.length);
		return stdDev;
	}

	frequencyOffsetMean(offsets) {
		let mean = 0;
		for (const diff of offsets)
			mean += diff;
		mean /= offsets.length;
		return mean;
	}

	detectMode(modes, line) {
		let bestMode = this.rawMode;
		let bestDist = Number.MAX_SAFE_INTEGER;
		for (const mode of modes) {
			const dist = Math.abs(line - mode.getScanLineSamples());
			if (dist <= this.scanLineToleranceSamples && dist < bestDist) {
				bestDist = dist;
				bestMode = mode;
			}
		}
		return bestMode;
	}

	findModeByCode(modes, code) {
		for (const mode of modes)
			if (mode.getVISCode() === code)
				return mode;
		return null;
	}

	findModeByName(modes, name) {
		for (const mode of modes)
			if (mode.getName() === name)
				return mode;
		return null;
	}

	copyPixels(dst, dstOff, src, srcOff, len) {
		for (let i = 0; i < len; i++)
			dst[dstOff + i] = src[srcOff + i];
	}

	copyUnscaled() {
		const width = Math.min(this.scopeBuffer.width, this.pixelBuffer.width);
		for (let row = 0; row < this.pixelBuffer.height; ++row) {
			const line = this.scopeBuffer.width * this.scopeBuffer.line;
			this.copyPixels(this.scopeBuffer.pixels, line, this.pixelBuffer.pixels, row * this.pixelBuffer.width, width);
			this.scopeBuffer.pixels.fill(0, line + width, line + this.scopeBuffer.width);
			this.scopeBuffer.pixels.copyWithin(
				this.scopeBuffer.width * (this.scopeBuffer.line + this.scopeBuffer.height / 2),
				line,
				line + this.scopeBuffer.width,
			);
			this.scopeBuffer.line = (this.scopeBuffer.line + 1) % (this.scopeBuffer.height / 2);
		}
	}

	copyScaled(scale) {
		for (let row = 0; row < this.pixelBuffer.height; ++row) {
			const line = this.scopeBuffer.width * this.scopeBuffer.line;
			for (let col = 0; col < this.pixelBuffer.width; ++col)
				for (let i = 0; i < scale; ++i)
					this.scopeBuffer.pixels[line + col * scale + i] = this.pixelBuffer.pixels[this.pixelBuffer.width * row + col];
			this.scopeBuffer.pixels.fill(0, line + this.pixelBuffer.width * scale, line + this.scopeBuffer.width);
			this.scopeBuffer.pixels.copyWithin(this.scopeBuffer.width * (this.scopeBuffer.line + this.scopeBuffer.height / 2), line, line + this.scopeBuffer.width);
			this.scopeBuffer.line = (this.scopeBuffer.line + 1) % (this.scopeBuffer.height / 2);
			for (let i = 1; i < scale; ++i) {
				this.scopeBuffer.pixels.copyWithin(this.scopeBuffer.width * this.scopeBuffer.line, line, line + this.scopeBuffer.width);
				this.scopeBuffer.pixels.copyWithin(this.scopeBuffer.width * (this.scopeBuffer.line + this.scopeBuffer.height / 2), line, line + this.scopeBuffer.width);
				this.scopeBuffer.line = (this.scopeBuffer.line + 1) % (this.scopeBuffer.height / 2);
			}
		}
	}

	copyLines(okay) {
		if (!okay)
			return;
		let finish = false;
		if (this.imageBuffer.line >= 0 && this.imageBuffer.line < this.imageBuffer.height && this.imageBuffer.width === this.pixelBuffer.width) {
			const width = this.imageBuffer.width;
			for (let row = 0; row < this.pixelBuffer.height && this.imageBuffer.line < this.imageBuffer.height; ++row, ++this.imageBuffer.line) {
				this.copyPixels(
					this.imageBuffer.pixels,
					this.imageBuffer.line * width,
					this.pixelBuffer.pixels,
					row * width,
					width,
				);
			}
			finish = this.imageBuffer.line === this.imageBuffer.height;
		}
		const scale = this.scopeBuffer.width / this.pixelBuffer.width;
		if (scale <= 1)
			this.copyUnscaled();
		else
			this.copyScaled(scale);
		if (finish)
			this.drawLines(0xff000000, 10);
	}

	drawLines(color, count) {
		for (let i = 0; i < count; ++i) {
			this.scopeBuffer.pixels.fill(color, this.scopeBuffer.line * this.scopeBuffer.width, (this.scopeBuffer.line + 1) * this.scopeBuffer.width);
			this.scopeBuffer.pixels.fill(color, (this.scopeBuffer.line + this.scopeBuffer.height / 2) * this.scopeBuffer.width, (this.scopeBuffer.line + 1 + this.scopeBuffer.height / 2) * this.scopeBuffer.width);
			this.scopeBuffer.line = (this.scopeBuffer.line + 1) % (this.scopeBuffer.height / 2);
		}
	}

	adjustSyncPulses(pulses, shift) {
		for (let i = 0; i < pulses.length; ++i)
			pulses[i] -= shift;
	}

	shiftSamples(shift) {
		if (shift <= 0 || shift > this.currentSample)
			return;
		this.currentSample -= shift;
		this.leaderBreakIndex -= shift;
		this.lastSyncPulseIndex -= shift;
		this.adjustSyncPulses(this.last5msSyncPulses, shift);
		this.adjustSyncPulses(this.last9msSyncPulses, shift);
		this.adjustSyncPulses(this.last20msSyncPulses, shift);
		this.scanLineBuffer.copyWithin(0, shift, shift + this.currentSample);
	}

	handleHeader() {
		if (this.leaderBreakIndex < this.visCodeBitSamples + this.leaderToneToleranceSamples || this.currentSample < this.leaderBreakIndex + this.leaderToneSamples + this.leaderToneToleranceSamples + this.visCodeSamples + this.visCodeBitSamples)
			return false;
		const breakPulseIndex = this.leaderBreakIndex;
		this.leaderBreakIndex = 0;
		let preBreakFreq = 0;
		for (let i = 0; i < this.leaderToneToleranceSamples; ++i)
			preBreakFreq += this.scanLineBuffer[breakPulseIndex - this.visCodeBitSamples - this.leaderToneToleranceSamples + i];
		const leaderToneFrequency = 1900;
		const centerFrequency = 1900;
		const toleranceFrequency = 50;
		const halfBandWidth = 400;
		preBreakFreq = preBreakFreq * halfBandWidth / this.leaderToneToleranceSamples + centerFrequency;
		if (Math.abs(preBreakFreq - leaderToneFrequency) > toleranceFrequency)
			return false;
		let leaderFreq = 0;
		for (let i = this.transitionSamples; i < this.leaderToneSamples - this.leaderToneToleranceSamples; ++i)
			leaderFreq += this.scanLineBuffer[breakPulseIndex + i];
		const leaderFreqOffset = leaderFreq / (this.leaderToneSamples - this.transitionSamples - this.leaderToneToleranceSamples);
		leaderFreq = leaderFreqOffset * halfBandWidth + centerFrequency;
		if (Math.abs(leaderFreq - leaderToneFrequency) > toleranceFrequency)
			return false;
		const stopBitFrequency = 1200;
		const pulseThresholdFrequency = (stopBitFrequency + leaderToneFrequency) / 2;
		const pulseThresholdValue = (pulseThresholdFrequency - centerFrequency) / halfBandWidth;
		let visBeginIndex = breakPulseIndex + this.leaderToneSamples - this.leaderToneToleranceSamples;
		let visEndIndex = breakPulseIndex + this.leaderToneSamples + this.leaderToneToleranceSamples + this.visCodeBitSamples;
		for (let i = 0; i < this.pulseFilter.length; ++i)
			this.pulseFilter.avg(this.scanLineBuffer[visBeginIndex++] - leaderFreqOffset);
		while (++visBeginIndex < visEndIndex)
			if (this.pulseFilter.avg(this.scanLineBuffer[visBeginIndex] - leaderFreqOffset) < pulseThresholdValue)
				break;
		if (visBeginIndex >= visEndIndex)
			return false;
		visBeginIndex -= this.pulseFilterDelay;
		visEndIndex = visBeginIndex + this.visCodeSamples;
		this.visCodeBitFrequencies.fill(0);
		for (let j = 0; j < 10; ++j)
			for (let i = this.transitionSamples; i < this.visCodeBitSamples - this.transitionSamples; ++i)
				this.visCodeBitFrequencies[j] += this.scanLineBuffer[visBeginIndex + this.visCodeBitSamples * j + i] - leaderFreqOffset;
		for (let i = 0; i < 10; ++i)
			this.visCodeBitFrequencies[i] = this.visCodeBitFrequencies[i] * halfBandWidth / (this.visCodeBitSamples - 2 * this.transitionSamples) + centerFrequency;
		if (Math.abs(this.visCodeBitFrequencies[0] - stopBitFrequency) > toleranceFrequency || Math.abs(this.visCodeBitFrequencies[9] - stopBitFrequency) > toleranceFrequency)
			return false;
		const oneBitFrequency = 1100;
		const zeroBitFrequency = 1300;
		for (let i = 1; i < 9; ++i)
			if (Math.abs(this.visCodeBitFrequencies[i] - oneBitFrequency) > toleranceFrequency && Math.abs(this.visCodeBitFrequencies[i] - zeroBitFrequency) > toleranceFrequency)
				return false;
		let visCode = 0;
		for (let i = 0; i < 8; ++i)
			visCode |= (this.visCodeBitFrequencies[i + 1] < stopBitFrequency ? 1 : 0) << i;
		let check = true;
		for (let i = 0; i < 8; ++i)
			check ^= (visCode & 1 << i) !== 0;
		visCode &= 127;
		if (!check)
			return false;
		const syncPorchFrequency = 1500;
		const syncPulseFrequency = 1200;
		const syncThresholdFrequency = (syncPulseFrequency + syncPorchFrequency) / 2;
		const syncThresholdValue = (syncThresholdFrequency - centerFrequency) / halfBandWidth;
		let syncPulseIndex = visEndIndex - this.visCodeBitSamples;
		const syncPulseMaxIndex = visEndIndex + this.visCodeBitSamples;
		for (let i = 0; i < this.pulseFilter.length; ++i)
			this.pulseFilter.avg(this.scanLineBuffer[syncPulseIndex++] - leaderFreqOffset);
		while (++syncPulseIndex < syncPulseMaxIndex)
			if (this.pulseFilter.avg(this.scanLineBuffer[syncPulseIndex] - leaderFreqOffset) > syncThresholdValue)
				break;
		if (syncPulseIndex >= syncPulseMaxIndex)
			return false;
		syncPulseIndex -= this.pulseFilterDelay;
		let mode;
		let pulses;
		let lines;
		if ((mode = this.findModeByCode(this.syncPulse5msModes, visCode)) !== null) {
			pulses = this.last5msSyncPulses;
			lines = this.last5msScanLines;
		} else if ((mode = this.findModeByCode(this.syncPulse9msModes, visCode)) !== null) {
			pulses = this.last9msSyncPulses;
			lines = this.last9msScanLines;
		} else if ((mode = this.findModeByCode(this.syncPulse20msModes, visCode)) !== null) {
			pulses = this.last20msSyncPulses;
			lines = this.last20msScanLines;
		} else {
			if (!this.lockMode)
				this.drawLines(0xffff0000, 8);
			return false;
		}
		if (this.lockMode && mode !== this.currentMode)
			return false;
		mode.resetState();
		this.imageBuffer.width = mode.getWidth();
		this.imageBuffer.height = mode.getHeight();
		this.imageBuffer.line = 0;
		this.currentMode = mode;
		this.lastSyncPulseIndex = syncPulseIndex + mode.getFirstSyncPulseIndex();
		this.currentScanLineSamples = mode.getScanLineSamples();
		this.lastFrequencyOffset = leaderFreqOffset;
		let oldestSyncPulseIndex = this.lastSyncPulseIndex - (pulses.length - 1) * this.currentScanLineSamples;
		if (mode.getFirstSyncPulseIndex() > 0)
			oldestSyncPulseIndex -= this.currentScanLineSamples;
		for (let i = 0; i < pulses.length; ++i)
			pulses[i] = oldestSyncPulseIndex + i * this.currentScanLineSamples;
		lines.fill(this.currentScanLineSamples);
		this.shiftSamples(this.lastSyncPulseIndex + mode.getFirstPixelSampleIndex());
		this.drawLines(0xff00ff00, 8);
		this.drawLines(0xff000000, 10);
		return true;
	}

	processSyncPulse(modes, freqOffs, syncIndexes, lineLengths, latestSyncIndex) {
		for (let i = 1; i < syncIndexes.length; ++i)
			syncIndexes[i - 1] = syncIndexes[i];
		syncIndexes[syncIndexes.length - 1] = latestSyncIndex;
		for (let i = 1; i < lineLengths.length; ++i)
			lineLengths[i - 1] = lineLengths[i];
		lineLengths[lineLengths.length - 1] = syncIndexes[syncIndexes.length - 1] - syncIndexes[syncIndexes.length - 2];
		for (let i = 1; i < freqOffs.length; ++i)
			freqOffs[i - 1] = freqOffs[i];
		freqOffs[syncIndexes.length - 1] = this.demodulator.frequencyOffset;
		if (lineLengths[0] === 0)
			return false;
		const mean = this.scanLineMean(lineLengths);
		const scanLineSamples = Math.round(mean);
		if (scanLineSamples < this.scanLineMinSamples || scanLineSamples > this.scratchBuffer.length)
			return false;
		if (this.scanLineStdDev(lineLengths, mean) > this.scanLineToleranceSamples)
			return false;
		let pictureChanged = false;
		if (this.lockMode || this.imageBuffer.line >= 0 && this.imageBuffer.line < this.imageBuffer.height) {
			if (this.currentMode !== this.rawMode && Math.abs(scanLineSamples - this.currentMode.getScanLineSamples()) > this.scanLineToleranceSamples)
				return false;
		} else {
			const prevMode = this.currentMode;
			this.currentMode = this.detectMode(modes, scanLineSamples);
			pictureChanged = this.currentMode !== prevMode
				|| Math.abs(this.currentScanLineSamples - scanLineSamples) > this.scanLineToleranceSamples
				|| Math.abs(this.lastSyncPulseIndex + scanLineSamples - syncIndexes[syncIndexes.length - 1]) > this.syncPulseToleranceSamples;
		}
		if (pictureChanged) {
			this.drawLines(0xff000000, 10);
			this.drawLines(0xff00ffff, 8);
			this.drawLines(0xff000000, 10);
		}
		const frequencyOffset = this.frequencyOffsetMean(freqOffs);
		if (syncIndexes[0] >= scanLineSamples && pictureChanged) {
			const endPulse = syncIndexes[0];
			const extrapolate = Math.floor(endPulse / scanLineSamples);
			const firstPulse = endPulse - extrapolate * scanLineSamples;
			for (let pulseIndex = firstPulse; pulseIndex < endPulse; pulseIndex += scanLineSamples)
				this.copyLines(this.currentMode.decodeScanLine(this.pixelBuffer, this.scratchBuffer, this.scanLineBuffer, this.scopeBuffer.width, pulseIndex, scanLineSamples, frequencyOffset));
		}
		for (let i = pictureChanged ? 0 : lineLengths.length - 1; i < lineLengths.length; ++i)
			this.copyLines(this.currentMode.decodeScanLine(this.pixelBuffer, this.scratchBuffer, this.scanLineBuffer, this.scopeBuffer.width, syncIndexes[i], lineLengths[i], frequencyOffset));
		this.lastSyncPulseIndex = syncIndexes[syncIndexes.length - 1];
		this.currentScanLineSamples = scanLineSamples;
		this.lastFrequencyOffset = frequencyOffset;
		this.shiftSamples(this.lastSyncPulseIndex + this.currentMode.getFirstPixelSampleIndex());
		return true;
	}

	process(recordBuffer, channelSelect) {
		let newLinesPresent = false;
		const syncPulseDetected = this.demodulator.process(recordBuffer, channelSelect);
		let syncPulseIndex = this.currentSample + this.demodulator.syncPulseOffset;
		const channels = channelSelect > 0 ? 2 : 1;
		for (let j = 0; j < recordBuffer.length / channels; ++j) {
			this.scanLineBuffer[this.currentSample++] = recordBuffer[j];
			if (this.currentSample >= this.scanLineBuffer.length) {
				this.shiftSamples(this.currentScanLineSamples);
				syncPulseIndex -= this.currentScanLineSamples;
			}
		}
		if (syncPulseDetected) {
			switch (this.demodulator.syncPulseWidth) {
				case SyncPulseWidth.FiveMilliSeconds:
					newLinesPresent = this.processSyncPulse(this.syncPulse5msModes, this.last5msFrequencyOffsets, this.last5msSyncPulses, this.last5msScanLines, syncPulseIndex);
					break;
				case SyncPulseWidth.NineMilliSeconds:
					this.leaderBreakIndex = syncPulseIndex;
					newLinesPresent = this.processSyncPulse(this.syncPulse9msModes, this.last9msFrequencyOffsets, this.last9msSyncPulses, this.last9msScanLines, syncPulseIndex);
					break;
				case SyncPulseWidth.TwentyMilliSeconds:
					this.leaderBreakIndex = syncPulseIndex;
					newLinesPresent = this.processSyncPulse(this.syncPulse20msModes, this.last20msFrequencyOffsets, this.last20msSyncPulses, this.last20msScanLines, syncPulseIndex);
					break;
				default:
					break;
			}
		} else if (this.handleHeader()) {
			newLinesPresent = true;
		} else if (this.currentSample > this.lastSyncPulseIndex + (this.currentScanLineSamples * 5) / 4) {
			this.copyLines(this.currentMode.decodeScanLine(this.pixelBuffer, this.scratchBuffer, this.scanLineBuffer, this.scopeBuffer.width, this.lastSyncPulseIndex, this.currentScanLineSamples, this.lastFrequencyOffset));
			this.lastSyncPulseIndex += this.currentScanLineSamples;
			newLinesPresent = true;
		}
		return newLinesPresent;
	}

	setMode(name) {
		if (this.rawMode.getName() === name) {
			this.lockMode = true;
			this.imageBuffer.line = -1;
			this.currentMode = this.rawMode;
			return;
		}
		let mode = this.findModeByName(this.syncPulse5msModes, name);
		if (mode === null)
			mode = this.findModeByName(this.syncPulse9msModes, name);
		if (mode === null)
			mode = this.findModeByName(this.syncPulse20msModes, name);
		if (mode === null && this.hfFaxMode.getName() === name)
			mode = this.hfFaxMode;
		if (mode === this.currentMode) {
			this.lockMode = true;
			return;
		}
		if (mode !== null) {
			this.lockMode = true;
			this.imageBuffer.line = -1;
			this.currentMode = mode;
			this.currentScanLineSamples = mode.getScanLineSamples();
			return;
		}
		this.lockMode = false;
	}
}
