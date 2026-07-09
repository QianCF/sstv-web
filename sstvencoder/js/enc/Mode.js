export class Mode {
	constructor(bitmap, output) {
		this.mBitmap = bitmap;
		this.mOutput = output;
		this.mSampleRate = output.getSampleRate();
		this.mVISCode = 0;
		this.mLine = 0;
		this.mRunningIntegral = 0;
	}

	init() {
		this.mRunningIntegral = 0;
		this.mLine = 0;
		this.mOutput.init(this.getTotalSamples());
		this.writeCalibrationHeader();
	}

	getProcessCount() {
		return this.mBitmap.height;
	}

	process() {
		if (this.mLine >= this.mBitmap.height)
			return false;
		this.writeEncodedLine();
		++this.mLine;
		return true;
	}

	finish(cancel) {
		this.mOutput.finish(cancel);
	}

	getTotalSamples() {
		return this.getHeaderSamples() + this.getTransmissionSamples();
	}

	getHeaderSamples() {
		return 2 * this.convertMsToSamples(300.0)
			+ this.convertMsToSamples(10.0)
			+ 10 * this.convertMsToSamples(30.0);
	}

	writeCalibrationHeader() {
		const leaderToneSamples = this.convertMsToSamples(300.0);
		const leaderToneFrequency = 1900.0;
		const breakSamples = this.convertMsToSamples(10.0);
		const breakFrequency = 1200.0;
		const visBitSamples = this.convertMsToSamples(30.0);
		const visBitSSFrequency = 1200.0;
		const visBitFrequency = [1300.0, 1100.0];

		for (let i = 0; i < leaderToneSamples; ++i) this.setTone(leaderToneFrequency);
		for (let i = 0; i < breakSamples; ++i) this.setTone(breakFrequency);
		for (let i = 0; i < leaderToneSamples; ++i) this.setTone(leaderToneFrequency);
		for (let i = 0; i < visBitSamples; ++i) this.setTone(visBitSSFrequency);

		let parity = 0;
		for (let pos = 0; pos < 7; ++pos) {
			const bit = (this.mVISCode >> pos) & 1;
			parity ^= bit;
			for (let i = 0; i < visBitSamples; ++i)
				this.setTone(visBitFrequency[bit]);
		}
		for (let i = 0; i < visBitSamples; ++i) this.setTone(visBitFrequency[parity]);
		for (let i = 0; i < visBitSamples; ++i) this.setTone(visBitSSFrequency);
	}

	convertMsToSamples(durationMs) {
		return Math.round(durationMs * this.mSampleRate / 1000.0);
	}

	setTone(frequency) {
		this.mRunningIntegral += 2.0 * frequency * Math.PI / this.mSampleRate;
		this.mRunningIntegral %= 2.0 * Math.PI;
		this.mOutput.write(Math.sin(this.mRunningIntegral));
	}

	setColorTone(color) {
		const blackFrequency = 1500.0;
		const whiteFrequency = 2300.0;
		this.setTone(color * (whiteFrequency - blackFrequency) / 255.0 + blackFrequency);
	}
}
