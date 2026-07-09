export class ExponentialMovingAverage {
	constructor() {
		this._alpha = 1;
		this.prev = 0;
	}

	avg(input) {
		return this.prev = this.prev * (1 - this._alpha) + this._alpha * input;
	}

	alpha(alphaVal, order) {
		if (typeof order === "number") {
			this.alpha(Math.pow(alphaVal, 1.0 / order));
		} else {
			this._alpha = alphaVal;
		}
	}

	cutoff(freq, rate, order) {
		if (typeof order === "undefined") {
			this.cutoff(freq, rate, 1);
			return;
		}
		const x = Math.cos(2 * Math.PI * freq / rate);
		this.alpha(x - 1 + Math.sqrt(x * (x - 4) + 3), order);
	}

	reset() {
		this.prev = 0;
	}
}
