import { SimpleMovingAverage } from "./SimpleMovingAverage.js";
import { ComplexConvolution } from "./ComplexConvolution.js";
import { FrequencyModulation } from "./FrequencyModulation.js";
import { SchmittTrigger } from "./SchmittTrigger.js";
import { Phasor } from "./Phasor.js";
import { Delay } from "./Delay.js";
import { Kaiser } from "./Kaiser.js";
import { Filter } from "./Filter.js";
import { Complex } from "./Complex.js";
import { SyncPulseWidth } from "./SyncPulseWidth.js";

export class Demodulator {
	static syncPulseFrequency = 1200;
	static blackFrequency = 1500;
	static whiteFrequency = 2300;

	constructor(sampleRate) {
		this.scanLineBandwidth = Demodulator.whiteFrequency - Demodulator.blackFrequency;
		this.frequencyModulation = new FrequencyModulation(this.scanLineBandwidth, sampleRate);
		const syncPulse5msSeconds = 0.005;
		const syncPulse9msSeconds = 0.009;
		const syncPulse20msSeconds = 0.020;
		const syncPulse5msMinSeconds = syncPulse5msSeconds / 2;
		const syncPulse5msMaxSeconds = (syncPulse5msSeconds + syncPulse9msSeconds) / 2;
		const syncPulse9msMaxSeconds = (syncPulse9msSeconds + syncPulse20msSeconds) / 2;
		const syncPulse20msMaxSeconds = syncPulse20msSeconds + syncPulse5msSeconds;
		this.syncPulse5msMinSamples = Math.round(syncPulse5msMinSeconds * sampleRate);
		this.syncPulse5msMaxSamples = Math.round(syncPulse5msMaxSeconds * sampleRate);
		this.syncPulse9msMaxSamples = Math.round(syncPulse9msMaxSeconds * sampleRate);
		this.syncPulse20msMaxSamples = Math.round(syncPulse20msMaxSeconds * sampleRate);
		const syncPulseFilterSeconds = syncPulse5msSeconds / 2;
		const syncPulseFilterSamples = Math.round(syncPulseFilterSeconds * sampleRate) | 1;
		this.syncPulseFilterDelay = (syncPulseFilterSamples - 1) / 2;
		this.syncPulseFilter = new SimpleMovingAverage(syncPulseFilterSamples);
		this.syncPulseValueDelay = new Delay(syncPulseFilterSamples);
		const lowestFrequency = 1000;
		const highestFrequency = 2800;
		const cutoffFrequency = (highestFrequency - lowestFrequency) / 2;
		const baseBandLowPassSeconds = 0.002;
		const baseBandLowPassSamples = Math.round(baseBandLowPassSeconds * sampleRate) | 1;
		this.baseBandLowPass = new ComplexConvolution(baseBandLowPassSamples);
		const kaiser = new Kaiser();
		for (let i = 0; i < this.baseBandLowPass.length; ++i)
			this.baseBandLowPass.taps[i] = kaiser.window(2.0, i, this.baseBandLowPass.length) * Filter.lowPass(cutoffFrequency, sampleRate, i, this.baseBandLowPass.length);
		this.centerFrequency = (lowestFrequency + highestFrequency) / 2;
		this.baseBandOscillator = new Phasor(-this.centerFrequency, sampleRate);
		this.syncPulseFrequencyValue = this.normalizeFrequency(Demodulator.syncPulseFrequency);
		this.syncPulseFrequencyTolerance = 50 * 2 / this.scanLineBandwidth;
		const syncPorchFrequency = 1500;
		const syncHighFrequency = (Demodulator.syncPulseFrequency + syncPorchFrequency) / 2;
		const syncLowFrequency = (Demodulator.syncPulseFrequency + syncHighFrequency) / 2;
		const syncLowValue = this.normalizeFrequency(syncLowFrequency);
		const syncHighValue = this.normalizeFrequency(syncHighFrequency);
		this.syncPulseTrigger = new SchmittTrigger(syncLowValue, syncHighValue);
		this.baseBand = new Complex();
		this.syncPulseCounter = 0;
	}

	normalizeFrequency(frequency) {
		return (frequency - this.centerFrequency) * 2 / this.scanLineBandwidth;
	}

	process(buffer, channelSelect) {
		let syncPulseDetected = false;
		const channels = channelSelect > 0 ? 2 : 1;
		for (let i = 0; i < buffer.length / channels; ++i) {
			switch (channelSelect) {
				case 1:
					this.baseBand.set(buffer[2 * i]);
					break;
				case 2:
					this.baseBand.set(buffer[2 * i + 1]);
					break;
				case 3:
					this.baseBand.set(buffer[2 * i] + buffer[2 * i + 1]);
					break;
				case 4:
					this.baseBand.set(buffer[2 * i], buffer[2 * i + 1]);
					break;
				default:
					this.baseBand.set(buffer[i]);
			}
			this.baseBand = this.baseBandLowPass.push(this.baseBand.mul(this.baseBandOscillator.rotate()));
			const frequencyValue = this.frequencyModulation.demod(this.baseBand);
			const syncPulseValue = this.syncPulseFilter.avg(frequencyValue);
			const syncPulseDelayedValue = this.syncPulseValueDelay.push(syncPulseValue);
			buffer[i] = frequencyValue;
			if (!this.syncPulseTrigger.latch(syncPulseValue)) {
				++this.syncPulseCounter;
			} else if (this.syncPulseCounter < this.syncPulse5msMinSamples || this.syncPulseCounter > this.syncPulse20msMaxSamples || Math.abs(syncPulseDelayedValue - this.syncPulseFrequencyValue) > this.syncPulseFrequencyTolerance) {
				this.syncPulseCounter = 0;
			} else {
				if (this.syncPulseCounter < this.syncPulse5msMaxSamples)
					this.syncPulseWidth = SyncPulseWidth.FiveMilliSeconds;
				else if (this.syncPulseCounter < this.syncPulse9msMaxSamples)
					this.syncPulseWidth = SyncPulseWidth.NineMilliSeconds;
				else
					this.syncPulseWidth = SyncPulseWidth.TwentyMilliSeconds;
				this.syncPulseOffset = i - this.syncPulseFilterDelay;
				this.frequencyOffset = syncPulseDelayedValue - this.syncPulseFrequencyValue;
				syncPulseDetected = true;
				this.syncPulseCounter = 0;
			}
		}
		return syncPulseDetected;
	}
}
