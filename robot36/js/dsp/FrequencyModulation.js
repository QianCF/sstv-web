export class FrequencyModulation {
	constructor(bandwidth, sampleRate) {
		this.Pi = Math.PI;
		this.TwoPi = 2 * this.Pi;
		this.scale = sampleRate / (bandwidth * Math.PI);
		this.prev = 0;
	}

	wrap(value) {
		if (value < -this.Pi)
			return value + this.TwoPi;
		if (value > this.Pi)
			return value - this.TwoPi;
		return value;
	}

	demod(input) {
		const phase = input.arg();
		const delta = this.wrap(phase - this.prev);
		this.prev = phase;
		return this.scale * delta;
	}
}
