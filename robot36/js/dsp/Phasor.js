import { Complex } from "./Complex.js";

export class Phasor {
	constructor(freq, rate) {
		this.value = new Complex(1, 0);
		const omega = 2 * Math.PI * freq / rate;
		this.delta = new Complex(Math.cos(omega), Math.sin(omega));
	}

	rotate() {
		return this.value.div(this.value.mul(this.delta).abs());
	}
}
