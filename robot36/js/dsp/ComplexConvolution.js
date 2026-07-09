import { Complex } from "./Complex.js";

export class ComplexConvolution {
	constructor(length) {
		this.length = length;
		this.taps = new Float32Array(length);
		this.real = new Float32Array(length);
		this.imag = new Float32Array(length);
		this.sum = new Complex();
		this.pos = 0;
	}

	push(input) {
		this.real[this.pos] = input.real;
		this.imag[this.pos] = input.imag;
		if (++this.pos >= this.length)
			this.pos = 0;
		this.sum.real = 0;
		this.sum.imag = 0;
		for (const tap of this.taps) {
			this.sum.real += tap * this.real[this.pos];
			this.sum.imag += tap * this.imag[this.pos];
			if (++this.pos >= this.length)
				this.pos = 0;
		}
		return this.sum;
	}
}
